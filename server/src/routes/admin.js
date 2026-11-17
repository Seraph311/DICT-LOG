import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../lib/http-error.js';
import { parseOrThrow } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth, requireRole('administrator'));

const idSchema = z.coerce.number().int().positive();
const roleSchema = z.enum(['front_desk', 'reviewer', 'administrator']);
const userCreateSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(50).regex(/^[a-z0-9_]+$/),
  full_name: z.string().trim().min(1).max(120),
  role: roleSchema,
  password: z.string().min(8).max(200),
});
const userPatchSchema = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  role: roleSchema.optional(),
  is_active: z.boolean().optional(),
});
const passwordSchema = z.object({ password: z.string().min(8).max(200) });
const lookupTypeSchema = z.enum(['purposes', 'offices', 'regions']);
const lookupCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  service_type: z
    .enum(['External/Serbisyong Panlabas', 'Internal/Serbisyong Panloob'])
    .optional(),
  active: z.boolean().optional(),
});
const lookupPatchSchema = lookupCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'Provide name or active',
);
const auditQuerySchema = z.object({
  action: z.enum(['create', 'edit', 'void', 'import', 'export']).optional(),
  user: z.string().trim().max(50).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['email', 'contact_number', 'password', 'password_hash'].includes(key))
      .map(([key, item]) => [key, redact(item)]),
  );
}

async function audit(client, req, action, entity, entityId, details) {
  await writeAudit(client, {
    actorId: req.user.id,
    action,
    entity,
    entityId,
    details,
  });
}

router.get('/users', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, username, full_name, role, is_active, created_at
     FROM users ORDER BY username`,
  );
  res.json({ users: rows.map(publicUser) });
}));

router.post('/users', asyncHandler(async (req, res) => {
  const data = parseOrThrow(userCreateSchema, req.body || {});
  const hash = await bcrypt.hash(data.password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO users (username, full_name, role, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, full_name, role, is_active, created_at`,
      [data.username, data.full_name, data.role, hash],
    );
    await audit(client, req, 'create', 'user', rows[0].id, { username: data.username, role: data.role });
    await client.query('COMMIT');
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new HttpError(409, 'Username already exists');
    throw error;
  } finally {
    client.release();
  }
}));

router.patch('/users/:id', asyncHandler(async (req, res) => {
  const id = parseOrThrow(idSchema, req.params.id);
  const data = parseOrThrow(userPatchSchema, req.body || {});
  if (id === req.user.id && data.is_active === false) {
    throw new HttpError(400, 'You cannot deactivate yourself');
  }
  if (id === req.user.id && data.role && data.role !== 'administrator') {
    throw new HttpError(400, 'You cannot demote yourself');
  }
  const fields = Object.entries(data);
  if (!fields.length) throw new HttpError(400, 'No changes to save');
  const sets = [];
  const values = [];
  for (const [field, value] of fields) {
    values.push(value);
    sets.push(`${field} = $${values.length}`);
  }
  values.push(id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE users SET ${sets.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, username, full_name, role, is_active, created_at`,
      values,
    );
    if (!rows[0]) throw new HttpError(404, 'User not found');
    await audit(client, req, data.is_active === undefined ? 'edit' : 'edit', 'user', id, {
      username: rows[0].username,
      changes: Object.fromEntries(fields.map(([key, value]) => [key, value])),
    });
    await client.query('COMMIT');
    res.json({ user: publicUser(rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
  const id = parseOrThrow(idSchema, req.params.id);
  const { password } = parseOrThrow(passwordSchema, req.body || {});
  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING username',
      [hash, id],
    );
    if (!rows[0]) throw new HttpError(404, 'User not found');
    await audit(client, req, 'edit', 'user', id, { username: rows[0].username, action: 'reset_password' });
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

const LOOKUPS = {
  purposes: { table: 'purposes', fields: ['name', 'active', 'is_other', 'sort_order'] },
  offices: { table: 'offices', fields: ['name', 'service_type', 'active'] },
  regions: { table: 'regions', fields: ['name', 'active', 'sort_order'] },
};

router.get('/lookups/:type', asyncHandler(async (req, res) => {
  const type = parseOrThrow(lookupTypeSchema, req.params.type);
  const lookup = LOOKUPS[type];
  const { rows } = await pool.query(
    `SELECT id, ${lookup.fields.join(', ')} FROM ${lookup.table} ORDER BY id`,
  );
  res.json({ items: rows });
}));

router.post('/lookups/:type', asyncHandler(async (req, res) => {
  const type = parseOrThrow(lookupTypeSchema, req.params.type);
  const data = parseOrThrow(lookupCreateSchema, req.body || {});
  if (type === 'offices' && !data.service_type) {
    throw new HttpError(400, 'service_type is required for offices');
  }
  if (type !== 'offices' && data.service_type) {
    throw new HttpError(400, 'service_type is only valid for offices');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let result;
    if (type === 'offices') {
      result = await client.query(
        'INSERT INTO offices (name, service_type) VALUES ($1, $2) RETURNING *',
        [data.name, data.service_type],
      );
    } else if (type === 'purposes') {
      result = await client.query(
        'INSERT INTO purposes (name) VALUES ($1) RETURNING *',
        [data.name],
      );
    } else {
      result = await client.query(
        'INSERT INTO regions (name) VALUES ($1) RETURNING *',
        [data.name],
      );
    }
    await audit(client, req, 'create', type.slice(0, -1), result.rows[0].id, { name: data.name });
    await client.query('COMMIT');
    res.status(201).json({ item: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new HttpError(409, 'Lookup already exists');
    throw error;
  } finally {
    client.release();
  }
}));

router.patch('/lookups/:type/:id', asyncHandler(async (req, res) => {
  const type = parseOrThrow(lookupTypeSchema, req.params.type);
  const id = parseOrThrow(idSchema, req.params.id);
  const data = parseOrThrow(lookupPatchSchema, req.body || {});
  if (type === 'offices' && data.service_type) {
    throw new HttpError(400, 'Office service_type cannot be changed');
  }
  if (type !== 'offices' && data.service_type) {
    throw new HttpError(400, 'service_type is only valid for offices');
  }
  const sets = [];
  const values = [];
  for (const field of ['name', 'active']) {
    if (data[field] !== undefined) {
      values.push(data[field]);
      sets.push(`${field} = $${values.length}`);
    }
  }
  values.push(id);
  const table = LOOKUPS[type].table;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!rows[0]) throw new HttpError(404, 'Lookup not found');
    await audit(client, req, 'edit', type.slice(0, -1), id, {
      changes: Object.fromEntries(Object.keys(data).filter((key) => data[key] !== undefined).map((key) => [key, data[key]])),
    });
    await client.query('COMMIT');
    res.json({ item: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new HttpError(409, 'Lookup already exists');
    throw error;
  } finally {
    client.release();
  }
}));

router.get('/audit', asyncHandler(async (req, res) => {
  const filters = parseOrThrow(auditQuerySchema, req.query);
  const conditions = [];
  const values = [];
  if (filters.action) {
    values.push(filters.action);
    conditions.push(`a.action = $${values.length}`);
  }
  if (filters.user) {
    values.push(`%${filters.user}%`);
    conditions.push(`(u.username ILIKE $${values.length} OR u.full_name ILIKE $${values.length})`);
  }
  if (filters.from) {
    values.push(filters.from);
    conditions.push(`a.created_at >= $${values.length}::date`);
  }
  if (filters.to) {
    values.push(filters.to);
    conditions.push(`a.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const count = await pool.query(
    `SELECT count(*)::int AS total FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ${where}`,
    values,
  );
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;
  const { rows } = await pool.query(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.created_at,
            u.username, u.full_name, a.details
     FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
     ${where}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    [...values, filters.pageSize, (filters.page - 1) * filters.pageSize],
  );
  res.json({
    data: rows.map((row) => ({
      ...row,
      details: redact(row.details),
    })),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: count.rows[0].total,
      totalPages: Math.ceil(count.rows[0].total / filters.pageSize),
    },
  });
}));

export default router;
