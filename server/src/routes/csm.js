import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../lib/http-error.js';
import { parseOrThrow } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { csmSchema } from '../validation/csm.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many survey submissions. Please try again later.' } },
});

router.get(
  '/summary',
  requireAuth,
  requireRole('reviewer', 'administrator'),
  asyncHandler(async (req, res) => {
    const [serviceType, office, ageGroup, region, sex] = await Promise.all([
      pool.query(
        'SELECT service_type AS label, count(*)::int AS count FROM csm_responses GROUP BY service_type ORDER BY service_type',
      ),
      pool.query(
        'SELECT office AS label, count(*)::int AS count FROM csm_responses GROUP BY office ORDER BY office',
      ),
      pool.query(
        'SELECT age_group AS label, count(*)::int AS count FROM csm_responses GROUP BY age_group ORDER BY age_group',
      ),
      pool.query(
        'SELECT region AS label, count(*)::int AS count FROM csm_responses GROUP BY region ORDER BY region',
      ),
      pool.query(
        'SELECT sex AS label, count(*)::int AS count FROM csm_responses GROUP BY sex ORDER BY sex',
      ),
    ]);

    res.json({
      byServiceType: serviceType.rows,
      byOffice: office.rows,
      byAgeGroup: ageGroup.rows,
      byRegion: region.rows,
      bySex: sex.rows,
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
           (response_date, email, age_group, sex, gender, region, service_type, office)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, response_date`,
        [
          data.response_date,
          data.email,
          data.age_group,
          data.sex,
          data.gender,
          data.region,
          data.service_type,
          data.office,
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
