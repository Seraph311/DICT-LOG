import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool } from '../db/pool.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.nodeEnv === 'production',
  path: '/',
};

export function setSessionCookie(res, user) {
  const token = jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, {
    expiresIn: '8h',
  });
  res.cookie('token', token, { ...COOKIE_OPTIONS, maxAge: 8 * 60 * 60 * 1000 });
}

export function clearSessionCookie(res) {
  res.clearCookie('token', COOKIE_OPTIONS);
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: { message: 'Authentication required' } });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const { rows } = await pool.query(
      'SELECT id, username, full_name, role, is_active FROM users WHERE id = $1',
      [Number(payload.sub)],
    );
    const user = rows[0];

    if (!user || !user.is_active) {
      clearSessionCookie(res);
      return res.status(401).json({ error: { message: 'Session is no longer valid' } });
    }

    req.user = user;
    return next();
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ error: { message: 'Invalid or expired session' } });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Authentication required' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: 'You do not have access to this action' } });
    }
    return next();
  };
}
