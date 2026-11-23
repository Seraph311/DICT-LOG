import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../lib/http-error.js';
import { parseOrThrow } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { csmSchema } from '../validation/csm.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { analyticsSchema } from '../validation/dashboard.js';
import { z } from 'zod';

const commentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

const router = Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many survey submissions. Please try again later.' } },
});

router.get(
  '/comments',
  requireAuth,
  requireRole('reviewer', 'administrator'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parseOrThrow(commentsSchema, req.query);
    const offset = (page - 1) * pageSize;
    const [count, rows] = await Promise.all([
      pool.query(
        `SELECT count(*)::int AS total
         FROM csm_responses
         WHERE btrim(comment) <> ''`,
      ),
      pool.query(
        `SELECT response_date::text AS date, service_type, office, comment
         FROM csm_responses
         WHERE btrim(comment) <> ''
         ORDER BY response_date DESC, id DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset],
      ),
    ]);
    res.json({
      data: rows.rows,
      pagination: {
        page,
        pageSize,
        total: count.rows[0].total,
        totalPages: Math.ceil(count.rows[0].total / pageSize),
      },
    });
  }),
);

router.get(
  '/summary',
  requireAuth,
  requireRole('reviewer', 'administrator'),
  asyncHandler(async (req, res) => {
    const { from, to } = parseOrThrow(analyticsSchema, req.query);
    const values = [from, to];
    const [total, serviceType, office, ageGroup, region, sex, gender] = await Promise.all([
      pool.query(
        'SELECT count(*)::int AS total FROM csm_responses WHERE response_date BETWEEN $1 AND $2',
        values,
      ),
      pool.query(
        `SELECT service_type AS label, count(*)::int AS count
         FROM csm_responses WHERE response_date BETWEEN $1 AND $2
         GROUP BY service_type ORDER BY service_type`,
        values,
      ),
      pool.query(
        `SELECT office AS label, count(*)::int AS count
         FROM csm_responses WHERE response_date BETWEEN $1 AND $2
         GROUP BY office ORDER BY office`,
        values,
      ),
      pool.query(
        `SELECT age_group AS label, count(*)::int AS count
         FROM csm_responses WHERE response_date BETWEEN $1 AND $2
         GROUP BY age_group ORDER BY age_group`,
        values,
      ),
      pool.query(
        `SELECT region AS label, count(*)::int AS count
         FROM csm_responses WHERE response_date BETWEEN $1 AND $2
         GROUP BY region ORDER BY region`,
        values,
      ),
      pool.query(
        `SELECT sex AS label, count(*)::int AS count
         FROM csm_responses WHERE response_date BETWEEN $1 AND $2
         GROUP BY sex ORDER BY sex`,
        values,
      ),
      pool.query(
        `SELECT gender AS label, count(*)::int AS count
         FROM csm_responses WHERE response_date BETWEEN $1 AND $2
         GROUP BY gender ORDER BY gender`,
        values,
      ),
    ]);

    res.json({
      from,
      to,
      total: total.rows[0].total,
      byServiceType: serviceType.rows,
      byOffice: office.rows,
      byAgeGroup: ageGroup.rows,
      byRegion: region.rows,
      bySex: sex.rows,
      byGender: gender.rows,
    });
  }),
);

router.post(
  '/',
  submitLimiter,
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(csmSchema, req.body || {});
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO csm_responses
           (response_date, age_group, age_other, sex, gender, gender_other, region, service_type, office, comment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, response_date`,
        [
          data.response_date,
          data.age_group,
          data.age_group === 'Other' ? data.age_other : null,
          data.sex,
          data.gender,
          data.gender === 'Other' ? data.gender_other : null,
          data.region,
          data.service_type,
          data.office,
          data.comment || null,
        ],
      );

      await writeAudit(client, {
        actorId: null,
        action: 'create',
        entity: 'csm_response',
        entityId: rows[0].id,
        details: { response_date: data.response_date, service_type: data.service_type, office: data.office },
      });

      await client.query('COMMIT');
      res.status(201).json({ response: rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

export default router;
