import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { LIMITS } from './config.js';
import { now, transaction } from './db.js';
import { hasPublicMediaReference, mediaReferences } from './content.js';

const ALLOWED = Object.freeze({
  image: new Set(['image/jpeg', 'image/png', 'image/webp']),
  video: new Set(['video/mp4', 'video/webm']),
});

function fail(message, statusCode = 400, code = 'INVALID_MEDIA') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

function safeOriginalName(value) {
  const name = path.basename(String(value || 'upload'));
  const withoutControls = [...name].filter((character) => character.charCodeAt(0) >= 32).join('');
  const cleaned = withoutControls.replace(/[\\/:*?"<>|]+/gu, '_').slice(0, 180);
  return cleaned || 'upload';
}

function mediaDirectory(dataDir) {
  const directory = path.join(dataDir, 'media');
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function publicAsset(row) {
  return {
    id: row.id,
    mime_type: row.mime_type,
    original_name: row.original_name,
    size: row.size_bytes,
    size_bytes: row.size_bytes,
    asset_kind: row.asset_kind,
    source: row.source,
    source_note: row.source,
    description: row.description,
    url: `/media/${encodeURIComponent(row.id)}`,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function sniff(buffer) {
  try {
    const result = await fileTypeFromBuffer(buffer);
    return result?.mime || '';
  } catch {
    return '';
  }
}

export async function storeUpload({ db, dataDir, file, source = '', description = '' }) {
  if (!file || !Buffer.isBuffer(file.buffer)) fail('A file is required');
  if (!file.buffer.length) fail('The uploaded file is empty');
  const detected = await sniff(file.buffer);
  if (!detected || !Object.values(ALLOWED).some((set) => set.has(detected))) fail('Unsupported or invalid media file', 415, 'MEDIA_TYPE_NOT_ALLOWED');
  const assetKind = detected.startsWith('image/') ? 'image' : 'video';
  const limit = assetKind === 'image' ? LIMITS.imageBytes : LIMITS.videoBytes;
  if (file.buffer.length > limit) fail(`The ${assetKind} file is too large`, 413, 'MEDIA_TOO_LARGE');
  if (file.mimetype && file.mimetype !== detected) fail('Uploaded MIME type does not match file contents', 415, 'MEDIA_MIME_MISMATCH');
  const id = crypto.randomUUID();
  const extension = detected === 'image/jpeg' ? 'jpg' : detected.split('/')[1];
  const storageName = `${id}.${extension}`;
  const originalName = safeOriginalName(file.originalname);
  const directory = mediaDirectory(dataDir);
  const target = path.join(directory, storageName);
  await fsp.writeFile(target, file.buffer, { flag: 'wx' });
  const timestamp = now();
  try {
    db.prepare(`INSERT INTO media_assets(id, storage_name, original_name, mime_type, asset_kind, size_bytes, source, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, storageName, originalName, detected, assetKind, file.buffer.length, String(source || '').slice(0, 1_000), String(description || '').slice(0, 2_000), timestamp, timestamp);
  } catch (error) {
    await fsp.rm(target, { force: true });
    throw error;
  }
  return publicAsset(db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id));
}

export function listAssets(db) {
  return db.prepare('SELECT * FROM media_assets ORDER BY created_at DESC, id DESC').all().map((row) => ({
    ...publicAsset(row),
    refs: mediaReferences(db, row.id),
    published_refs: mediaReferences(db, row.id).filter((ref) => ref.phase === 'published'),
  }));
}

export function getAsset(db, id) {
  return db.prepare('SELECT * FROM media_assets WHERE id = ?').get(String(id));
}

export function updateAsset(db, id, input) {
  const existing = getAsset(db, id);
  if (!existing) fail('Media asset not found', 404, 'MEDIA_NOT_FOUND');
  const source = input.source === undefined ? existing.source : String(input.source || '').slice(0, 1_000);
  const description = input.description === undefined ? existing.description : String(input.description || '').slice(0, 2_000);
  const originalName = input.original_name === undefined ? existing.original_name : safeOriginalName(input.original_name);
  db.prepare('UPDATE media_assets SET original_name = ?, source = ?, description = ?, updated_at = ? WHERE id = ?')
    .run(originalName, source, description, now(), existing.id);
  return publicAsset(getAsset(db, id));
}

export async function deleteAsset({ db, dataDir, id }) {
  const existing = getAsset(db, id);
  if (!existing) fail('Media asset not found', 404, 'MEDIA_NOT_FOUND');
  const refs = mediaReferences(db, id);
  if (refs.length) fail('Media asset is still referenced by content', 409, 'MEDIA_REFERENCED');
  const target = path.join(mediaDirectory(dataDir), existing.storage_name);
  try {
    await fsp.rm(target, { force: false });
  } catch (error) {
    if (error.code === 'ENOENT') fail('Stored media file is missing', 500, 'MEDIA_FILE_MISSING');
    fail('Stored media file could not be deleted', 500, 'MEDIA_DELETE_FAILED');
  }
  try {
    transaction(db, () => {
      const result = db.prepare('DELETE FROM media_assets WHERE id = ?').run(existing.id);
      if (!result.changes) fail('Media asset was removed concurrently', 409, 'MEDIA_NOT_FOUND');
    });
  } catch (error) {
    fail(`Media metadata could not be removed after file deletion: ${error.message}`, 500, 'MEDIA_METADATA_DELETE_FAILED');
  }
  return { id: existing.id, deleted: true };
}

export async function streamAsset({ db, dataDir, id, req, res, isAdmin = false }) {
  const asset = getAsset(db, id);
  if (!asset) return false;
  if (!isAdmin && !hasPublicMediaReference(db, id)) return false;
  const target = path.join(mediaDirectory(dataDir), asset.storage_name);
  let stat;
  try {
    stat = await fsp.stat(target);
  } catch {
    return false;
  }
  const size = stat.size;
  const range = req.headers.range;
  res.setHeader('Content-Type', asset.mime_type);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!range) {
    res.status(200);
    res.setHeader('Content-Length', size);
    fs.createReadStream(target).pipe(res);
    return true;
  }
  const match = /^bytes=(\d*)-(\d*)$/u.exec(range);
  if (!match) {
    res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
    return true;
  }
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2] || 0));
  let end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
    return true;
  }
  end = Math.min(end, size - 1);
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
  res.setHeader('Content-Length', end - start + 1);
  fs.createReadStream(target, { start, end }).pipe(res);
  return true;
}
