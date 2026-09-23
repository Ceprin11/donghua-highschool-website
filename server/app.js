import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { getDataDir, getPublicOrigin, LIMITS, normalizeKind } from './config.js';
import { closeDatabase, openDatabase } from './db.js';
import {
  adminById,
  adminList,
  createRecord,
  deleteRecord,
  exportData,
  overview,
  publicBySlug,
  publicList,
  publishRecord,
  saveDraft,
  unpublishRecord,
} from './content.js';
import {
  authenticate,
  cleanExpiredSessions,
  createSession,
  hasAdmin,
  loadSession,
  revokeAdminSessions,
  revokeSession,
  setSessionCookie,
  clearSessionCookie,
  verifyCsrf,
  verifyOrigin,
} from './auth.js';
import { deleteAsset, listAssets, storeUpload, streamAsset, updateAsset } from './media.js';
import { mountLearning } from './learning.js';

const loginAttempts = new Map();

function jsonError(error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const body = { error: status >= 500 ? 'Internal server error' : (error.code || 'REQUEST_FAILED') };
  if (status < 500 && error.message) body.message = error.message;
  return { status, body };
}

function requestIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 100);
}

function loginAllowed(ip) {
  const current = loginAttempts.get(ip);
  if (!current || current.expiresAt <= Date.now()) {
    loginAttempts.set(ip, { count: 0, expiresAt: Date.now() + LIMITS.loginWindowMs });
    return true;
  }
  return current.count < LIMITS.loginAttempts;
}

function recordLoginFailure(ip) {
  const current = loginAttempts.get(ip) || { count: 0, expiresAt: Date.now() + LIMITS.loginWindowMs };
  current.count += 1;
  loginAttempts.set(ip, current);
}

function clearLoginFailures(ip) {
  loginAttempts.delete(ip);
}

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store');
}

function contentKindOrError(req, res, next) {
  try {
    req.contentKind = normalizeKind(req.params.kind);
    next();
  } catch (error) {
    next(error);
  }
}

export function createApp(options = {}) {
  const dataDir = getDataDir(options.dataDir);
  const publicOrigin = getPublicOrigin(options.publicOrigin);
  const db = options.db || openDatabase(dataDir);
  const ownsDb = !options.db;
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: LIMITS.videoBytes, files: 1, fields: 10, fieldSize: 100_000 },
  });

  app.disable('x-powered-by');
  if (options.trustProxy !== undefined) app.set('trust proxy', options.trustProxy);
  app.locals.db = db;
  app.locals.dataDir = dataDir;
  app.locals.publicOrigin = publicOrigin;
  app.locals.close = () => { if (ownsDb) closeDatabase(db); };

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'media'), { recursive: true });

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; font-src 'self' data:");
    if (req.path.startsWith('/experiments/')) {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob:; worker-src 'self' blob:; font-src 'self' data:");
    }
    if (new URL(publicOrigin).protocol === 'https:') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    req.session = loadSession(db, req);
    next();
  });
  app.use(express.json({ limit: LIMITS.jsonBytes }));
  app.use(express.urlencoded({ extended: false, limit: 100_000 }));

  function requireAdmin(req, res, next) {
    if (!req.session?.admin_id) {
      setNoStore(res);
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Administrator authentication is required' });
    }
    return next();
  }

  function requireMutation(req, res, next) {
    try {
      verifyCsrf(req, publicOrigin);
      return next();
    } catch (error) {
      return next(error);
    }
  }

  mountLearning(app, { db, dataDir, publicOrigin, secureCookies: options.secureCookies, requireAdmin, requireMutation });

  app.get('/api/health', async (req, res, next) => {
    const probe = path.join(dataDir, `.health-${crypto.randomUUID()}.tmp`);
    try {
      db.prepare('SELECT 1 AS ok').get();
      await fsp.writeFile(probe, 'ok', { flag: 'wx' });
      await fsp.rm(probe, { force: true });
      res.json({ status: 'ok', database: 'ok', writable: true });
    } catch (error) {
      await fsp.rm(probe, { force: true }).catch(() => {});
      error.statusCode = 503;
      next(error);
    }
  });

  app.get('/api/auth/session', (req, res, next) => {
    try {
      cleanExpiredSessions(db);
      if (!req.session) {
        req.session = createSession(db, null);
        setSessionCookie(res, req.session.id, publicOrigin, options.secureCookies);
      }
      setNoStore(res);
      res.json({ authenticated: Boolean(req.session.admin_id), csrfToken: req.session.csrf_token, initialized: hasAdmin(db) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', (req, res, next) => {
    try {
      verifyOrigin(req, publicOrigin);
      const ip = requestIp(req);
      if (!loginAllowed(ip)) {
        const error = new Error('Too many login attempts');
        error.statusCode = 429;
        error.code = 'LOGIN_RATE_LIMITED';
        throw error;
      }
      if (!req.session || !req.get('X-CSRF-Token') || req.get('X-CSRF-Token') !== req.session.csrf_token) {
        const error = new Error('Invalid CSRF token');
        error.statusCode = 403;
        error.code = 'CSRF_INVALID';
        throw error;
      }
      const username = typeof req.body?.username === 'string' ? req.body.username : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const admin = authenticate(db, username, password);
      if (!admin) {
        recordLoginFailure(ip);
        const error = new Error('Invalid username or password');
        error.statusCode = 401;
        error.code = 'INVALID_CREDENTIALS';
        throw error;
      }
      clearLoginFailures(ip);
      revokeSession(db, req.session.id);
      req.session = createSession(db, admin.id);
      setSessionCookie(res, req.session.id, publicOrigin, options.secureCookies);
      setNoStore(res);
      res.json({ authenticated: true, username: admin.username, csrfToken: req.session.csrf_token, initialized: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', requireMutation, (req, res, next) => {
    try {
      revokeSession(db, req.session.id);
      clearSessionCookie(res, publicOrigin, options.secureCookies);
      setNoStore(res);
      res.json({ authenticated: false, initialized: hasAdmin(db) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/password', requireAdmin, requireMutation, async (req, res, next) => {
    try {
      const currentPassword = req.body?.currentPassword;
      const newPassword = req.body?.newPassword;
      const admin = authenticate(db, req.session.username, currentPassword);
      if (!admin) {
        const error = new Error('Current password is invalid');
        error.statusCode = 400;
        error.code = 'CURRENT_PASSWORD_INVALID';
        throw error;
      }
      const { hashPassword } = await import('./auth.js');
      const nextPassword = hashPassword(newPassword);
      db.prepare('UPDATE admins SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?').run(nextPassword.hash, nextPassword.salt, new Date().toISOString(), admin.id);
      revokeAdminSessions(db, admin.id);
      req.session = createSession(db, admin.id);
      setSessionCookie(res, req.session.id, publicOrigin, options.secureCookies);
      setNoStore(res);
      res.json({ authenticated: true, csrfToken: req.session.csrf_token });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/content/:kind/:slug', contentKindOrError, (req, res, next) => {
    try {
      const value = publicBySlug(db, req.contentKind, req.params.slug);
      if (!value) return res.status(404).json({ error: 'CONTENT_NOT_FOUND', message: 'Content not found' });
      return res.json(value);
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/content/:kind', contentKindOrError, (req, res, next) => {
    try {
      return res.json(publicList(db, req.contentKind));
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/admin/overview', requireAdmin, (req, res) => {
    setNoStore(res);
    res.json(overview(db));
  });

  app.get('/api/admin/export', requireAdmin, (req, res) => {
    setNoStore(res);
    res.json(exportData(db));
  });

  app.get('/api/admin/content/:kind/:id', requireAdmin, contentKindOrError, (req, res, next) => {
    try {
      setNoStore(res);
      const value = adminById(db, req.contentKind, req.params.id);
      if (!value) return res.status(404).json({ error: 'CONTENT_NOT_FOUND', message: 'Content not found' });
      return res.json(value);
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/admin/content/:kind', requireAdmin, contentKindOrError, (req, res, next) => {
    try {
      setNoStore(res);
      return res.json(adminList(db, req.contentKind));
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/admin/content/:kind', requireAdmin, requireMutation, contentKindOrError, async (req, res, next) => {
    try {
      setNoStore(res);
      return res.status(201).json(await createRecord(db, req.contentKind, req.body, req.session.admin_id));
    } catch (error) {
      return next(error);
    }
  });

  app.put('/api/admin/content/:kind/:id', requireAdmin, requireMutation, contentKindOrError, async (req, res, next) => {
    try {
      setNoStore(res);
      return res.json(await saveDraft(db, req.contentKind, req.params.id, req.body, req.session.admin_id));
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/admin/content/:kind/:id/publish', requireAdmin, requireMutation, contentKindOrError, async (req, res, next) => {
    try {
      setNoStore(res);
      return res.json(await publishRecord(db, req.contentKind, req.params.id, req.session.admin_id));
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/admin/content/:kind/:id/unpublish', requireAdmin, requireMutation, contentKindOrError, (req, res, next) => {
    try {
      setNoStore(res);
      return res.json(unpublishRecord(db, req.contentKind, req.params.id, req.session.admin_id));
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/api/admin/content/:kind/:id', requireAdmin, requireMutation, contentKindOrError, (req, res, next) => {
    try {
      setNoStore(res);
      return res.json(deleteRecord(db, req.contentKind, req.params.id, req.session.admin_id));
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/admin/media', requireAdmin, (req, res) => {
    setNoStore(res);
    res.json(listAssets(db));
  });

  app.post('/api/admin/media', requireAdmin, requireMutation, upload.single('file'), async (req, res, next) => {
    try {
      setNoStore(res);
      return res.status(201).json(await storeUpload({ db, dataDir, file: req.file, source: req.body?.source, description: req.body?.description }));
    } catch (error) {
      return next(error);
    }
  });

  app.put('/api/admin/media/:id', requireAdmin, requireMutation, (req, res, next) => {
    try {
      setNoStore(res);
      return res.json(updateAsset(db, req.params.id, req.body || {}));
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/api/admin/media/:id', requireAdmin, requireMutation, async (req, res, next) => {
    try {
      setNoStore(res);
      return res.json(await deleteAsset({ db, dataDir, id: req.params.id }));
    } catch (error) {
      return next(error);
    }
  });

  app.get('/media/:id', async (req, res, next) => {
    try {
      const found = await streamAsset({ db, dataDir, id: req.params.id, req, res, isAdmin: Boolean(req.session?.admin_id) });
      if (!found && !res.headersSent) return res.status(404).json({ error: 'MEDIA_NOT_FOUND', message: 'Media not found' });
      return undefined;
    } catch (error) {
      return next(error);
    }
  });

  if (options.staticDir) {
    const staticDir = path.resolve(options.staticDir);
    app.use(express.static(staticDir, { index: 'index.html', fallthrough: true }));
    app.use((req, res, next) => {
      const clientRoute = req.path === '/'
        || /^\/(?:courses|labs|works|about|credits|login|student|downloads|assignments)(?:\/[^/.]+)?$/u.test(req.path)
        || /^\/admin(?:\/(?:settings|teacher|courses|experiments|works|quizzes|media|login|students|resources|assignments))?$/u.test(req.path);
      if (req.method === 'GET' && (clientRoute || /^\/labs\/cv\/[^/.]+$/u.test(req.path))) {
        return res.sendFile(path.join(staticDir, 'index.html'), (error) => error ? next() : undefined);
      }
      return next();
    });
  }

  app.use((req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/media/')) return res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
    const segments = req.path.split('/').filter(Boolean);
    const privateSegment = segments.some((segment) => segment === '.env' || segment.startsWith('.env.') || ['data', 'backup', 'backups', '_project_review', '.git'].includes(segment));
    const hasExtension = segments.some((segment) => segment.includes('.'));
    const ordinaryHtmlRequest = req.method === 'GET'
      && typeof req.headers.accept === 'string'
      && req.headers.accept.includes('text/html')
      && !req.path.startsWith('/models/')
      && req.path !== '/models'
      && !privateSegment
      && !hasExtension;
    if (ordinaryHtmlRequest) {
      res.status(404).type('html').send('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>页面未找到</title></head><body><main><h1>页面未找到</h1><p>你访问的页面不存在或已下线。</p><a href="/">返回首页</a></main></body></html>');
      return;
    }
    res.status(404).json({ error: 'NOT_FOUND', message: 'Page not found' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: error.code, message: 'Upload could not be processed' });
    }
    const result = jsonError(error);
    return res.status(result.status).json(result.body);
  });

  return app;
}

export default createApp;
