import bcrypt from 'bcrypt';
import { pool } from '../src/db/pool.js';
import { config, isProduction } from '../src/config.js';

if (isProduction) {
  console.error('Refusing to run the seed script: NODE_ENV=production.');
  process.exit(1);
}

console.log('Seed notice: demo passwords are for DEVELOPMENT ONLY. Do not reuse them in production.');

const PURPOSES = [
  { name: 'PSA Appointment', isOther: false },
  { name: 'eGovPH app Assistance', isOther: false },
  { name: 'NBI Appointment', isOther: false },
  { name: 'SSS assistance', isOther: false },
  { name: 'Others', isOther: true },
];

const OFFICES = [
  ['Cybersecurity Bureau', 'External/Serbisyong Panlabas'],
  ['Government Digital Transformation Bureau', 'External/Serbisyong Panlabas'],
  ['ICT Literacy and Competency Development Bureau', 'External/Serbisyong Panlabas'],
  ['Infostructure Management Bureau', 'External/Serbisyong Panlabas'],
  ['Legal Service (External)', 'External/Serbisyong Panlabas'],
  ['Postal Regulation Division', 'External/Serbisyong Panlabas'],
  ['Regional Office (External)', 'External/Serbisyong Panlabas'],
  ['Consumer Complaint Center', 'External/Serbisyong Panlabas'],
  ['Administrative Service', 'Internal/Serbisyong Panloob'],
  ['Central Receiving and Releasing Unit', 'Internal/Serbisyong Panloob'],
  ['Finance Service', 'Internal/Serbisyong Panloob'],
  ['Legal Service (Internal)', 'Internal/Serbisyong Panloob'],
  ['Management Information Systems Service', 'Internal/Serbisyong Panloob'],
  ['Procurement Service', 'Internal/Serbisyong Panloob'],
  ['Regional Offices (Internal)', 'Internal/Serbisyong Panloob'],
];

const REGIONS = [
  'National Capital Region (NCR)',
  'Cordillera Administrative Region (CAR)',
  'Ilocos Region (Region I)',
  'Cagayan Valley (Region II)',
  'Central Luzon (Region III)',
  'CALABARZON (Region IV-A)',
  'MIMAROPA (Region IV-B)',
  'Bicol Region (Region V)',
  'Western Visayas (Region VI)',
  'Central Visayas (Region VII)',
  'Eastern Visayas (Region VIII)',
  'Zamboanga Peninsula (Region IX)',
  'Northern Mindanao (Region X)',
  'Davao Region (Region XI)',
  'SOCCSKSARGEN (Region XII)',
  'Caraga (Region XIII)',
  'BARMM',
];

const AGE_GROUPS = ['18-25', '26-35', '36-45', '46-60', '60 and above (60 pataas)'];

const DEMO_USERS = [
  { username: 'frontdesk', fullName: 'Faye Frontdesk', role: 'front_desk' },
  { username: 'reviewer', fullName: 'Rico Reviewer', role: 'reviewer' },
  { username: 'admin', fullName: 'Ada Administrator', role: 'administrator' },
];

const FIRST_NAMES = [
  'Maria', 'Jose', 'Juan', 'Ana', 'Mark', 'Angel', 'Joshua', 'Nicole', 'Carlo', 'Liza',
  'Miguel', 'Andrea', 'Paolo', 'Bea', 'Rafael', 'Kristine', 'Daniel', 'Michelle', 'Erwin',
  'Jasmine', 'Rodel', 'Camille', 'Arnel', 'Grace', 'Ferdinand', 'Rhea', 'Noel', 'Trisha',
];

const LAST_NAMES = [
  'Dela Cruz', 'Reyes', 'Santos', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres',
  'Flores', 'Ramos', 'Villanueva', 'Aquino', 'Castillo', 'Navarro', 'Salazar', 'Domingo',
  'Pascual', 'Rivera', 'Aguilar', 'Manalo', 'Rosales', 'Padilla', 'Soriano', 'Mercado',
];

const OTHER_PURPOSES = [
  'Barangay clearance inquiry',
  'Police clearance inquiry',
  'PhilHealth assistance',
  'Passport appointment',
  'TESDA course inquiry',
  'Scholarship inquiry',
];

const MOBILE_PREFIXES = [
  '0917', '0918', '0919', '0920', '0921', '0927', '0935', '0945', '0956', '0961', '0975', '0995',
];

function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20261111);

function randInt(max) {
  return Math.floor(random() * max);
}

function pick(list) {
  return list[randInt(list.length)];
}

function weightedPurpose() {
  const roll = random();
  if (roll < 0.3) return 'PSA Appointment';
  if (roll < 0.55) return 'eGovPH app Assistance';
  if (roll < 0.7) return 'NBI Appointment';
  if (roll < 0.85) return 'SSS assistance';
  return 'Others';
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildVisitor(index, createdBy) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setMonth(start.getMonth() - 6);
  const spanDays = Math.round((today - start) / 86400000);

  const date = new Date(start.getTime() + randInt(spanDays + 1) * 86400000);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  const visitDate = formatDate(date);

  const purpose = weightedPurpose();
  const genderRoll = random();
  const gender = genderRoll < 0.47 ? 'Male' : genderRoll < 0.98 ? 'Female' : 'Others';
  const contactNumber = `${pick(MOBILE_PREFIXES)}${String(randInt(10000000)).padStart(7, '0')}`;
  const hour = String(8 + randInt(8)).padStart(2, '0');
  const minute = String(randInt(60)).padStart(2, '0');
  const createdAt = `${visitDate}T${hour}:${minute}:00`;

  return {
    visitDate,
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    gender,
    purpose,
    purposeOther: purpose === 'Others' ? pick(OTHER_PURPOSES) : null,
    contactNumber,
    createdBy,
    createdAt,
    voided: index % 37 === 0,
  };
}

async function seedLookups(client) {
  for (const [index, purpose] of PURPOSES.entries()) {
    await client.query(
      `INSERT INTO purposes (name, is_other, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE
         SET is_other = EXCLUDED.is_other, sort_order = EXCLUDED.sort_order, active = true`,
      [purpose.name, purpose.isOther, index],
    );
  }

  for (const [name, serviceType] of OFFICES) {
    await client.query(
      `INSERT INTO offices (name, service_type)
       VALUES ($1, $2)
       ON CONFLICT (name, service_type) DO UPDATE SET active = true`,
      [name, serviceType],
    );
  }

  for (const [index, name] of REGIONS.entries()) {
    await client.query(
      `INSERT INTO regions (name, sort_order)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
      [name, index],
    );
  }

  for (const [index, label] of AGE_GROUPS.entries()) {
    await client.query(
      `INSERT INTO age_groups (label, sort_order)
       VALUES ($1, $2)
       ON CONFLICT (label) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
      [label, index],
    );
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await seedLookups(client);

    const passwordHash = await bcrypt.hash(config.seedDemoPassword, 12);
    const userIds = {};

    for (const user of DEMO_USERS) {
      const { rows } = await client.query(
        `INSERT INTO users (username, full_name, role, password_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO UPDATE
           SET full_name = EXCLUDED.full_name, role = EXCLUDED.role,
               password_hash = EXCLUDED.password_hash, is_active = true
         RETURNING id`,
        [user.username, user.fullName, user.role, passwordHash],
      );
      userIds[user.role] = rows[0].id;
    }

    const { rows: countRows } = await client.query('SELECT count(*)::int AS count FROM visitor_logs');
    if (countRows[0].count > 0) {
      console.log(`Visitor logs already present (${countRows[0].count}); skipping visitor seed.`);
    } else {
      for (let index = 0; index < 300; index += 1) {
        const visitor = buildVisitor(index, userIds.front_desk);
        await client.query(
          `INSERT INTO visitor_logs
             (visit_date, name, gender, purpose, purpose_other, contact_number,
              created_by, created_at, updated_at, voided)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)`,
          [
            visitor.visitDate,
            visitor.name,
            visitor.gender,
            visitor.purpose,
            visitor.purposeOther,
            visitor.contactNumber,
            visitor.createdBy,
            visitor.createdAt,
            visitor.voided,
          ],
        );
      }
      console.log('Seeded 300 synthetic visitor logs over the last 6 months.');
    }

    await client.query('COMMIT');

    const { rows: summary } = await client.query(`
      SELECT
        (SELECT count(*)::int FROM purposes) AS purposes,
        (SELECT count(*)::int FROM offices) AS offices,
        (SELECT count(*)::int FROM regions) AS regions,
        (SELECT count(*)::int FROM age_groups) AS age_groups,
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM visitor_logs) AS visitor_logs
    `);
    console.log('Seed complete:', summary[0]);
    console.log('Demo login: frontdesk / reviewer / admin, password from SEED_DEMO_PASSWORD.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
