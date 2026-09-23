import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { openDatabase } from '../server/db.js';
import { seedInitialContent } from '../server/seed.js';
import { createAdmin, createSession } from '../server/auth.js';
import { storeUpload } from '../server/media.js';
import { createRecord, exportData, publishRecord, saveDraft, unpublishRecord } from '../server/content.js';
import { createApp } from '../server/app.js';
import { backupData, restoreData } from '../scripts/data-files.mjs';
import { importContent } from '../scripts/import.mjs';

test('stopped backup restores actual database and media into a new directory, revokes sessions and never overwrites', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'donghua-restore-'));
  const source = path.join(base, 'source'), backup = path.join(base, 'backup'), restored = path.join(base, 'restored');
  let db = openDatabase(source), app, server;
  try {
    await seedInitialContent(db);
    const admin = createAdmin(db, 'restore-admin', crypto.randomBytes(24).toString('base64url'));
    createSession(db, admin.id);
    const buffer = await fs.readFile('tests/fixtures/procedural.png');
    const asset = await storeUpload({ db, dataDir: source, file: { buffer, originalname: '程序图.png', mimetype: 'image/png' }, source: '程序生成的恢复测试素材' });
    const work = await createRecord(db, 'works', { slug: 'restore-work', title: '恢复验收作品', cover_asset_id: asset.id });
    await publishRecord(db, 'works', work.id); db.close();
    await fs.writeFile(path.join(source, 'server.pid'), JSON.stringify({ pid: process.ppid }));
    await assert.rejects(backupData(source, backup), /服务仍在运行/);
    await fs.unlink(path.join(source, 'server.pid'));
    assert.deepEqual(await backupData(source, backup), { content: 36, media: 1 });
    assert.deepEqual(await restoreData(backup, restored), { content: 36, media: 1 });
    await assert.rejects(restoreData(backup, source), /目标目录已存在/);
    app = createApp({ dataDir: restored, publicOrigin: 'http://127.0.0.1' });
    assert.equal(app.locals.db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
    assert.equal(app.locals.db.prepare('SELECT count(*) AS n FROM admins').get().n, 1);
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await (await fetch(`${origin}/api/content/works/restore-work`)).json()).title, '恢复验收作品');
    const media = await fetch(`${origin}${asset.url}`); assert.equal(media.status, 200);
    assert.deepEqual(Buffer.from(await media.arrayBuffer()), buffer);
    assert.equal((await fetch(`${origin}/api/health`)).status, 200);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    app?.locals.close(); if (db.open) db.close(); await fs.rm(base, { recursive: true, force: true });
  }
});

test('offline import validates own export, dry-run rolls back, apply is additive and conflicts preserve existing data', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'donghua-import-test-'));
  const source = openDatabase(path.join(base, 'source')), target = openDatabase(path.join(base, 'target'));
  try {
    await seedInitialContent(source); const bundle = exportData(source);
    const dry = await importContent(target, bundle, false); assert.equal(dry.created, 35);
    assert.equal(target.prepare('SELECT count(*) AS n FROM content_records').get().n, 0);
    const applied = await importContent(target, bundle, true); assert.equal(applied.created, 35);
    const repeat = await importContent(target, bundle, true); assert.equal(repeat.skipped, 35);
    const changed = structuredClone(bundle); changed.content.settings[0].draft.site_name = '不应覆盖';
    await assert.rejects(importContent(target, changed, true), /不会覆盖人工内容/);
    assert.notEqual(JSON.parse(target.prepare("SELECT draft_json FROM content_records WHERE kind='settings'").get().draft_json).site_name, '不应覆盖');
    await assert.rejects(importContent(target, { ...bundle, admins: [] }, true), /管理员/);
  } finally { source.close(); target.close(); await fs.rm(base, { recursive: true, force: true }); }
});

test('offline import restores published children when their parent is maintenance or unpublished', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'donghua-import-parent-state-'));
  const sourceDir = path.join(base, 'source');
  const maintenanceDir = path.join(base, 'maintenance-target');
  const unpublishedDir = path.join(base, 'unpublished-target');
  const source = openDatabase(sourceDir);
  const maintenanceTarget = openDatabase(maintenanceDir);
  const unpublishedTarget = openDatabase(unpublishedDir);
  try {
    await seedInitialContent(source);
    const parent = source.prepare("SELECT id FROM content_records WHERE kind = 'experiments' AND slug = 'neural-network'").get();
    assert.ok(parent);

    await saveDraft(source, 'experiments', parent.id, { runtime_status: 'maintenance' });
    await publishRecord(source, 'experiments', parent.id);
    const maintenanceBundle = exportData(source);
    const maintenanceImport = await importContent(maintenanceTarget, maintenanceBundle, true);
    assert.equal(maintenanceImport.created, 35);
    const maintenanceParent = maintenanceTarget.prepare("SELECT status, published_json FROM content_records WHERE kind = 'experiments' AND slug = 'neural-network'").get();
    assert.equal(maintenanceParent.status, 'published');
    assert.equal(JSON.parse(maintenanceParent.published_json).runtime_status, 'maintenance');
    const maintenanceChild = maintenanceTarget.prepare("SELECT status, published_json FROM content_records WHERE kind = 'presets' AND slug = 'neural-blobs'").get();
    assert.equal(maintenanceChild.status, 'published');
    assert.ok(maintenanceChild.published_json);

    unpublishRecord(source, 'experiments', parent.id);
    const unpublishedBundle = exportData(source);
    const unpublishedImport = await importContent(unpublishedTarget, unpublishedBundle, true);
    assert.equal(unpublishedImport.created, 35);
    const unpublishedParent = unpublishedTarget.prepare("SELECT status, published_json FROM content_records WHERE kind = 'experiments' AND slug = 'neural-network'").get();
    assert.equal(unpublishedParent.status, 'draft');
    assert.equal(unpublishedParent.published_json, null);
    const unpublishedChild = unpublishedTarget.prepare("SELECT status, published_json FROM content_records WHERE kind = 'presets' AND slug = 'neural-blobs'").get();
    assert.equal(unpublishedChild.status, 'published');
    assert.ok(unpublishedChild.published_json);
  } finally {
    source.close();
    maintenanceTarget.close();
    unpublishedTarget.close();
    await fs.rm(base, { recursive: true, force: true });
  }
});
