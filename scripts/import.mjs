import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { now, openDatabase } from '../server/db.js';
import { getDataDir, CONTENT_KINDS } from '../server/config.js';
import { createRecord, normalizePayload, saveDraft } from '../server/content.js';
import { assertStopped } from './data-files.mjs';

function sameValue(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a), other = Object.keys(b);
  return keys.length === other.length && keys.every(key => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
}
export async function importContent(db, bundle, apply = false) {
  if (bundle?.schemaVersion !== 1 || !bundle.content || !Array.isArray(bundle.media)) throw new Error('只支持本站 schemaVersion=1 的内容导出。');
  const allowed = new Set(['schemaVersion', 'exportedAt', 'content', 'media']);
  if (Object.keys(bundle).some(key => !allowed.has(key))) throw new Error('导入文件含非内容字段；管理员、凭据和会话不能导入。');
  if (Object.keys(bundle.content).some(kind => !CONTENT_KINDS.includes(kind))) throw new Error('导入文件包含未知内容类型');
  const ids = new Set(), slugs = new Set(), result = { created: 0, skipped: 0, remappedIds: [] };
  for (const asset of bundle.media) {
    if (!asset || typeof asset.id !== 'string' || !db.prepare('SELECT id FROM media_assets WHERE id = ?').get(asset.id)) throw new Error('导出只含素材清单。请先用实际文件备份恢复素材，再导入引用这些素材的内容。');
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const kind of CONTENT_KINDS) {
      const records = bundle.content[kind] || [];
      if (!Array.isArray(records)) throw new Error(`${kind} 必须是数组`);
      for (const record of records) {
        if (!record || typeof record.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(record.id) || ids.has(record.id)) throw new Error('记录 ID 无效或重复');
        ids.add(record.id);
        if (!['draft', 'published'].includes(record.status)) throw new Error('记录状态无效');
        if (!record.draft || typeof record.draft !== 'object' || record.slug !== record.draft.slug) throw new Error('记录 slug 与草稿不一致');
        const key = `${kind}/${record.slug}`;
        if (slugs.has(key)) throw new Error('记录 slug 重复'); slugs.add(key);
        const draft = await normalizePayload(db, kind, record.draft);
        let published = null;
        if (record.status === 'published') {
          if (!record.published) throw new Error('已发布记录缺少发布版');
          published = await normalizePayload(db, kind, record.published);
        }
        const existing = db.prepare('SELECT * FROM content_records WHERE kind = ? AND slug = ?').get(kind, record.slug);
        if (existing) {
          if (sameValue(JSON.parse(existing.draft_json), draft) && existing.status === record.status && sameValue(existing.published_json ? JSON.parse(existing.published_json) : null, published)) { result.skipped++; continue; }
          throw new Error(`${key} 已存在且内容不同，本命令不会覆盖人工内容。`);
        }
        if (db.prepare('SELECT id FROM content_records WHERE id = ?').get(record.id)) throw new Error('原记录 ID 与现有记录冲突');
        if (record.status === 'draft' && record.published !== null) throw new Error('草稿状态不能携带公开版本');
        const source = record.status === 'published' ? published : draft;
        const inserted = await createRecord(db, kind, source);
        if (record.status === 'published') {
          // createRecord has already validated and recorded the published
          // payload as a draft. Copy those refs before saveDraft replaces the
          // draft refs, then restore the exported publication directly. This
          // preserves a valid export where a child remains published while
          // its parent is in maintenance or has been unpublished.
          db.prepare(`
            INSERT INTO media_refs(record_id, media_id, phase, field_path)
            SELECT record_id, media_id, 'published', field_path
              FROM media_refs
             WHERE record_id = ? AND phase = 'draft'
          `).run(inserted.id);
          if (!sameValue(draft, source)) await saveDraft(db, kind, inserted.id, draft);
          db.prepare(`
            UPDATE content_records
               SET published_json = ?, status = 'published', published_at = ?, updated_at = ?
             WHERE id = ?
          `).run(JSON.stringify(published), record.published_at || now(), now(), inserted.id);
        }
        result.created++;
        if (record.id !== inserted.id) result.remappedIds.push({ source: record.id, destination: inserted.id });
      }
    }
    if (db.pragma('foreign_key_check').length) throw new Error('导入后的数据引用不完整');
    db.exec(apply ? 'COMMIT' : 'ROLLBACK');
    return result;
  } catch (error) { if (db.inTransaction) db.exec('ROLLBACK'); throw error; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { file: { type: 'string' }, apply: { type: 'boolean' }, stopped: { type: 'boolean' } } });
  if (!values.file) throw new Error('用法 npm run data:import -- --file 本站导出.json。默认只检查；执行时另加 --apply --stopped。');
  const bundle = JSON.parse(await fs.readFile(path.resolve(values.file), 'utf8'));
  const dataDir = getDataDir();
  if (values.apply) {
    if (!values.stopped) throw new Error('正式导入前请停止服务并传入 --stopped。');
    await assertStopped(dataDir);
    const db = openDatabase(dataDir);
    try { console.log(JSON.stringify({ applied: true, ...await importContent(db, bundle, true) }, null, 2)); }
    finally { db.close(); }
  } else {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'donghua-import-'));
    let source;
    try {
      try { source = new Database(path.join(dataDir, 'site.sqlite'), { readonly: true, fileMustExist: true }); }
      catch (error) { if (error.code !== 'SQLITE_CANTOPEN') throw error; }
      if (source) { await source.backup(path.join(temporary, 'site.sqlite')); source.close(); }
      const db = openDatabase(temporary);
      try { console.log(JSON.stringify({ applied: false, ...await importContent(db, bundle, false) }, null, 2)); }
      finally { db.close(); }
    } finally { if (source?.open) source.close(); await fs.rm(temporary, { recursive: true, force: true }); }
  }
}
