import { pool } from '../src/db/pool.js';
import { config } from '../src/config.js';

const API_ORIGIN = process.env.API_ORIGIN || `http://localhost:${config.port}`;

function monthOffset(offset) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - offset);
  return date.toISOString().slice(0, 7);
}

function monthEnd(month) {
  const [year, value] = month.split('-').map(Number);
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
}

async function login() {
  const response = await fetch(`${API_ORIGIN}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'reviewer', password: config.seedDemoPassword }),
  });
  if (!response.ok) throw new Error(`Reviewer login failed (${response.status})`);
  const cookie = response.headers.get('set-cookie');
  if (!cookie) throw new Error('Reviewer login did not return a session cookie');
  return cookie.split(';', 1)[0];
}

async function verifyMonth(cookie, month) {
  const apiResponse = await fetch(
    `${API_ORIGIN}/api/dashboard/summary?month=${encodeURIComponent(month)}`,
    { headers: { cookie } },
  );
  if (!apiResponse.ok) throw new Error(`Dashboard API failed for ${month} (${apiResponse.status})`);
  const actual = await apiResponse.json();
  const { rows } = await pool.query(
    `SELECT
       count(*) FILTER (
         WHERE visit_date >= $1::date AND visit_date <= $2::date
       )::int AS total,
       count(*) FILTER (
         WHERE visit_date >= $1::date AND visit_date <= $2::date AND gender = 'Male'
       )::int AS male,
       count(*) FILTER (
         WHERE visit_date >= $1::date AND visit_date <= $2::date AND gender = 'Female'
       )::int AS female,
       (
         SELECT count(*)::int
         FROM visitor_logs
         WHERE voided = false
           AND visit_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date
       ) AS today
     FROM visitor_logs
     WHERE voided = false`,
    [`${month}-01`, monthEnd(month)],
  );
  const expected = { month, ...rows[0] };
  for (const key of ['total', 'male', 'female', 'today']) {
    if (actual[key] !== expected[key]) {
      throw new Error(`${month} mismatch for ${key}: API=${actual[key]} SQL=${expected[key]}`);
    }
  }
  console.log(`${month}: PASS`, { total: actual.total, male: actual.male, female: actual.female, today: actual.today });
}

try {
  const cookie = await login();
  for (let offset = 0; offset < 3; offset += 1) {
    await verifyMonth(cookie, monthOffset(offset));
  }
  console.log('Dashboard verification passed for 3 months.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
