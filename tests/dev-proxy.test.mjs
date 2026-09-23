import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createApp } from '../server/app.js';
import { createAdmin } from '../server/auth.js';
import { closeDatabase, openDatabase } from '../server/db.js';

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
}

function cookieFrom(response) {
  const value = response.headers.get('set-cookie');
  return value ? value.split(';', 1)[0] : '';
}

async function readResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

async function request(url, { body, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  let requestBody = body;
  if (body && typeof body === 'object' && !(body instanceof Blob) && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }
  const response = await fetch(url, { ...options, headers, body: requestBody });
  return { response, body: await readResponse(response), cookie: cookieFrom(response) };
}

async function closeResources(resources) {
  await resources?.vite?.close().catch(() => {});
  await new Promise((resolve) => resources?.backend?.close(() => resolve()));
  if (resources?.db) closeDatabase(resources.db);
  if (resources?.dataDir) await fs.rm(resources.dataDir, { recursive: true, force: true });
}

test('Vite development proxy preserves browser Origin, session Cookie and CSRF for an admin write', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'donghua-vite-proxy-'));
  const vitePort = await freePort();
  const backendPort = await freePort();
  const publicOrigin = `http://127.0.0.1:${vitePort}`;
  const backendOrigin = `http://127.0.0.1:${backendPort}`;
  const db = openDatabase(dataDir);
  createAdmin(db, 'proxy-test-admin', 'proxy-test-password-123');
  const backend = await listen(createApp({ dataDir, publicOrigin, db, secureCookies: false, trustProxy: 1 }), backendPort);
  let vite;
  try {
    vite = await createViteServer({
      configFile: false,
      root: PROJECT_ROOT,
      appType: 'spa',
      optimizeDeps: { noDiscovery: true },
      server: {
        host: '127.0.0.1',
        port: vitePort,
        strictPort: true,
        proxy: {
          '/api': { target: backendOrigin, changeOrigin: false },
          '/media': { target: backendOrigin, changeOrigin: false },
        },
      },
    });
    await vite.listen();

    const session = await request(`${publicOrigin}/api/auth/session`, { headers: { Origin: publicOrigin } });
    assert.equal(session.response.status, 200);
    assert.equal(session.body.authenticated, false);
    assert.ok(session.body.csrfToken);
    assert.match(session.cookie, /^sid=/u);

    const loggedIn = await request(`${publicOrigin}/api/auth/login`, {
      method: 'POST',
      headers: {
        Origin: publicOrigin,
        Cookie: session.cookie,
        'X-CSRF-Token': session.body.csrfToken,
      },
      body: { username: 'proxy-test-admin', password: 'proxy-test-password-123' },
    });
    assert.equal(loggedIn.response.status, 200);
    assert.equal(loggedIn.body.authenticated, true);
    assert.match(loggedIn.cookie, /^sid=/u);
    assert.notEqual(loggedIn.cookie, session.cookie);

    const saved = await request(`${publicOrigin}/api/admin/content/works`, {
      method: 'POST',
      headers: {
        Origin: publicOrigin,
        Cookie: loggedIn.cookie,
        'X-CSRF-Token': loggedIn.body.csrfToken,
      },
      body: { slug: 'vite-proxy-work', title: 'Vite 代理写入验证', body: '通过真实代理保存的草稿。' },
    });
    assert.equal(saved.response.status, 201);
    assert.equal(saved.body.draft.title, 'Vite 代理写入验证');
  } finally {
    await closeResources({ vite, backend, db, dataDir });
  }
});

test('production HTTPS origin with one trusted proxy sets Secure cookies and accepts a forwarded write', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'donghua-production-proxy-'));
  const port = await freePort();
  const publicOrigin = 'https://course.example';
  const db = openDatabase(dataDir);
  createAdmin(db, 'production-proxy-admin', 'production-proxy-password-123');
  const app = createApp({ dataDir, publicOrigin, db, trustProxy: 1 });
  const backend = await listen(app, port);
  const forwardedHeaders = {
    Host: 'course.example',
    Origin: publicOrigin,
    'X-Forwarded-Proto': 'https',
    'X-Forwarded-For': '198.51.100.44',
  };
  try {
    assert.equal(app.get('trust proxy'), 1);

    const session = await request(`http://127.0.0.1:${port}/api/auth/session`, { headers: forwardedHeaders });
    assert.equal(session.response.status, 200);
    assert.match(session.response.headers.get('set-cookie') || '', /\bSecure\b/u);
    assert.match(session.response.headers.get('set-cookie') || '', /HttpOnly/u);
    assert.ok(session.body.csrfToken);

    const loggedIn = await request(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { ...forwardedHeaders, Cookie: session.cookie, 'X-CSRF-Token': session.body.csrfToken },
      body: { username: 'production-proxy-admin', password: 'production-proxy-password-123' },
    });
    assert.equal(loggedIn.response.status, 200);
    assert.match(loggedIn.response.headers.get('set-cookie') || '', /\bSecure\b/u);

    const saved = await request(`http://127.0.0.1:${port}/api/admin/content/works`, {
      method: 'POST',
      headers: { ...forwardedHeaders, Cookie: loggedIn.cookie, 'X-CSRF-Token': loggedIn.body.csrfToken },
      body: { slug: 'production-proxy-work', title: 'HTTPS 代理写入验证' },
    });
    assert.equal(saved.response.status, 201);
    assert.equal(saved.body.draft.title, 'HTTPS 代理写入验证');
  } finally {
    await closeResources({ backend, db, dataDir });
  }
});
