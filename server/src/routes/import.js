import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../lib/http-error.js';
import { parseOrThrow } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { createVisitorSchema } from '../validation/visitors.js';
import { csmSchema } from '../validation/csm.js';
import { parseCsv, rejectionCsv } from '../import/csv.js';

const router = Router();
router.use(requireAuth, requireRole('administrator'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.originalname.toLowerCase().endsWith('.csv') || file.mimetype === 'text/csv') {
      callback(null, true);
    } else {
      callback(new HttpError(400, 'Only CSV files are accepted'));
    }
  },
});

function validateFile(file) {
  if (!file) throw new HttpError(400, 'CSV file is required');
  const rows = parseCsv(file.buffer.toString('utf8'));
  if (!rows.length) throw new HttpError(400, 'CSV file has no data rows');
  return rows;
}

function validationReason(result) {
  return result.error.issues.map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`).join('; ');
}

async function importRows(req, res, type, file) {
  const rows = validateFile(file);
  const accepted = [];
  const rejected = [];
  let duplicateCount = 0;

  for (const row of rows) {
    const result = type === 'visitors'
      ? createVisitorSchema.safeParse(row.data)
      : csmSchema.safeParse(row.data);
    if (!result.success) {
      rejected.push({ rowNumber: row.rowNumber, reason: validationReason(result) });
      continue;
    }
    accepted.push({ rowNumber: row.rowNumber, data: result.data });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let inserted = 0;
    const seen = new Set();
    for (const item of accepted) {
      if (type === 'visitors') {
        const key = [
          item.data.visit_date || new Date().toISOString().slice(0, 10),
          item.data.name.trim().toLowerCase(),
          item.data.contact_number,
          item.data.purpose,
        ].join('|');
        if (seen.has(key)) {
          duplicateCount += 1;
          rejected.push({ rowNumber: item.rowNumber, reason: 'duplicate' });
          continue;
        }
        seen.add(key);
        const purposeResult = await client.query(
          'SELECT 1 FROM purposes WHERE name = $1 AND active = true',
          [item.data.purpose],
        );
        if (!purposeResult.rowCount) {
          rejected.push({ rowNumber: item.rowNumber, reason: 'purpose: Select a valid active purpose' });
          continue;
        }
        const duplicateResult = await client.query(
          `SELECT 1 FROM visitor_logs
           WHERE voided = false AND visit_date = $1 AND lower(name) = $2
             AND contact_number = $3 AND purpose = $4
           LIMIT 1`,
          [key.split('|')[0], item.data.name.trim().toLowerCase(), item.data.contact_number, item.data.purpose],
        );
        if (duplicateResult.rowCount) {
          duplicateCount += 1;
          rejected.push({ rowNumber: item.rowNumber, reason: 'duplicate' });
          continue;
        }
        await client.query(
          `INSERT INTO visitor_logs
             (visit_date, name, gender, purpose, purpose_other, contact_number, created_by, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'import')`,
          [
            item.data.visit_date || new Date().toISOString().slice(0, 10),
            item.data.name,
            item.data.gender,
            item.data.purpose,
            item.data.purpose === 'Others' ? item.data.purpose_other : null,
            item.data.contact_number,
            req.user.id,
          ],
        );
      } else {
        const key = [
          item.data.response_date,
          item.data.email.trim().toLowerCase(),
          item.data.service_type,
          item.data.office,
        ].join('|');
        if (seen.has(key)) {
          duplicateCount += 1;
          rejected.push({ rowNumber: item.rowNumber, reason: 'duplicate' });
          continue;
        }
        seen.add(key);
        const duplicateResult = await client.query(
          `SELECT 1 FROM csm_responses
           WHERE response_date = $1 AND lower(email) = $2
             AND service_type = $3 AND office = $4
           LIMIT 1`,
          [item.data.response_date, item.data.email.trim().toLowerCase(), item.data.service_type, item.data.office],
        );
        if (duplicateResult.rowCount) {
          duplicateCount += 1;
          rejected.push({ rowNumber: item.rowNumber, reason: 'duplicate' });
          continue;
        }
        await client.query(
          `INSERT INTO csm_responses
             (response_date, email, age_group, age_other, sex, gender, gender_other, region, service_type, office)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            item.data.response_date,
            item.data.email,
            item.data.age_group,
            item.data.age_group === 'Other' ? item.data.age_other : null,
            item.data.sex,
            item.data.gender,
            item.data.gender === 'Other' ? item.data.gender_other : null,
            item.data.region,
            item.data.service_type,
            item.data.office,
          ],
        );
      }
      inserted += 1;
    }

    const { rows: batchRows } = await client.query(
      `INSERT INTO import_batches
         (filename, uploaded_by, row_count, success_count, error_count, duplicate_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed')
       RETURNING id`,
      [file.originalname, req.user.id, rows.length, inserted, rejected.length, duplicateCount],
    );
    await writeAudit(client, {
      actorId: req.user.id,
      action: 'import',
      entity: type === 'visitors' ? 'visitor_logs' : 'csm_responses',
      entityId: batchRows[0].id,
      details: {
        type,
        filename: file.originalname,
        row_count: rows.length,
        success_count: inserted,
        error_count: rejected.length,
        duplicate_count: duplicateCount,
      },
    });
    await client.query('COMMIT');

    res
      .status(200)
      .set({
        'X-Import-Row-Count': String(rows.length),
        'X-Import-Accepted': String(inserted),
        'X-Import-Rejected': String(rejected.length),
        'X-Import-Duplicates': String(duplicateCount),
        'Content-Disposition': `attachment; filename="${type}-rejections.csv"`,
      })
      .type('text/csv')
      .send(rejectionCsv(rejected));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

router.post('/visitors', upload.single('file'), asyncHandler((req, res) => (
  importRows(req, res, 'visitors', req.file)
)));

router.post('/csm', upload.single('file'), asyncHandler((req, res) => (
  importRows(req, res, 'csm', req.file)
)));

export default router;
