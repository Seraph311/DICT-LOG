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
  const [summary, purpose, gender, daily, csmTotal, csmServiceType, csmOffice, csmAgeGroup, csmRegion, csmSex] =
    await Promise.all([
      pool.query(
        `SELECT
           count(*)::int AS total,
           count(*) FILTER (WHERE gender = 'Male')::int AS male,
           count(*) FILTER (WHERE gender = 'Female')::int AS female,
           count(*) FILTER (WHERE gender = 'Others')::int AS others
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
    ]);

  return {
    summary: summary.rows[0],
    purpose: purpose.rows,
    gender: gender.rows,
    daily: daily.rows,
    csm: {
      total: csmTotal.rows[0].total,
      serviceType: csmServiceType.rows,
      office: csmOffice.rows,
      ageGroup: csmAgeGroup.rows,
      region: csmRegion.rows,
      sex: csmSex.rows,
    },
  };
}

function csvCell(value) {
  const raw = String(value ?? '');
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function percent(count, total) {
  return total === 0 ? '0.0' : ((count / total) * 100).toFixed(1);
}

function reportText(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function asiaManilaStamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')} Asia/Manila`;
}

function dateRange(from, to) {
  const dates = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function weekday(date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${date}T00:00:00Z`));
}

function csvRows(data, from, to) {
  const rows = [
    ['DICT Camarines Norte - Visitor Summary Report'],
    ['Period', `${from} to ${to}`],
    ['Generated', asiaManilaStamp()],
    ['Note:', 'Voided records excluded. No personal data included.'],
    [],
    ['Visitor totals'],
    ['Measure', 'Count'],
    ['Total visitors', data.summary.total],
    ['Male', data.summary.male],
    ['Female', data.summary.female],
    ['Others', data.summary.others],
    [],
    ['Visitors by purpose'],
    ['Purpose', 'Count', 'Percent of total'],
  ];
  for (const item of data.purpose) {
    rows.push([item.label, item.count, percent(item.count, data.summary.total)]);
  }
  rows.push([], ['Visitors by gender'], ['Gender', 'Count', 'Percent']);
  for (const item of data.gender) {
    rows.push([item.label, item.count, percent(item.count, data.summary.total)]);
  }

  const dailyByDate = new Map(data.daily.map((item) => [item.label, item.count]));
  rows.push([], ['Visitors per day'], ['Date', 'Weekday', 'Count']);
  for (const date of dateRange(from, to)) {
    rows.push([date, weekday(date), dailyByDate.get(date) ?? 0]);
  }

  rows.push(
    [],
    ['Client satisfaction survey responses (separate from the visitor log)'],
    ['Responses in period', data.csm.total],
  );
  if (data.csm.total === 0) {
    rows.push(['No survey responses in this period']);
  } else {
    for (const [title, items] of [
      ['Service type', data.csm.serviceType],
      ['Office', data.csm.office],
      ['Age group', data.csm.ageGroup],
      ['Region of residence', data.csm.region],
      ['Sex', data.csm.sex],
    ]) {
      rows.push([], [title], ['Label', 'Responses', 'Percent']);
      for (const item of items) rows.push([item.label, item.count, percent(item.count, data.csm.total)]);
    }
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
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
      .send(csvRows(data, from, to));
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
    document.fontSize(18).text('DICT Camarines Norte - Visitor Summary Report');
    document.fontSize(10).fillColor('#52637a').text(`Period: ${from} to ${to}`);
    document.text(`Generated: ${asiaManilaStamp()}`);
    document.text('Note: Voided records excluded. No personal data included.');
    document.moveDown();

    function section(title, headers, rows) {
      document.fillColor('#0b3d91').fontSize(13).text(title);
      document.fillColor('#152238').fontSize(10);
      if (headers) document.font('Helvetica-Bold').text(headers.join(', ')).font('Helvetica');
      for (const row of rows) document.text(row.map(reportText).join(', '));
      document.moveDown(0.7);
    }

    section('Visitor totals', ['Measure', 'Count'], [
      ['Total visitors', data.summary.total],
      ['Male', data.summary.male],
      ['Female', data.summary.female],
      ['Others', data.summary.others],
    ]);
    section('Visitors by purpose', ['Purpose', 'Count', 'Percent of total'],
      data.purpose.map((item) => [item.label, item.count, percent(item.count, data.summary.total)]));
    section('Visitors by gender', ['Gender', 'Count', 'Percent'],
      data.gender.map((item) => [item.label, item.count, percent(item.count, data.summary.total)]));

    const dailyByDate = new Map(data.daily.map((item) => [item.label, item.count]));
    section('Visitors per day', ['Date', 'Weekday', 'Count'],
      dateRange(from, to).map((date) => [date, weekday(date), dailyByDate.get(date) ?? 0]));

    document.fillColor('#0b3d91').fontSize(13).text('Client satisfaction survey responses (separate from the visitor log)');
    document.fillColor('#152238').fontSize(10);
    document.text(`Responses in period, ${data.csm.total}`);
    if (data.csm.total === 0) {
      document.text('No survey responses in this period');
    } else {
      for (const [title, items] of [
        ['Service type', data.csm.serviceType],
        ['Office', data.csm.office],
        ['Age group', data.csm.ageGroup],
        ['Region of residence', data.csm.region],
        ['Sex', data.csm.sex],
      ]) {
        section(title, ['Label', 'Responses', 'Percent'],
          items.map((item) => [item.label, item.count, percent(item.count, data.csm.total)]));
      }
    }
    document.end();
  }),
);

export default router;
