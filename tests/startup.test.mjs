import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
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

function testEnvironment(dataDir, port) {
  return {
    ...process.env,
    DATA_DIR: dataDir,
    PORT: String(port),
    PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
    NODE_ENV: 'test',
  };
}

function runNode(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: PROJECT_ROOT,
      env,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    child.once('error', () => reject(new Error(`启动 ${script} 失败`)));
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} 退出，状态 ${code ?? signal}`));
    });
  });
}

async function inspectData(dataDir) {
  const db = openDatabase(dataDir);
  try {
    return {
      records: db.prepare('SELECT count(*) AS count FROM content_records').get().count,
      admins: db.prepare('SELECT count(*) AS count FROM admins').get().count,
    };
  } finally {
    closeDatabase(db);
  }
}

async function waitForServer(child, url, timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) throw new Error('server/index.js 在健康检查前退出');
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      // The server may still be binding its port. Poll until the bounded timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server/index.js 未在限定时间内通过健康检查');
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => setTimeout(() => { child.kill(); resolve(); }, 5_000)),
  ]);
}

test('documented migration, seed and server startup work with an empty temporary data directory', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'donghua-startup-'));
  const port = await freePort();
  const env = testEnvironment(dataDir, port);
  let server;
  try {
    await runNode('scripts/migrate.mjs', env);
    await runNode('scripts/seed.mjs', env);
    const afterFirstSeed = await inspectData(dataDir);
    await runNode('scripts/seed.mjs', env);
    const afterSecondSeed = await inspectData(dataDir);

    assert.ok(afterFirstSeed.records > 0);
    assert.equal(afterFirstSeed.records, afterSecondSeed.records);
    assert.equal(afterFirstSeed.admins, 0);
    assert.equal(afterSecondSeed.admins, 0);

    server = spawn(process.execPath, ['server/index.js'], {
      cwd: PROJECT_ROOT,
      env,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    await waitForServer(server, `http://127.0.0.1:${port}`);

    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok', database: 'ok', writable: true });

    const themes = await fetch(`http://127.0.0.1:${port}/api/content/themes`);
    assert.equal(themes.status, 200);
    const themeList = await themes.json();
    assert.ok(Array.isArray(themeList));
    assert.ok(themeList.length > 0);

    const home = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type') || '', /text\/html/u);

    const session = await fetch(`http://127.0.0.1:${port}/api/auth/session`);
    assert.equal(session.status, 200);
    const sessionBody = await session.json();
    assert.equal(sessionBody.authenticated, false);
    assert.equal(sessionBody.initialized, false);
  } finally {
    await stopServer(server);
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
