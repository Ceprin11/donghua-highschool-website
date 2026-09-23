import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

export function assertPrivateDirectory(directory) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const name of ['public', 'dist']) {
    const relative = path.relative(path.join(root, name), path.resolve(directory));
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
      throw new Error('数据库和备份必须放在 public、dist 之外的私有目录。');
    }
  }
}

export async function assertStopped(directory) {
  let marker;
  try { marker = JSON.parse(await fs.readFile(path.join(directory, 'server.pid'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (marker.pid !== process.pid) {
    try { process.kill(marker.pid, 0); }
    catch (error) { if (error.code === 'ESRCH') return; throw error; }
    throw new Error('此数据目录的服务仍在运行。先停止服务，再执行维护命令。');
  }
}
export async function assertNewDirectory(directory) {
  try { await fs.stat(directory); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error('目标目录已存在，请指定一个新目录；不会覆盖现有数据。');
}
function allFiles(db) {
  const media = db.prepare('SELECT storage_name,size_bytes FROM media_assets').all();
  const learning = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='learning_files'").get();
  return learning ? [...media, ...db.prepare('SELECT storage_name,size_bytes FROM learning_files').all()] : media;
}
export async function validateData(directory) {
  const db = new Database(path.join(directory, 'site.sqlite'), { readonly: true, fileMustExist: true });
  try {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('SQLite 完整性检查失败');
    if (db.pragma('foreign_key_check').length) throw new Error('数据库引用不完整');
    const assets = allFiles(db);
    for (const asset of assets) {
      if (path.basename(asset.storage_name) !== asset.storage_name) throw new Error('素材清单含非法文件名');
      const entry = await fs.stat(path.join(directory, 'media', asset.storage_name));
      if (!entry.isFile() || entry.size !== asset.size_bytes) throw new Error(`素材文件缺失或长度不符：${asset.storage_name}`);
    }
    return { content: db.prepare('SELECT count(*) AS n FROM content_records').get().n, media: assets.length };
  } finally { db.close(); }
}
export async function backupData(dataDir, output) {
  assertPrivateDirectory(output);
  await assertStopped(dataDir); await assertNewDirectory(output);
  await validateData(dataDir);
  await fs.mkdir(output, { recursive: true, mode: 0o700 });
  await fs.mkdir(path.join(output, 'media'), { mode: 0o700 });
  const db = new Database(path.join(dataDir, 'site.sqlite'), { readonly: true, fileMustExist: true });
  try {
    await db.backup(path.join(output, 'site.sqlite'));
    for (const asset of allFiles(db)) await fs.copyFile(path.join(dataDir, 'media', asset.storage_name), path.join(output, 'media', asset.storage_name));
  } finally { db.close(); }
  const result = await validateData(output);
  await fs.writeFile(path.join(output, 'backup.json'), JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), ...result }, null, 2), { mode: 0o600 });
  return result;
}
export async function restoreData(backup, target) {
  assertPrivateDirectory(target);
  await assertNewDirectory(target);
  const manifest = JSON.parse(await fs.readFile(path.join(backup, 'backup.json'), 'utf8'));
  if (manifest.schemaVersion !== 1) throw new Error('不支持该备份版本');
  await validateData(backup);
  await fs.mkdir(target, { recursive: true, mode: 0o700 });
  await fs.mkdir(path.join(target, 'media'), { mode: 0o700 });
  await fs.copyFile(path.join(backup, 'site.sqlite'), path.join(target, 'site.sqlite'));
  const db = new Database(path.join(target, 'site.sqlite'));
  try {
    for (const asset of allFiles(db)) await fs.copyFile(path.join(backup, 'media', asset.storage_name), path.join(target, 'media', asset.storage_name));
    db.exec('DELETE FROM sessions');
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='student_sessions'").get()) db.exec('DELETE FROM student_sessions');
    db.pragma('wal_checkpoint(TRUNCATE)');
  } finally { db.close(); }
  return validateData(target);
}
