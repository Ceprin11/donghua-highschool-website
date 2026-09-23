import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../server/app.js';
import { createAdmin } from '../server/auth.js';
import { createRecord } from '../server/content.js';
import { closeDatabase, openDatabase } from '../server/db.js';
import { seedInitialContent } from '../server/seed.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const USERNAME = 'content-test-admin';
const PASSWORD = 'a-secure-password-for-content-tests';

let directory;
let db;
let app;
let server;
let origin;
let port;
let cookie = '';
let csrf = '';
let teacherId;

async function listen() {
  return new Promise((resolve, reject) => {
    const instance = app.listen(port || 0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
}

async function startServer() {
  if (!origin) {
    app = createApp({ dataDir: directory, publicOrigin: 'http://127.0.0.1:0', db, secureCookies: false });
    server = await listen();
    port = server.address().port;
    origin = `http://127.0.0.1:${port}`;
    await new Promise((resolve) => server.close(resolve));
    closeDatabase(db);
    db = openDatabase(directory);
  }
  app = createApp({ dataDir: directory, publicOrigin: origin, db, secureCookies: false });
  server = await listen();
}

async function restartServer() {
  await new Promise((resolve) => server.close(resolve));
  closeDatabase(db);
  db = openDatabase(directory);
  cookie = '';
  csrf = '';
  app = createApp({ dataDir: directory, publicOrigin: origin, db, secureCookies: false });
  server = await listen();
}

function updateCookie(response) {
  const value = response.headers.get('set-cookie');
  if (value) cookie = value.split(';', 1)[0];
}

async function request(route, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Origin', origin);
  headers.set('Connection', 'close');
  if (cookie) headers.set('Cookie', cookie);
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData) && !(options.body instanceof Blob)) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.body);
  }
  if (options.csrf !== false && options.method && options.method !== 'GET' && csrf) headers.set('X-CSRF-Token', csrf);
  const response = await fetch(`${origin}${route}`, { ...options, headers });
  updateCookie(response);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (body?.csrfToken) csrf = body.csrfToken;
  return { response, body };
}

async function anonymousRequest(route, options = {}) {
  const savedCookie = cookie;
  const savedCsrf = csrf;
  cookie = '';
  csrf = '';
  try {
    return await request(route, options);
  } finally {
    cookie = savedCookie;
    csrf = savedCsrf;
  }
}

async function login() {
  const session = await request('/api/auth/session');
  assert.equal(session.response.status, 200);
  assert.ok(session.body.csrfToken);
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: { username: USERNAME, password: PASSWORD },
  });
  assert.equal(result.response.status, 200);
}

async function uploadPng(source = 'content API test') {
  const form = new FormData();
  form.append('source', source);
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'pixel.png');
  const uploaded = await request('/api/admin/media', { method: 'POST', body: form });
  assert.equal(uploaded.response.status, 201);
  return uploaded.body.id;
}

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'donghua-content-'));
  db = openDatabase(directory);
  createAdmin(db, USERNAME, PASSWORD);
  await startServer();
  await login();
});

after(async () => {
  await new Promise((resolve) => server?.close(resolve));
  closeDatabase(db);
  await fs.rm(directory, { recursive: true, force: true });
});

test('teacher is a singleton and an invisible published profile is absent from public APIs', async () => {
  const created = await request('/api/admin/content/teacher', {
    method: 'POST',
    body: { slug: 'ignored-slug', name: '主讲教师', visible: false },
  });
  assert.equal(created.response.status, 201);
  teacherId = created.body.id;

  const duplicate = await request('/api/admin/content/teacher', {
    method: 'POST',
    body: { name: '第二份教师资料' },
  });
  assert.equal(duplicate.response.status, 409);

  const published = await request(`/api/admin/content/teacher/${teacherId}/publish`, { method: 'POST', body: {} });
  assert.equal(published.response.status, 200);
  const list = await anonymousRequest('/api/content/teacher');
  assert.equal(list.response.status, 200);
  assert.deepEqual(list.body, []);
  const detail = await anonymousRequest('/api/content/teacher/teacher');
  assert.equal(detail.response.status, 404);
});

test('media referenced by a teacher is public only through its published version', async () => {
  const mediaId = await uploadPng('teacher photo');
  const draft = await request(`/api/admin/content/teacher/${teacherId}`, {
    method: 'PUT',
    body: { visible: true, photo_asset_id: mediaId },
  });
  assert.equal(draft.response.status, 200);
  assert.equal((await anonymousRequest(`/media/${mediaId}`)).response.status, 404);

  const published = await request(`/api/admin/content/teacher/${teacherId}/publish`, { method: 'POST', body: {} });
  assert.equal(published.response.status, 200);
  assert.equal((await anonymousRequest(`/media/${mediaId}`)).response.status, 200);

  const changedDraft = await request(`/api/admin/content/teacher/${teacherId}`, {
    method: 'PUT',
    body: { photo_asset_id: '' },
  });
  assert.equal(changedDraft.response.status, 200);
  assert.equal((await anonymousRequest(`/media/${mediaId}`)).response.status, 200);

  const republished = await request(`/api/admin/content/teacher/${teacherId}/publish`, { method: 'POST', body: {} });
  assert.equal(republished.response.status, 200);
  assert.equal((await anonymousRequest(`/media/${mediaId}`)).response.status, 404);
});

test('maintenance and unpublishing a parent hide its published presets and quizzes', async () => {
  const experiment = await request('/api/admin/content/experiments', {
    method: 'POST',
    body: { slug: 'neural-network', engine_key: 'neural', title: '测试神经网络', default_config: {}, runtime_status: 'ready' },
  });
  assert.equal(experiment.response.status, 201);
  const experimentId = experiment.body.id;
  assert.equal((await request(`/api/admin/content/experiments/${experimentId}/publish`, { method: 'POST', body: {} })).response.status, 200);

  const preset = await request('/api/admin/content/presets', {
    method: 'POST',
    body: { slug: 'gated-preset', experiment_slug: 'neural-network', title: '挑战', config: {} },
  });
  assert.equal(preset.response.status, 201);
  assert.equal((await request(`/api/admin/content/presets/${preset.body.id}/publish`, { method: 'POST', body: {} })).response.status, 200);

  const quiz = await request('/api/admin/content/quizzes', {
    method: 'POST',
    body: {
      slug: 'gated-quiz',
      experiment_slug: 'neural-network',
      question: '问题',
      options: [{ id: 'a', text: '是' }, { id: 'b', text: '否' }],
      correct_option_id: 'a',
    },
  });
  assert.equal(quiz.response.status, 201);
  assert.equal((await request(`/api/admin/content/quizzes/${quiz.body.id}/publish`, { method: 'POST', body: {} })).response.status, 200);
  assert.equal((await anonymousRequest('/api/content/presets/gated-preset')).response.status, 200);
  assert.equal((await anonymousRequest('/api/content/quizzes/gated-quiz')).response.status, 200);

  const maintenance = await request(`/api/admin/content/experiments/${experimentId}`, {
    method: 'PUT',
    body: { runtime_status: 'maintenance' },
  });
  assert.equal(maintenance.response.status, 200);
  assert.equal((await request(`/api/admin/content/experiments/${experimentId}/publish`, { method: 'POST', body: {} })).response.status, 200);
  assert.equal((await anonymousRequest('/api/content/presets/gated-preset')).response.status, 404);
  assert.equal((await anonymousRequest('/api/content/quizzes/gated-quiz')).response.status, 404);

  const readyAgain = await request(`/api/admin/content/experiments/${experimentId}`, {
    method: 'PUT',
    body: { runtime_status: 'ready' },
  });
  assert.equal(readyAgain.response.status, 200);
  assert.equal((await request(`/api/admin/content/experiments/${experimentId}/publish`, { method: 'POST', body: {} })).response.status, 200);
  assert.equal((await anonymousRequest('/api/content/presets/gated-preset')).response.status, 200);
  assert.equal((await anonymousRequest('/api/content/quizzes/gated-quiz')).response.status, 200);

  assert.equal((await request(`/api/admin/content/experiments/${experimentId}/unpublish`, { method: 'POST', body: {} })).response.status, 200);
  assert.equal((await anonymousRequest('/api/content/presets/gated-preset')).response.status, 404);
  assert.equal((await anonymousRequest('/api/content/quizzes/gated-quiz')).response.status, 404);
});

test('experiment configuration rejects out-of-range and unknown fields', async () => {
  const experiments = await request('/api/admin/content/experiments');
  const experiment = experiments.body.find((item) => item.slug === 'neural-network');
  assert.ok(experiment);
  const outOfRange = await request(`/api/admin/content/experiments/${experiment.id}`, {
    method: 'PUT',
    body: { default_config: { learningRate: 2 } },
  });
  assert.equal(outOfRange.response.status, 400);
  assert.equal(outOfRange.body.error, 'INVALID_EXPERIMENT_CONFIG');

  const unknownField = await request(`/api/admin/content/experiments/${experiment.id}`, {
    method: 'PUT',
    body: { default_config: { unknown: true } },
  });
  assert.equal(unknownField.response.status, 400);
  assert.equal(unknownField.body.error, 'INVALID_EXPERIMENT_CONFIG');
});

test('themes and experiments keep their fixed public identities', async () => {
  const experiments = await request('/api/admin/content/experiments');
  const experiment = experiments.body.find((item) => item.slug === 'neural-network');
  assert.ok(experiment);
  const extraTheme = await request('/api/admin/content/themes', {
    method: 'POST',
    body: { slug: 'fifth-theme', title: '不应新增的主题' },
  });
  assert.equal(extraTheme.response.status, 400);
  assert.equal(extraTheme.body.error, 'FIXED_THEME_REQUIRED');

  const theme = await request('/api/admin/content/themes', {
    method: 'POST',
    body: { slug: 'intro-ai', title: '走进人工智能' },
  });
  assert.equal(theme.response.status, 201);
  const renamedTheme = await request(`/api/admin/content/themes/${theme.body.id}`, {
    method: 'PUT',
    body: { slug: 'renamed-theme' },
  });
  assert.equal(renamedTheme.response.status, 409);
  assert.equal(renamedTheme.body.error, 'FIXED_CONTENT_IMMUTABLE');
  const deletedTheme = await request(`/api/admin/content/themes/${theme.body.id}`, { method: 'DELETE', body: {} });
  assert.equal(deletedTheme.response.status, 409);
  assert.equal(deletedTheme.body.error, 'FIXED_CONTENT_DELETE_FORBIDDEN');

  const extraExperiment = await request('/api/admin/content/experiments', {
    method: 'POST',
    body: { slug: 'extra-experiment', engine_key: 'cnn', title: '不应新增的实验', default_config: {} },
  });
  assert.equal(extraExperiment.response.status, 400);
  assert.equal(extraExperiment.body.error, 'FIXED_EXPERIMENT_REQUIRED');
  const changedEngine = await request(`/api/admin/content/experiments/${experiment.id}`, {
    method: 'PUT',
    body: { engine_key: 'cnn' },
  });
  assert.equal(changedEngine.response.status, 409);
  assert.equal(changedEngine.body.error, 'FIXED_CONTENT_IMMUTABLE');
  const deletedExperiment = await request(`/api/admin/content/experiments/${experiment.id}`, { method: 'DELETE', body: {} });
  assert.equal(deletedExperiment.response.status, 409);
  assert.equal(deletedExperiment.body.error, 'FIXED_CONTENT_DELETE_FORBIDDEN');
});

test('role, owner and publication fields cannot be supplied through content payloads', async () => {
  const role = await request('/api/admin/content/works', {
    method: 'POST',
    body: { slug: 'role-work', title: '角色字段', role: 'admin' },
  });
  assert.equal(role.response.status, 400);
  assert.equal(role.body.error, 'UNSUPPORTED_FIELD');

  const created = await request('/api/admin/content/works', {
    method: 'POST',
    body: {
      slug: 'reserved-work',
      title: '保留字段',
      owner_id: 'attacker',
      status: 'published',
      published: true,
      published_at: '2099-01-01T00:00:00.000Z',
      id: 'forged-id',
    },
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.status, 'draft');
  assert.equal(created.body.published, null);
  assert.equal(Object.hasOwn(created.body.draft, 'owner_id'), false);
  assert.equal(Object.hasOwn(created.body.draft, 'status'), false);

  const updated = await request(`/api/admin/content/works/${created.body.id}`, {
    method: 'PUT',
    body: { title: '修改后', owner_id: 'another-attacker', status: 'published', published: true },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.status, 'draft');
  assert.equal(updated.body.published, null);
  assert.equal(Object.hasOwn(updated.body.draft, 'owner_id'), false);
  assert.equal(Object.hasOwn(updated.body.draft, 'status'), false);
});

test('seedInitialContent is repeatable and does not overwrite an edited record', async () => {
  const existingExperiments = await request('/api/admin/content/experiments');
  const parent = existingExperiments.body.find((item) => item.slug === 'neural-network');
  assert.ok(parent);
  assert.equal((await request(`/api/admin/content/experiments/${parent.id}/publish`, { method: 'POST', body: {} })).response.status, 200);

  const first = await seedInitialContent(db);
  assert.ok(first.created > 0);

  const experiments = await request('/api/admin/content/experiments');
  assert.equal(experiments.response.status, 200);
  const seeded = experiments.body.find((item) => item.slug === 'cnn-explainer');
  assert.ok(seeded);
  const edited = await request(`/api/admin/content/experiments/${seeded.id}`, {
    method: 'PUT',
    body: { title: '人工修改后的实验标题' },
  });
  assert.equal(edited.response.status, 200);

  const second = await seedInitialContent(db);
  assert.equal(second.created, 0);
  assert.ok(second.skipped > 0);
  const after = await request(`/api/admin/content/experiments/${seeded.id}`);
  assert.equal(after.response.status, 200);
  assert.equal(after.body.draft.title, '人工修改后的实验标题');
});

test('content and media remain available after reopening the service', async () => {
  const mediaId = await uploadPng('restart test');
  const work = await request('/api/admin/content/works', {
    method: 'POST',
    body: { slug: 'restart-work', title: '重启后仍存在', cover_asset_id: mediaId },
  });
  assert.equal(work.response.status, 201);
  assert.equal((await request(`/api/admin/content/works/${work.body.id}/publish`, { method: 'POST', body: {} })).response.status, 200);

  assert.equal((await anonymousRequest('/api/content/works/restart-work')).response.status, 200);
  assert.equal((await anonymousRequest(`/media/${mediaId}`)).response.status, 200);
  await restartServer();
  assert.equal((await anonymousRequest('/api/content/works/restart-work')).response.status, 200);
  assert.equal((await anonymousRequest(`/media/${mediaId}`)).response.status, 200);
  await login();
});

test('export includes more than 500 records and excludes credentials and sessions', async () => {
  const ids = [];
  for (let index = 0; index < 501; index += 1) {
    const record = await createRecord(db, 'works', {
      slug: `bulk-work-${String(index).padStart(3, '0')}`,
      title: `批量作品 ${index}`,
    });
    ids.push(record.id);
  }

  const exported = await request('/api/admin/export');
  assert.equal(exported.response.status, 200);
  const works = exported.body.content.works;
  const exportedIds = new Set(works.map((item) => item.id));
  assert.ok(works.length > 500);
  for (const id of ids) assert.equal(exportedIds.has(id), true);

  const serialized = JSON.stringify(exported.body);
  for (const sensitive of ['password_hash', 'password_salt', 'csrf_token', 'sessions', 'admins']) {
    assert.equal(serialized.includes(sensitive), false, `export leaked ${sensitive}`);
  }
  assert.deepEqual(Object.keys(exported.body).sort(), ['content', 'exportedAt', 'media', 'schemaVersion']);
});
