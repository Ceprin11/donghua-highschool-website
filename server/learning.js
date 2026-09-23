import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { fail, mountStudents, parseNames, previewStudents } from './students.js';

const TYPES = {
  '.pdf': ['application/pdf', ['pdf']],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['docx']],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', ['pptx']],
  '.doc': ['application/msword', ['cfb']],
  '.ppt': ['application/vnd.ms-powerpoint', ['cfb']],
  '.png': ['image/png', ['png']], '.jpg': ['image/jpeg', ['jpg']], '.jpeg': ['image/jpeg', ['jpg']],
};
const fileView = row => ({ id: row.id, name: row.original_name, size: row.size_bytes, mime: row.mime_type });
export function mountLearning(app, options) {
  const { db, dataDir, requireAdmin, requireMutation } = options;
  const { requireReady, studentMutation } = mountStudents(app, options);
  const roster = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, fieldSize: 100_000 } });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 2 } });
  app.use('/api/admin/students', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/admin/learning', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.post('/api/admin/students/preview', requireAdmin, requireMutation, roster.single('file'), async (req, res) => {
    res.json(previewStudents(db, await parseNames(req.body, req.file)));
  });
  async function saveFile(file, studentId = null) {
    if (!file?.size) fail('请选择文件。');
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const filename = (name.includes('\uFFFD') ? file.originalname : name).replace(/[\\/\r\n\0]/gu, '_').slice(0, 180);
    const ext = path.extname(filename).toLowerCase();
    const detected = await fileTypeFromBuffer(file.buffer).catch(() => null);
    const type = TYPES[ext];
    if (!type || !detected || !type[1].includes(detected.ext)) fail('文件格式不支持或文件内容不匹配，请上传 PDF、Word、PPT、PNG 或 JPG。');
    const id = crypto.randomUUID(), storage = `learning-${id}${ext}`;
    const target = path.join(dataDir, 'media', storage);
    await fs.writeFile(target, file.buffer, { flag: 'wx' });
    try { db.prepare('INSERT INTO learning_files VALUES (?,?,?,?,?,?,?)').run(id, studentId, filename, storage, type[0], file.size, new Date().toISOString()); }
    catch (error) { await fs.rm(target, { force: true }); throw error; }
    return db.prepare('SELECT * FROM learning_files WHERE id=?').get(id);
  }
  function item(id) {
    const row = db.prepare('SELECT * FROM learning_items WHERE id=?').get(id);
    if (!row) fail('内容不存在。', 404);
    return row;
  }
  function publicItem(id, kind) {
    const row = item(id);
    if (!row.published_json || (kind && row.kind !== kind)) fail('内容不存在或已下架。', 404);
    return row;
  }
  const files = ids => ids.map(id => db.prepare('SELECT * FROM learning_files WHERE id=?').get(id)).filter(Boolean).map(fileView);
  function content(body) {
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    if (!title || title.length > 120 || description.length > 20_000) fail('标题必填且最多 120 字，正文最多 20000 字。');
    const fileIds = body.fileIds || [];
    if (!Array.isArray(fileIds) || fileIds.length > 10 || fileIds.some(id => typeof id !== 'string' || !db.prepare('SELECT 1 FROM learning_files WHERE id=? AND student_id IS NULL').get(id))) fail('附件不存在，每条内容最多 10 个附件。');
    const source = body.blocks || [];
    if (!Array.isArray(source) || source.length > 40) fail('正文最多 40 个段落或图片。');
    const blocks = source.map(block => {
      if (block?.type === 'text' && typeof block.text === 'string') return { type: 'text', text: block.text.trim() };
      if (block?.type === 'image' && typeof block.fileId === 'string') {
        const image = db.prepare('SELECT mime_type FROM learning_files WHERE id=? AND student_id IS NULL').get(block.fileId);
        if (!image?.mime_type.startsWith('image/')) fail('正文图片不存在或不是图片。');
        const caption = String(block.caption || '').trim();
        if (caption.length > 300) fail('图片说明最多 300 字。');
        return { type: 'image', fileId: block.fileId, caption };
      }
      fail('正文只支持文字和图片。');
    });
    if (blocks.reduce((sum, block) => sum + (block.text?.length || 0), description.length) > 20_000) fail('正文最多 20000 字。');
    return { title, description, blocks, fileIds: [...new Set(fileIds)] };
  }
  function adminItem(row) { return { id: row.id, kind: row.kind, draft: JSON.parse(row.draft_json), published: row.published_json ? JSON.parse(row.published_json) : null, files: files(JSON.parse(row.draft_json).fileIds), updatedAt: row.updated_at }; }
  app.get('/api/admin/learning', requireAdmin, (_req, res) => res.json(db.prepare('SELECT * FROM learning_items ORDER BY created_at DESC').all().map(adminItem)));
  app.post('/api/admin/learning/files', requireAdmin, requireMutation, upload.single('file'), async (req, res) => res.status(201).json(fileView(await saveFile(req.file))));
  app.post('/api/admin/learning', requireAdmin, requireMutation, (req, res) => {
    if (!['resource', 'assignment'].includes(req.body.kind)) fail('内容类型不正确。');
    const draft = content(req.body), id = crypto.randomUUID(), now = new Date().toISOString();
    db.prepare('INSERT INTO learning_items VALUES (?,?,?,?,?,?)').run(id, req.body.kind, JSON.stringify(draft), null, now, now);
    res.status(201).json(adminItem(item(id)));
  });
  app.put('/api/admin/learning/:id', requireAdmin, requireMutation, (req, res) => {
    item(req.params.id);
    db.prepare('UPDATE learning_items SET draft_json=?,updated_at=? WHERE id=?').run(JSON.stringify(content(req.body)), new Date().toISOString(), req.params.id);
    res.json(adminItem(item(req.params.id)));
  });
  app.post('/api/admin/learning/:id/publish', requireAdmin, requireMutation, (req, res) => {
    const row = item(req.params.id);
    content(JSON.parse(row.draft_json));
    db.prepare('UPDATE learning_items SET published_json=draft_json,updated_at=? WHERE id=?').run(new Date().toISOString(), row.id);
    res.json(adminItem(item(row.id)));
  });
  app.post('/api/admin/learning/:id/unpublish', requireAdmin, requireMutation, (req, res) => {
    item(req.params.id);
    db.prepare('UPDATE learning_items SET published_json=NULL,updated_at=? WHERE id=?').run(new Date().toISOString(), req.params.id);
    res.json(adminItem(item(req.params.id)));
  });
  app.get('/api/admin/learning/:id/submissions', requireAdmin, (req, res) => {
    if (item(req.params.id).kind !== 'assignment') fail('这不是作业。');
    const rows = db.prepare(`SELECT s.id,s.name,s.username,s.active,h.submitted_at,h.file_id FROM students s
      LEFT JOIN homework_submissions h ON h.student_id=s.id AND h.assignment_id=? ORDER BY s.name,s.username`).all(req.params.id);
    res.json(rows.map(row => ({ ...row, file: row.file_id ? files([row.file_id])[0] : null })));
  });
  app.get('/api/student/learning', requireReady, (req, res) => {
    res.json(db.prepare('SELECT * FROM learning_items WHERE published_json IS NOT NULL ORDER BY created_at DESC').all().map(row => {
      const value = JSON.parse(row.published_json);
      const submission = db.prepare('SELECT * FROM homework_submissions WHERE assignment_id=? AND student_id=?').get(row.id, req.student.id);
      return { id: row.id, kind: row.kind, ...value, files: files(value.fileIds), submission: submission ? { submittedAt: submission.submitted_at, file: files([submission.file_id])[0] } : null };
    }));
  });
  app.post('/api/student/assignments/:id/submit', requireReady, studentMutation, upload.single('file'), async (req, res) => {
    publicItem(req.params.id, 'assignment');
    const file = await saveFile(req.file, req.student.id);
    const now = new Date().toISOString();
    // Recheck after upload: an administrator may have unpublished it meanwhile.
    try {
      publicItem(req.params.id, 'assignment');
      db.prepare(`INSERT INTO homework_submissions VALUES (?,?,?,?) ON CONFLICT(assignment_id,student_id)
        DO UPDATE SET file_id=excluded.file_id,submitted_at=excluded.submitted_at`).run(req.params.id, req.student.id, file.id, now);
    } catch (error) {
      db.prepare('DELETE FROM learning_files WHERE id=?').run(file.id);
      await fs.rm(path.join(dataDir, 'media', file.storage_name), { force: true });
      throw error;
    }
    res.status(201).json({ submittedAt: now, file: fileView(file) });
  });
  function sendFile(req, res, next) {
    const file = db.prepare('SELECT * FROM learning_files WHERE id=?').get(req.params.id);
    if (!file) fail('文件不存在。', 404);
    if (!req.session?.admin_id) {
      const published = db.prepare('SELECT id,published_json FROM learning_items WHERE published_json IS NOT NULL').all();
      const allowed = published.some(row => {
        const value = JSON.parse(row.published_json);
        return value.fileIds.includes(file.id) || value.blocks?.some(block => block.type === 'image' && block.fileId === file.id);
      }) || published.some(row => db.prepare('SELECT 1 FROM homework_submissions WHERE assignment_id=? AND student_id=? AND file_id=?').get(row.id, req.student.id, file.id));
      if (!allowed) fail('文件不存在或无权访问。', 404);
    }
    res.set('Cache-Control', 'private, no-store');
    res.type(file.mime_type);
    // Only PDFs and images can be displayed by the browser. Office files download.
    if (req.query.view === '1' && /^(application\/pdf|image\/)/u.test(file.mime_type)) {
      res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
      return res.sendFile(path.join(dataDir, 'media', file.storage_name), error => { if (error) next(error); });
    }
    return res.download(path.join(dataDir, 'media', file.storage_name), file.original_name, error => { if (error) next(error); });
  }
  app.get('/api/admin/learning/files/:id', requireAdmin, sendFile);
  app.get('/api/student/files/:id', requireReady, sendFile);
}
