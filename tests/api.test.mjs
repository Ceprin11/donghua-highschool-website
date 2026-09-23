import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../server/app.js';
import { createAdmin } from '../server/auth.js';
import { closeDatabase, openDatabase } from '../server/db.js';

let directory;
let db;
let app;
let server;
let baseUrl;
let cookie = '';
let csrf = '';

function updateCookie(response) {
  const value = response.headers.get('set-cookie');
  if (value) cookie = value.split(';', 1)[0];
}

async function request(route, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Origin', baseUrl.origin);
  if (cookie) headers.set('Cookie', cookie);
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData) && !(options.body instanceof Blob)) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.body);
  }
  if (options.csrf !== false && options.method && options.method !== 'GET' && csrf) headers.set('X-CSRF-Token', csrf);
  const response = await fetch(`${baseUrl.origin}${route}`, { ...options, headers });
  updateCookie(response);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (body?.csrfToken) csrf = body.csrfToken;
  return { response, body };
}

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'donghua-api-'));
  db = openDatabase(directory);
  createAdmin(db, 'test-admin', 'a-secure-password-for-tests');
  app = createApp({ dataDir: directory, publicOrigin: 'http://127.0.0.1:0', db, secureCookies: false });
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  baseUrl = new URL(`http://127.0.0.1:${address.port}`);
  app.locals.publicOrigin = baseUrl.origin;
  // The configured origin is fixed at app creation time. The test server uses
  // a port selected by the OS, so recreate it with that exact origin.
  server.close();
  app.locals.close();
  closeDatabase(db);
  db = openDatabase(directory);
  app = createApp({ dataDir: directory, publicOrigin: baseUrl.origin, db, secureCookies: false });
  server = await new Promise((resolve) => {
    const instance = app.listen(Number(baseUrl.port), '127.0.0.1', () => resolve(instance));
  });
});

after(async () => {
  await new Promise((resolve) => server?.close(resolve));
  closeDatabase(db);
  await fs.rm(directory, { recursive: true, force: true });
});

test('anonymous session, login and CSRF protection', async () => {
  const session = await request('/api/auth/session');
  assert.equal(session.response.status, 200);
  assert.equal(session.body.authenticated, false);
  assert.ok(csrf);

  const missingCsrf = await request('/api/auth/login', { method: 'POST', body: { username: 'test-admin', password: 'a-secure-password-for-tests' }, csrf: false });
  assert.equal(missingCsrf.response.status, 403);

  const loggedIn = await request('/api/auth/login', { method: 'POST', body: { username: 'test-admin', password: 'a-secure-password-for-tests' } });
  assert.equal(loggedIn.response.status, 200);
  assert.equal(loggedIn.body.authenticated, true);
});

test('draft, publish, edit and unpublish keep public data isolated', async () => {
  const rejectedField = await request('/api/admin/content/works', { method: 'POST', body: { slug: 'bad-field', title: '不应保存', role: 'admin' } });
  assert.equal(rejectedField.response.status, 400);
  const created = await request('/api/admin/content/works', {
    method: 'POST',
    body: { slug: 'first-work', title: '第一版', summary: '旧内容' },
  });
  assert.equal(created.response.status, 201);
  const id = created.body.id;
  assert.equal((await request('/api/content/works')).body.length, 0);

  const published = await request(`/api/admin/content/works/${id}/publish`, { method: 'POST', body: {} });
  assert.equal(published.response.status, 200);
  assert.equal((await request('/api/content/works/first-work')).body.title, '第一版');

  const saved = await request(`/api/admin/content/works/${id}`, {
    method: 'PUT',
    body: { title: '第二版', slug: 'second-work' },
  });
  assert.equal(saved.response.status, 200);
  assert.equal((await request('/api/content/works/first-work')).body.title, '第一版');
  assert.equal((await request('/api/content/works/second-work')).response.status, 404);

  const republished = await request(`/api/admin/content/works/${id}/publish`, { method: 'POST', body: {} });
  assert.equal(republished.response.status, 200);
  assert.equal((await request('/api/content/works/first-work')).response.status, 404);
  assert.equal((await request('/api/content/works/second-work')).body.title, '第二版');

  const unpublished = await request(`/api/admin/content/works/${id}/unpublish`, { method: 'POST', body: {} });
  assert.equal(unpublished.response.status, 200);
  assert.equal((await request('/api/content/works/second-work')).response.status, 404);
});

test('media is private until a published content reference exists and supports ranges', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const form = new FormData();
  form.append('source', 'API integration test');
  form.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png');
  const uploaded = await request('/api/admin/media', { method: 'POST', body: form });
  assert.equal(uploaded.response.status, 201);
  const mediaId = uploaded.body.id;
  const adminCookie = cookie;
  cookie = '';
  assert.equal((await request(`/media/${mediaId}`)).response.status, 404);
  cookie = adminCookie;

  const videoForm = new FormData();
  videoForm.append('source', 'API integration test video');
  videoForm.append('file', new Blob([await fs.readFile(path.join('tests', 'fixtures', 'procedural.webm'))], { type: 'video/webm' }), 'procedural.webm');
  const uploadedVideo = await request('/api/admin/media', { method: 'POST', body: videoForm });
  assert.equal(uploadedVideo.response.status, 201);
  const videoId = uploadedVideo.body.id;

  const created = await request('/api/admin/content/works', { method: 'POST', body: { slug: 'media-work', title: '图片和视频作品', cover_asset_id: mediaId, video_asset_id: videoId } });
  assert.equal(created.response.status, 201);
  await request(`/api/admin/content/works/${created.body.id}/publish`, { method: 'POST', body: {} });
  const publicMedia = await request(`/media/${mediaId}`, { headers: { Range: 'bytes=0-4' } });
  assert.equal(publicMedia.response.status, 206);
  assert.equal(publicMedia.response.headers.get('content-range'), `bytes 0-4/${png.length}`);
  const videoBytes = await fs.readFile(path.join('tests', 'fixtures', 'procedural.webm'));
  const publicVideo = await request(`/media/${videoId}`, { headers: { Range: 'bytes=0-4' } });
  assert.equal(publicVideo.response.status, 206);
  assert.equal(publicVideo.response.headers.get('content-range'), `bytes 0-4/${videoBytes.length}`);

  const blockedDelete = await request(`/api/admin/media/${mediaId}`, { method: 'DELETE', body: {} });
  assert.equal(blockedDelete.response.status, 409);
  const workList = await request('/api/admin/content/works');
  const work = workList.body.find((item) => item.slug === 'media-work');
  assert.ok(work);
  const cleared = await request(`/api/admin/content/works/${work.id}`, { method: 'PUT', body: { cover_asset_id: '', video_asset_id: '' } });
  assert.equal(cleared.response.status, 200);
  const unpublished = await request(`/api/admin/content/works/${work.id}/unpublish`, { method: 'POST', body: {} });
  assert.equal(unpublished.response.status, 200);
  const deleted = await request(`/api/admin/media/${mediaId}`, { method: 'DELETE', body: {} });
  assert.equal(deleted.response.status, 200);
  const deletedVideo = await request(`/api/admin/media/${videoId}`, { method: 'DELETE', body: {} });
  assert.equal(deletedVideo.response.status, 200);
  assert.equal((await request(`/media/${mediaId}`)).response.status, 404);
});

test('draft parent changes do not hide an already published child', async () => {
  const experiment = await request('/api/admin/content/experiments', {
    method: 'POST',
    body: { slug: 'neural-network', engine_key: 'neural', title: '父实验', default_config: {}, runtime_status: 'ready' },
  });
  assert.equal(experiment.response.status, 201);
  await request(`/api/admin/content/experiments/${experiment.body.id}/publish`, { method: 'POST', body: {} });
  const preset = await request('/api/admin/content/presets', {
    method: 'POST',
    body: { slug: 'parent-preset', experiment_slug: 'neural-network', title: '挑战', config: {} },
  });
  assert.equal(preset.response.status, 201);
  await request(`/api/admin/content/presets/${preset.body.id}/publish`, { method: 'POST', body: {} });

  const edited = await request(`/api/admin/content/experiments/${experiment.body.id}`, {
    method: 'PUT',
    body: { runtime_status: 'maintenance' },
  });
  assert.equal(edited.response.status, 200);
  assert.equal((await request('/api/content/experiments/neural-network')).response.status, 200);
  assert.equal((await request('/api/content/presets/parent-preset')).response.status, 200);
});

test('anonymous users cannot mutate content or inspect admin records', async () => {
  await request('/api/auth/logout', { method: 'POST', body: {} });
  csrf = '';
  const session = await request('/api/auth/session');
  assert.equal(session.body.authenticated, false);
  const admin = await request('/api/admin/content/works');
  assert.equal(admin.response.status, 401);
  const write = await request('/api/admin/content/works', { method: 'POST', body: { slug: 'nope', title: '无权限' } });
  assert.equal(write.response.status, 401);
});
