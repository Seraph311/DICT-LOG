import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http-error.js';
import { parseOrThrow } from '../lib/validate.js';
import { analyticsSchema, monthSchema } from '../validation/dashboard.js';

const router = Router();

router.use(requireAuth, requireRole('reviewer', 'administrator'));

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const month = parseOrThrow(monthSchema, req.query.month);
    const { rows } = await pool.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE gender = 'Male')::int AS male,
         count(*) FILTER (WHERE gender = 'Female')::int AS female,
         (
           SELECT count(*)::int
           FROM visitor_logs AS today_logs
           WHERE today_logs.voided = false
             AND today_logs.visit_date = CURRENT_DATE
         ) AS today
       FROM visitor_logs
       WHERE voided = false
         AND visit_date >= to_date($1, 'YYYY-MM')
         AND visit_date < to_date($1, 'YYYY-MM') + INTERVAL '1 month'`,
      [month],
    );

    res.json({
      month,
      total: rows[0].total,
      male: rows[0].male,
      female: rows[0].female,
      today: rows[0].today,
    });
  }),
);

router.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    const { from, to } = parseOrThrow(analyticsSchema, req.query);
    const values = [from, to];
    const where = `
      WHERE voided = false
        AND visit_date >= $1
        AND visit_date <= $2`;

    const [purposeResult, dayResult, monthResult, genderResult] = await Promise.all([
      pool.query(
        `SELECT purpose, count(*)::int AS count
         FROM visitor_logs
         ${where}
         GROUP BY purpose
         ORDER BY count DESC, purpose`,
        values,
      ),
      pool.query(
        `SELECT visit_date::text AS day, count(*)::int AS count
         FROM visitor_logs
         ${where}
         GROUP BY visit_date
         ORDER BY visit_date`,
        values,
      ),
      pool.query(
        `SELECT to_char(date_trunc('month', visit_date), 'YYYY-MM') AS month,
                count(*)::int AS count
         FROM visitor_logs
         ${where}
         GROUP BY date_trunc('month', visit_date)
         ORDER BY date_trunc('month', visit_date)`,
        values,
      ),
      pool.query(
        `SELECT gender, count(*)::int AS count
         FROM visitor_logs
         ${where}
         GROUP BY gender
         ORDER BY gender`,
        values,
      ),
    ]);

    res.json({
      from,
      to,
      byPurpose: purposeResult.rows,
      byDay: dayResult.rows,
      byMonth: monthResult.rows,
      byGender: genderResult.rows,
    });
  }),
);

export default router;
