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

const AGE_GROUPS = ['18-25', '26-35', '36-45', '46-60', '60 and above (60 pataas)', 'Other'];

const CSM_COMMENTS = [
  'Mas mabilis at maayos ang proseso.',
  'Mabait at malinaw ang pagtulong ng tauhan.',
  'Naging simple ang aking transaksyon.',
  'Salamat sa mabilis na serbisyo.',
  'Malaking tulong ang gabay ng staff.',
  'Maayos ang pila at sakyan.',
  'Maganda ang serbisyo ng opisina.',
  'Mabilis ang sagot sa aking tanong.',
  'Kaaya-aya ang serbisyo.',
  'Nais kong purihin ang staff.',
  'Malinaw ang mga tagubilin.',
  'Mabilis at propesyonal ang pagtugon.',
  'May sapat na impormasyon.',
  'Masaya ang aking karanasan.',
  'Magalang at handang tumulong.',
  'Kumpleto ang tulong na natanggap.',
  'Maayos ang sistema ng appointment.',
  'Mabilis ang pagproseso.',
  'Matulunging tauhan.',
  'Nakatulong ang digital na serbisyo.',
  'Malinis at maayos na opisina.',
  'Mas madaling maunawaan ang proseso.',
  'Makatotohanang serbisyo.',
  'Walang habambuhay na paghihintay.',
  'Naging episyente ang transaksyon.',
  'Mabuting komunikasyon.',
  'Nakapagbigay ng tamang gabay.',
  'Maayos ang pag-aasikaso.',
  'Naging maginhawa ang pagbisita.',
  'Lubos na nagpapasalamat.',
  'Mabilis ang pagkumpleto.',
  'Mabagal lamang sa unang pila.',
  'Mas gusto ang malinaw na signage.',
  'Mas magiging maayos kung may dagdag na upuan.',
  'Ang staff ay madaling lapitan.',
  'Kaunting oras ang paghihintay.',
  'Maayos ang follow-up.',
  'Nakakatulong ang mga panuto.',
  'Mas malinaw ang proseso sa susunod.',
  'Naging positibo ang karanasan.',
];

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

function manilaTodayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function buildVisitor(index, createdBy) {
  const today = new Date(`${manilaTodayISO()}T00:00:00+08:00`);
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

function buildCsm(index) {
  const today = new Date(`${manilaTodayISO()}T00:00:00+08:00`);
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setMonth(start.getMonth() - 6);
  const spanDays = Math.round((today - start) / 86400000);
  const date = new Date(start.getTime() + randInt(spanDays + 1) * 86400000);

  const serviceType = pick(OFFICES)[1];
  const officeOptions = OFFICES.filter(([, type]) => type === serviceType);
  const ageGroup = index % 67 === 0 ? 'Other' : pick(AGE_GROUPS.filter((label) => label !== 'Other'));
  const gender = index % 71 === 0 ? 'Other' : pick(['Masculine', 'Feminine', 'Non-Binary', 'Prefer Not to Say']);
  return {
    responseDate: formatDate(date),
    email: `synthetic-csm-${index + 1}@example.com`,
    ageGroup,
    ageOther: ageGroup === 'Other' ? 'Retired client' : null,
    sex: pick(['Male', 'Female', 'Prefer not to say']),
    gender,
    genderOther: gender === 'Other' ? 'Custom identity' : null,
    region: pick(REGIONS),
    serviceType,
    office: pick(officeOptions)[0],
    comment: index < CSM_COMMENTS.length ? CSM_COMMENTS[index] : null,
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
              created_by, created_at, updated_at, voided, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, 'staff')`,
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

    const { rows: csmCountRows } = await client.query('SELECT count(*)::int AS count FROM csm_responses');
    const existingCsmCount = csmCountRows[0].count;
    if (existingCsmCount >= 150) {
      console.log(`CSM responses already present (${csmCountRows[0].count}); skipping CSM seed.`);
    } else {
      for (let index = existingCsmCount; index < 150; index += 1) {
        const response = buildCsm(index);
        await client.query(
          `INSERT INTO csm_responses
             (response_date, email, age_group, age_other, sex, gender, gender_other, region, service_type, office, comment)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            response.responseDate,
            response.email,
            response.ageGroup,
            response.ageOther,
            response.sex,
            response.gender,
            response.genderOther,
            response.region,
            response.serviceType,
            response.office,
            response.comment,
          ],
        );
      }
      console.log('Seeded 150 synthetic CSM responses over the last 6 months.');
    }

    const { rows: commentRows } = await client.query(
      `SELECT id FROM csm_responses ORDER BY id LIMIT 40`,
    );
    for (const [index, row] of commentRows.entries()) {
      await client.query(
        'UPDATE csm_responses SET comment=$1 WHERE id=$2',
        [CSM_COMMENTS[index], row.id],
      );
    }

    const { rows: otherRows } = await client.query(
      `SELECT id FROM csm_responses ORDER BY id LIMIT 3`,
    );
    if (otherRows.length) {
      await client.query(
        `UPDATE csm_responses
         SET age_group='Other', age_other='Retired client'
         WHERE id=$1`,
        [otherRows[0].id],
      );
    }
    if (otherRows.length > 1) {
      await client.query(
        `UPDATE csm_responses
         SET gender='Other', gender_other='Custom identity'
         WHERE id=$1`,
        [otherRows[1].id],
      );
    }

    await client.query('COMMIT');

    const { rows: summary } = await client.query(`
      SELECT
        (SELECT count(*)::int FROM purposes) AS purposes,
        (SELECT count(*)::int FROM offices) AS offices,
        (SELECT count(*)::int FROM regions) AS regions,
        (SELECT count(*)::int FROM age_groups) AS age_groups,
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM visitor_logs) AS visitor_logs,
        (SELECT count(*)::int FROM csm_responses) AS csm_responses
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
