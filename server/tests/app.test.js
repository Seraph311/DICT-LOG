import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';

const password = 'Demo#2026';
const roles = ['anonymous', 'front_desk', 'reviewer', 'administrator'];
const users = {};

async function login(username) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password });
  expect(response.status, `${username}: ${JSON.stringify(response.body)}`).toBe(200);
  return response.headers['set-cookie'][0];
}

function withCookie(agent, role) {
  return role === 'anonymous' ? agent : agent.set('Cookie', users[role]);
}

beforeAll(async () => {
  for (const role of ['front_desk', 'reviewer', 'administrator']) {
    const username = role === 'front_desk' ? 'frontdesk' : role === 'administrator' ? 'admin' : 'reviewer';
    users[role] = await login(username);
  }
});

afterAll(async () => {
  await pool.end();
});

describe('validation', () => {
  it.each([
    ['/api/visitors/public', { name: 'Bad Phone', gender: 'Male', purpose: 'PSA Appointment', contact_number: '123', website: '' }],
    ['/api/csm', { response_date: '2026-11-18', email: 'bad', age_group: '18-25', sex: 'Female', gender: 'Feminine', region: 'Bicol Region (Region V)', service_type: 'External/Serbisyong Panlabas', office: 'Cybersecurity Bureau' }],
    ['/api/visitors/public', { name: 'Bad Purpose', gender: 'Male', purpose: 'Unknown', contact_number: '09171234567', website: '' }],
    ['/api/csm', { response_date: '2026-11-18', email: 'x@example.com', age_group: '18-25', sex: 'Female', gender: 'Feminine', region: 'Bicol Region (Region V)', service_type: 'External/Serbisyong Panlabas', office: 'Finance Service' }],
    ['/api/visitors', { visit_date: '2999-01-01', name: 'Future', gender: 'Male', purpose: 'PSA Appointment', contact_number: '09171234567' }],
    ['/api/visitors/public', { name: 'Bot', gender: 'Male', purpose: 'PSA Appointment', contact_number: '09171234567', website: 'filled' }],
  ])('%s rejects invalid input', async (path, body) => {
    let req = request(app).post(path).send(body);
    if (path === '/api/visitors') req = req.set('Cookie', users.front_desk);
    const response = await req;
    expect(response.status).toBe(400);
  });
});

describe('role matrix', () => {
  const cases = [
    ['dashboard summary', 'get', '/api/dashboard/summary?month=2026-11', [401, 403, 200, 200]],
    ['dashboard analytics', 'get', '/api/dashboard/analytics?from=2026-11-01&to=2026-11-30', [401, 403, 200, 200]],
    ['forecast', 'get', '/api/forecast?granularity=week', [401, 403, 200, 200]],
    ['csm summary', 'get', '/api/csm/summary', [401, 403, 200, 200]],
    ['csv export', 'get', '/api/export/summary.csv?from=2026-11-01&to=2026-11-30', [401, 403, 200, 200]],
    ['admin users', 'get', '/api/admin/users', [401, 403, 403, 200]],
    ['admin regions', 'get', '/api/admin/lookups/regions', [401, 403, 403, 200]],
    ['admin audit', 'get', '/api/admin/audit', [401, 403, 403, 200]],
    ['visitor list', 'get', '/api/visitors', [401, 200, 403, 200]],
  ];

  it.each(cases)('%s follows anonymous/front_desk/reviewer/administrator statuses', async (_name, method, path, expected) => {
    const actual = [];
    for (const role of roles) {
      const response = withCookie(request(app)[method](path), role);
      actual.push((await response).status);
    }
    expect(actual).toEqual(expected);
  });

  it('protects multipart import', async () => {
    const actual = [];
    for (const role of roles) {
      let req = request(app).post('/api/import/visitors').attach('file', Buffer.from('name,gender,purpose,contact_number\nA,Male,PSA Appointment,09171234567'), 'x.csv');
      if (role !== 'anonymous') req = req.set('Cookie', users[role]);
      actual.push((await req).status);
    }
    expect(actual).toEqual([401, 403, 403, 200]);
  });
});

describe('audit and data integrity', () => {
  it('writes sanitized audit rows for create, edit, void, import, and export', async () => {
    const before = await pool.query(`SELECT action, count(*)::int AS count FROM audit_log GROUP BY action`);
    await request(app).post('/api/visitors').set('Cookie', users.front_desk).send({
      name: 'Audit Test', gender: 'Male', purpose: 'PSA Appointment', contact_number: '09170000009',
    }).expect(201);
    const created = await pool.query(`SELECT id FROM visitor_logs WHERE name='Audit Test' ORDER BY id DESC LIMIT 1`);
    await request(app).patch(`/api/visitors/${created.rows[0].id}`).set('Cookie', users.front_desk).send({ name: 'Audit Edited' }).expect(200);
    await request(app).post(`/api/visitors/${created.rows[0].id}/void`).set('Cookie', users.front_desk).send({ reason: 'test' }).expect(200);
    await request(app).post('/api/import/visitors').set('Cookie', users.administrator).attach('file', Buffer.from('visit_date,name,gender,purpose,contact_number\n2026-11-17,Audit Import,Male,PSA Appointment,09170000008'), 'x.csv').expect(200);
    await request(app).get('/api/export/summary.csv?from=2026-11-01&to=2026-11-30').set('Cookie', users.reviewer).expect(200);
    const after = await pool.query(`SELECT action, details::text AS details FROM audit_log WHERE action IN ('create','edit','void','import','export')`);
    for (const row of after.rows) {
      expect(row.details).not.toMatch(/09170000009|09170000008|@|password/i);
    }
    expect(after.rows.length).toBeGreaterThan(before.rows.reduce((sum, row) => sum + row.count, 0));
  });

  it('matches dashboard summary to an independent SQL query including month end', async () => {
    await pool.query(`INSERT INTO visitor_logs (visit_date,name,gender,purpose,contact_number,created_by,source) VALUES ('2026-10-31','Boundary Test','Female','PSA Appointment','09170000007',2,'staff')`);
    const independent = await pool.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE gender='Male')::int AS male, count(*) FILTER (WHERE gender='Female')::int AS female FROM visitor_logs WHERE voided=false AND visit_date BETWEEN '2026-10-01' AND '2026-10-31'`);
    const response = await request(app).get('/api/dashboard/summary?month=2026-10').set('Cookie', users.reviewer).expect(200);
    expect(response.body).toMatchObject(independent.rows[0]);
  });

  it('skips import duplicates and rejects a deactivated user cookie', async () => {
    const csv = 'visit_date,name,gender,purpose,contact_number\n2026-11-17,Unique Import,Male,PSA Appointment,09170000006\n2026-11-17,Unique Import,Male,PSA Appointment,09170000006';
    const first = await request(app).post('/api/import/visitors').set('Cookie', users.administrator).attach('file', Buffer.from(csv), 'dupes.csv').expect(200);
    expect(first.headers['x-import-accepted']).toBe('1');
    expect(first.headers['x-import-duplicates']).toBe('1');
    const admin = await pool.query(`SELECT id FROM users WHERE username='admin'`);
    await pool.query('UPDATE users SET is_active=false WHERE id=$1', [admin.rows[0].id]);
    await request(app).get('/api/admin/users').set('Cookie', users.administrator).expect(401);
  });
});

describe('export privacy', () => {
  it('has a positive control and no personal data', async () => {
    const csv = await request(app).get('/api/export/summary.csv?from=2026-11-01&to=2026-11-30').set('Cookie', users.reviewer).expect(200);
    expect(csv.text).toContain('summary,total');
    expect(csv.text).not.toMatch(/Maria Dela Cruz|0917\d{7}|@/);
    expect(csv.text).not.toMatch(/^[=+\-@]/m);
  });
});
