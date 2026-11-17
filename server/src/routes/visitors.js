import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../lib/http-error.js';
import { parseOrThrow } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import {
  createVisitorSchema,
  idSchema,
  listVisitorsSchema,
  publicVisitorSchema,
  todayISO,
  updateVisitorSchema,
  voidVisitorSchema,
} from '../validation/visitors.js';

const router = Router();

const publicVisitorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many visitor submissions. Please try again later.' } },
});

router.post(
  '/public',
  publicVisitorLimiter,
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(publicVisitorSchema, {
      ...(req.body || {}),
      visit_date: undefined,
    });
    const purposeOther = data.purpose === 'Others' ? data.purpose_other : null;
    await assertPurpose(pool, data.purpose);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO visitor_logs
           (visit_date, name, gender, purpose, purpose_other, contact_number, created_by, source)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, 'public')
         RETURNING id`,
        [
          todayISO(),
          data.name,
          data.gender,
          data.purpose,
          purposeOther,
          data.contact_number,
        ],
      );

      await writeAudit(client, {
        actorId: null,
        action: 'create',
        entity: 'visitor_log',
        entityId: rows[0].id,
        details: { source: 'public' },
      });

      await client.query('COMMIT');
      res.status(201).json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

router.use(requireAuth, requireRole('front_desk', 'administrator'));

const EDITABLE_FIELDS = [
  'visit_date',
  'name',
  'gender',
  'purpose',
  'purpose_other',
  'contact_number',
];

function snapshot(row) {
  return {
    visit_date: row.visit_date,
    name: row.name,
    gender: row.gender,
    purpose: row.purpose,
    purpose_other: row.purpose_other,
  };
}

function diffSnapshots(before, after) {
  const changes = {};
  for (const key of Object.keys(before)) {
    const from = before[key] ?? null;
    const to = after[key] ?? null;
    if (String(from) !== String(to)) {
      changes[key] = { from, to };
    }
  }
  return changes;
}

async function assertPurpose(client, purpose) {
  const { rowCount } = await client.query(
    'SELECT 1 FROM purposes WHERE name = $1 AND active = true',
    [purpose],
  );
  if (rowCount === 0) {
    throw new HttpError(400, 'Validation failed', { purpose: 'Select a valid purpose' });
  }
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(createVisitorSchema, req.body || {});
    const visitDate =
      req.user.role === 'administrator' && data.visit_date ? data.visit_date : todayISO();
    const purposeOther = data.purpose === 'Others' ? data.purpose_other : null;

    await assertPurpose(pool, data.purpose);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO visitor_logs
           (visit_date, name, gender, purpose, purpose_other, contact_number, created_by, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'staff')
         RETURNING *`,
        [
          visitDate,
          data.name,
          data.gender,
          data.purpose,
          purposeOther,
          data.contact_number,
          req.user.id,
        ],
      );
      const visitor = rows[0];

      await writeAudit(client, {
        actorId: req.user.id,
        action: 'create',
        entity: 'visitor_log',
        entityId: visitor.id,
        details: { after: snapshot(visitor) },
      });

      await client.query('COMMIT');
      res.status(201).json({ visitor });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = parseOrThrow(listVisitorsSchema, req.query);
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new HttpError(400, 'Validation failed', { to: 'End date must be on or after start date' });
    }

    const conditions = [];
    const values = [];

    if (filters.q) {
      values.push(`%${filters.q}%`);
      conditions.push(`name ILIKE $${values.length}`);
    }
    if (filters.from) {
      values.push(filters.from);
      conditions.push(`visit_date >= $${values.length}`);
    }
    if (filters.to) {
      values.push(filters.to);
      conditions.push(`visit_date <= $${values.length}`);
    }
    if (filters.purpose) {
      values.push(filters.purpose);
      conditions.push(`purpose = $${values.length}`);
    }
    if (!filters.includeVoided) {
      conditions.push('voided = false');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: countRows } = await pool.query(
      `SELECT count(*)::int AS total FROM visitor_logs ${where}`,
      values,
    );

    values.push(filters.pageSize);
    const limitIndex = values.length;
    values.push((filters.page - 1) * filters.pageSize);
    const offsetIndex = values.length;

    const { rows } = await pool.query(
      `SELECT id, visit_date, name, gender, purpose, purpose_other, contact_number,
              created_by, created_at, updated_at, voided
       FROM visitor_logs
       ${where}
       ORDER BY visit_date DESC, id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    );

    const total = countRows[0].total;
    res.json({
      data: rows,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseOrThrow(idSchema, req.params.id);
    const data = parseOrThrow(updateVisitorSchema, req.body || {});

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: existingRows } = await client.query(
        'SELECT * FROM visitor_logs WHERE id = $1 FOR UPDATE',
        [id],
      );
      const existing = existingRows[0];

      if (!existing) {
        throw new HttpError(404, 'Visitor log not found');
      }
      if (existing.voided) {
        throw new HttpError(409, 'Voided visitor logs cannot be edited');
      }

      if (data.visit_date) {
        if (req.user.role !== 'administrator' && data.visit_date !== existing.visit_date) {
          throw new HttpError(403, 'Only administrators may change the visit date');
        }
        if (data.visit_date === existing.visit_date) {
          delete data.visit_date;
        }
      }

      if (data.purpose) {
        await assertPurpose(client, data.purpose);
      }

      const nextPurpose = data.purpose ?? existing.purpose;
      let nextPurposeOther =
        data.purpose_other !== undefined ? data.purpose_other : existing.purpose_other;
      if (nextPurpose !== 'Others') nextPurposeOther = null;

      if (nextPurpose === 'Others' && !nextPurposeOther) {
        throw new HttpError(400, 'Validation failed', {
          purpose_other: 'Describe the purpose when Others is selected',
        });
      }

      if ('purpose' in data || 'purpose_other' in data) {
        data.purpose = nextPurpose;
        data.purpose_other = nextPurposeOther;
      }

      const sets = [];
      const values = [];
      for (const field of EDITABLE_FIELDS) {
        if (field in data) {
          values.push(data[field] ?? null);
          sets.push(`${field} = $${values.length}`);
        }
      }

      if (sets.length === 0) {
        throw new HttpError(400, 'No changes to save');
      }

      values.push(id);
      const { rows } = await client.query(
        `UPDATE visitor_logs
         SET ${sets.join(', ')}, updated_at = now()
         WHERE id = $${values.length}
         RETURNING *`,
        values,
      );
      const updated = rows[0];

      const changes = diffSnapshots(snapshot(existing), snapshot(updated));
      if (existing.contact_number !== updated.contact_number) {
        changes.contact_number = 'changed';
      }

      await writeAudit(client, {
        actorId: req.user.id,
        action: 'edit',
        entity: 'visitor_log',
        entityId: updated.id,
        details: { changes },
      });

      await client.query('COMMIT');
      res.json({ visitor: updated });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

router.post(
  '/:id/void',
  asyncHandler(async (req, res) => {
    const id = parseOrThrow(idSchema, req.params.id);
    const { reason } = parseOrThrow(voidVisitorSchema, req.body || {});

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: existingRows } = await client.query(
        'SELECT * FROM visitor_logs WHERE id = $1 FOR UPDATE',
        [id],
      );
      const existing = existingRows[0];

      if (!existing) {
        throw new HttpError(404, 'Visitor log not found');
      }
      if (existing.voided) {
        throw new HttpError(409, 'Visitor log is already voided');
      }

      const { rows } = await client.query(
        `UPDATE visitor_logs
         SET voided = true, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [id],
      );
      const visitor = rows[0];

      await writeAudit(client, {
        actorId: req.user.id,
        action: 'void',
        entity: 'visitor_log',
        entityId: visitor.id,
        details: { reason: reason ?? null },
      });

      await client.query('COMMIT');
      res.json({ visitor });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

export default router;
