import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http-error.js';
import { parseOrThrow } from '../lib/validate.js';
import { analyticsSchema } from '../validation/dashboard.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();

router.use(requireAuth, requireRole('reviewer', 'administrator'));

async function loadSummary(from, to) {
  const values = [from, to];
  const [summary, purpose, gender, daily, csmServiceType, csmOffice, csmAgeGroup, csmRegion, csmSex] =
    await Promise.all([
      pool.query(
        `SELECT
           count(*)::int AS total,
           count(*) FILTER (WHERE gender = 'Male')::int AS male,
           count(*) FILTER (WHERE gender = 'Female')::int AS female,
           count(*) FILTER (
             WHERE visit_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date
           )::int AS today
         FROM visitor_logs
         WHERE voided = false AND visit_date BETWEEN $1 AND $2`,
        values,
      ),
      pool.query(
        `SELECT purpose AS label, count(*)::int AS count
         FROM visitor_logs WHERE voided = false AND visit_date BETWEEN $1 AND $2
         GROUP BY purpose ORDER BY purpose`,
        values,
      ),
      pool.query(
        `SELECT gender AS label, count(*)::int AS count
         FROM visitor_logs WHERE voided = false AND visit_date BETWEEN $1 AND $2
         GROUP BY gender ORDER BY gender`,
        values,
      ),
      pool.query(
        `SELECT visit_date::text AS label, count(*)::int AS count
         FROM visitor_logs WHERE voided = false AND visit_date BETWEEN $1 AND $2
         GROUP BY visit_date ORDER BY visit_date`,
        values,
      ),
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

  return {
    summary: summary.rows[0],
    purpose: purpose.rows,
    gender: gender.rows,
    daily: daily.rows,
    csm: {
      serviceType: csmServiceType.rows,
      office: csmOffice.rows,
      ageGroup: csmAgeGroup.rows,
      region: csmRegion.rows,
      sex: csmSex.rows,
    },
  };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRows(data) {
  const rows = [['section', 'label', 'count']];
  rows.push(['summary', 'total', data.summary.total]);
  rows.push(['summary', 'male', data.summary.male]);
  rows.push(['summary', 'female', data.summary.female]);
  rows.push(['summary', 'today', data.summary.today]);
  for (const [section, items] of [
    ['purpose', data.purpose],
    ['gender', data.gender],
    ['daily', data.daily],
    ['csm_service_type', data.csm.serviceType],
    ['csm_office', data.csm.office],
    ['csm_age_group', data.csm.ageGroup],
    ['csm_region', data.csm.region],
    ['csm_sex', data.csm.sex],
  ]) {
    for (const item of items) rows.push([section, item.label, item.count]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

async function auditExport(req, format, from, to) {
  await writeAudit(pool, {
    actorId: req.user.id,
    action: 'export',
    entity: 'summary',
    entityId: null,
    details: { format, from, to },
  });
}

router.get(
  '/summary.csv',
  asyncHandler(async (req, res) => {
    const { from, to } = parseOrThrow(analyticsSchema, req.query);
    const data = await loadSummary(from, to);
    await auditExport(req, 'csv', from, to);
    res
      .type('text/csv')
      .attachment(`visitor-summary-${from}-to-${to}.csv`)
      .send(csvRows(data));
  }),
);

router.get(
  '/summary.pdf',
  asyncHandler(async (req, res) => {
    const { from, to } = parseOrThrow(analyticsSchema, req.query);
    const data = await loadSummary(from, to);
    await auditExport(req, 'pdf', from, to);

    const document = new PDFDocument({ margin: 48 });
    res.type('application/pdf').attachment(`visitor-summary-${from}-to-${to}.pdf`);
    document.pipe(res);
    document.fontSize(18).text('DICT Camarines Norte Summary Export');
    document.fontSize(10).fillColor('#52637a').text(`Range: ${from} to ${to}`);
    document.moveDown();

    function section(title, rows) {
      document.fillColor('#0b3d91').fontSize(13).text(title);
      document.fillColor('#152238').fontSize(10);
      for (const row of rows) document.text(`${row.label}: ${row.count}`);
      document.moveDown(0.7);
    }

    section('Visitor summary', [
      { label: 'Total', count: data.summary.total },
      { label: 'Male', count: data.summary.male },
      { label: 'Female', count: data.summary.female },
      { label: 'Today', count: data.summary.today },
    ]);
    section('Visitors by purpose', data.purpose);
    section('Visitors by gender', data.gender);
    section('Daily visitors', data.daily);
    section('CSM by service type', data.csm.serviceType);
    section('CSM by office', data.csm.office);
    section('CSM by age group', data.csm.ageGroup);
    section('CSM by region', data.csm.region);
    section('CSM by sex', data.csm.sex);
    document.end();
  }),
);

export default router;
