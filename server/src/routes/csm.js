import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../lib/http-error.js';
import { parseOrThrow } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { csmSchema } from '../validation/csm.js';

const router = Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many survey submissions. Please try again later.' } },
});

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
