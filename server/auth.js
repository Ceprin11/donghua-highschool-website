import crypto from 'node:crypto';
import { LIMITS, getPublicOrigin } from './config.js';
import { now } from './db.js';

const COOKIE_NAME = 'sid';
// RFC 7914's interactive profile is deliberately expensive enough for the
// single administrator account while remaining practical on the target VPS.
const SCRYPT_OPTIONS = Object.freeze({ N: 131_072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });

function token(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
    const error = new Error('Password must be between 12 and 256 characters');
    error.code = 'INVALID_PASSWORD';
    error.statusCode = 400;
    throw error;
  }
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, SCRYPT_OPTIONS);
  return { hash: derived.toString('base64url'), salt: salt.toString('base64url') };
}

export function verifyPassword(password, hash, salt) {
  if (typeof password !== 'string' || !hash || !salt) return false;
  try {
    const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64url'), 64, SCRYPT_OPTIONS);
    const expected = Buffer.from(hash, 'base64url');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function hasAdmin(db) {
  return Boolean(db.prepare('SELECT 1 FROM admins LIMIT 1').get());
}

export function createAdmin(db, username, password) {
  const cleanUsername = String(username || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/u.test(cleanUsername)) {
    const error = new Error('Username must contain 3-64 letters, numbers, dots, underscores or hyphens');
    error.statusCode = 400;
    error.code = 'INVALID_USERNAME';
    throw error;
  }
  const { hash, salt } = hashPassword(password);
  const id = crypto.randomUUID();
  const timestamp = now();
  try {
    db.prepare('INSERT INTO admins(id, username, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, cleanUsername, hash, salt, timestamp, timestamp);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      error.statusCode = 409;
      error.code = 'USERNAME_EXISTS';
    }
    throw error;
  }
  return { id, username: cleanUsername };
}

export function resetAdminPassword(db, username, password) {
  const { hash, salt } = hashPassword(password);
  const result = db.prepare('UPDATE admins SET password_hash = ?, password_salt = ?, updated_at = ? WHERE username = ?')
    .run(hash, salt, now(), String(username || '').trim());
  if (!result.changes) {
    const error = new Error('Administrator not found');
    error.statusCode = 404;
    error.code = 'ADMIN_NOT_FOUND';
    throw error;
  }
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE admin_id = ?').run(now(), db.prepare('SELECT id FROM admins WHERE username = ?').get(String(username || '').trim()).id);
}

function parseCookie(header) {
  if (!header) return '';
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === COOKIE_NAME) {
      try { return decodeURIComponent(value.join('=')); } catch { return ''; }
    }
  }
  return '';
}

export function setSessionCookie(res, sessionId, publicOrigin, secureOverride) {
  const secure = secureOverride ?? new URL(publicOrigin).protocol === 'https:';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(LIMITS.sessionMs / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res, publicOrigin, secureOverride) {
  const secure = secureOverride ?? new URL(publicOrigin).protocol === 'https:';
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function loadSession(db, req) {
  const id = parseCookie(req.headers.cookie);
  if (!id || !/^[A-Za-z0-9_-]{30,}$/u.test(id)) return null;
  const row = db.prepare(`
    SELECT s.id, s.admin_id, s.csrf_token, s.created_at, s.last_seen_at, s.expires_at,
           a.username
      FROM sessions s LEFT JOIN admins a ON a.id = s.admin_id
     WHERE s.id = ? AND s.revoked_at IS NULL
  `).get(id);
  if (!row) return null;
  if (Date.parse(row.expires_at) <= Date.now()) {
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(now(), row.id);
    return null;
  }
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(now(), row.id);
  return row;
}

export function createSession(db, adminId = null) {
  const id = token(32);
  const csrfToken = token(32);
  const timestamp = now();
  const expires = new Date(Date.now() + LIMITS.sessionMs).toISOString();
  db.prepare('INSERT INTO sessions(id, admin_id, csrf_token, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, adminId, csrfToken, timestamp, timestamp, expires);
  return { id, admin_id: adminId, csrf_token: csrfToken, expires_at: expires };
}

export function revokeSession(db, id) {
  if (id) db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(now(), id);
}

export function revokeAdminSessions(db, adminId) {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE admin_id = ? AND revoked_at IS NULL').run(now(), adminId);
}

export function authenticate(db, username, password) {
  const row = db.prepare('SELECT id, username, password_hash, password_salt FROM admins WHERE username = ?').get(String(username || '').trim());
  if (!row || !verifyPassword(password, row.password_hash, row.password_salt)) return null;
  return { id: row.id, username: row.username };
}

export function verifyOrigin(req, publicOriginInput) {
  const publicOrigin = getPublicOrigin(publicOriginInput);
  const origin = req.headers.origin;
  if (!origin) {
    const error = new Error('Origin header is required');
    error.statusCode = 403;
    error.code = 'ORIGIN_REQUIRED';
    throw error;
  }
  let normalized;
  try {
    normalized = new URL(origin).origin;
  } catch {
    normalized = '';
  }
  if (normalized !== publicOrigin) {
    const error = new Error('Request origin is not allowed');
    error.statusCode = 403;
    error.code = 'ORIGIN_NOT_ALLOWED';
    throw error;
  }
}

export function verifyCsrf(req, publicOriginInput) {
  verifyOrigin(req, publicOriginInput);
  const session = req.session;
  const supplied = req.get('X-CSRF-Token');
  if (!session || !supplied || supplied !== session.csrf_token) {
    const error = new Error('Invalid CSRF token');
    error.statusCode = 403;
    error.code = 'CSRF_INVALID';
    throw error;
  }
}

export function cleanExpiredSessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL').run(now());
}

export { COOKIE_NAME };
