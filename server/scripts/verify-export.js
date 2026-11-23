import assert from 'node:assert/strict';
import { PDFParse } from 'pdf-parse';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config.js';

const API_ORIGIN = process.env.API_ORIGIN || `http://localhost:${config.port}`;
const PHONE_PATTERN = /(?:09\d{9}|\+639\d{9})/;

function assertNoPersonalData(text, names, phones, label) {
  for (const name of names) {
    assert(!text.includes(name), `${label} contains seeded name: ${name}`);
  }
  for (const phone of phones) {
    assert(!text.includes(phone), `${label} contains seeded phone: ${phone}`);
  }
  assert(!text.includes('@'), `${label} contains an @ character`);
  assert(!PHONE_PATTERN.test(text), `${label} contains a Philippine phone pattern`);
}

async function login(username, password) {
  const response = await fetch(`${API_ORIGIN}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200, `${username} login should return 200`);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

async function fetchExport(cookie, path) {
  const response = await fetch(`${API_ORIGIN}${path}`, { headers: { cookie } });
  assert.equal(response.status, 200, `${path} should return 200`);
  return Buffer.from(await response.arrayBuffer());
}

const reviewerCookie = await login('reviewer', config.seedDemoPassword);
const frontDeskCookie = await login('frontdesk', config.seedDemoPassword);
const from = '2026-11-01';
const to = '2026-11-30';
const query = `from=${from}&to=${to}`;

const { rows: people } = await pool.query(
  `SELECT name, contact_number
   FROM visitor_logs
   WHERE source = 'staff'
   ORDER BY id
   LIMIT 20`,
);
const { rows: emails } = await pool.query(
  'SELECT email FROM csm_responses ORDER BY id LIMIT 5',
);
assert.equal(people.length, 20, 'Expected 20 seeded visitor rows');
assert.equal(emails.length, 5, 'Expected 5 seeded CSM emails');

const { rows: beforeAudit } = await pool.query(
  `SELECT count(*)::int AS count
   FROM audit_log
   WHERE action = 'export'
     AND actor_id = (SELECT id FROM users WHERE username = 'reviewer')`,
);

const csvBytes = await fetchExport(reviewerCookie, `/api/export/summary.csv?${query}`);
const pdfBytes = await fetchExport(reviewerCookie, `/api/export/summary.pdf?${query}`);
const csvText = csvBytes.toString('utf8');
const pdfParser = new PDFParse({ data: pdfBytes });
const pdfResult = await pdfParser.getText();
await pdfParser.destroy();
const pdfText = pdfResult.text;

assert(csvBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), 'CSV is missing UTF-8 BOM');
assert(csvText.includes('DICT Camarines Norte - Visitor Summary Report'), 'CSV positive control missing report title');
assert(csvText.includes('Visitor totals'), 'CSV positive control missing Visitor totals section');
assert(csvText.includes('Period,2026-11-01 to 2026-11-30'), 'CSV positive control missing period');
assert(!csvText.includes(',Today,'), 'CSV unexpectedly contains Today export row');
assert(pdfText.trim().length > 0, 'PDF extraction returned empty text');
assert(pdfText.includes('DICT Camarines Norte - Visitor Summary Report'), 'PDF positive control missing report title');
assert(pdfText.includes('Visitor totals'), 'PDF positive control missing Visitor totals heading');
assert(pdfText.includes('Period: 2026-11-01 to 2026-11-30'), 'PDF positive control missing period');
assert(pdfText.includes('Client satisfaction survey responses (separate from the visitor log)'), 'PDF positive control missing CSM section');

const names = people.map((row) => row.name);
const phones = people.map((row) => row.contact_number);
assertNoPersonalData(csvText, names, phones, 'CSV');
assertNoPersonalData(pdfText, names, phones, 'PDF');
for (const { email } of emails) {
  assert(!csvText.includes(email), `CSV contains seeded CSM email: ${email}`);
  assert(!pdfText.includes(email), `PDF contains seeded CSM email: ${email}`);
}

const frontDeskExport = await fetch(
  `${API_ORIGIN}/api/export/summary.csv?${query}`,
  { headers: { cookie: frontDeskCookie } },
);
assert.equal(frontDeskExport.status, 403, 'front_desk export should return 403');
const anonymousExport = await fetch(`${API_ORIGIN}/api/export/summary.csv?${query}`);
assert.equal(anonymousExport.status, 401, 'anonymous export should return 401');

const { rows: afterAudit } = await pool.query(
  `SELECT count(*)::int AS count
   FROM audit_log
   WHERE action = 'export'
     AND actor_id = (SELECT id FROM users WHERE username = 'reviewer')`,
);
assert(afterAudit[0].count >= beforeAudit[0].count + 2, 'Export audit rows were not written');

const { rows: auditRows } = await pool.query(
  `SELECT details
   FROM audit_log
   WHERE action = 'export'
     AND actor_id = (SELECT id FROM users WHERE username = 'reviewer')
   ORDER BY id DESC
   LIMIT 2`,
);
for (const row of auditRows) {
  const details = JSON.stringify(row.details);
  assert(!details.includes('@'), 'Export audit details contain an email');
  assert(!PHONE_PATTERN.test(details), 'Export audit details contain a phone number');
}

console.log('verify-export: PASS');
console.log('reviewer CSV/PDF: 200');
console.log('front_desk export: 403');
console.log('anonymous export: 401');
console.log('PDF extraction positive control: PASS');
console.log('CSV/PDF personal-data checks: PASS');
console.log('export audit rows and privacy check: PASS');
await pool.end();
