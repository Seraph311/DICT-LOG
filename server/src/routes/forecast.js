import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http-error.js';
import { parseOrThrow } from '../lib/validate.js';
import { calculateForecast } from '../forecast.js';
import { forecastQuerySchema } from '../validation/forecast.js';

const router = Router();

router.use(requireAuth, requireRole('reviewer', 'administrator'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { granularity } = parseOrThrow(forecastQuerySchema, req.query);
    const { rows } = await pool.query(
      `SELECT visit_date::text AS day, count(*)::int AS count
       FROM visitor_logs
       WHERE voided = false
       GROUP BY visit_date
       ORDER BY visit_date`,
    );
    res.json(calculateForecast({ daily: rows, granularity }));
  }),
);

export default router;
