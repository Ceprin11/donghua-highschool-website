import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { pinyin } from 'pinyin-pro';
import ExcelJS from 'exceljs';
import { verifyOrigin } from './auth.js';

const scrypt = promisify(crypto.scrypt);
const WEEK = 7 * 24 * 60 * 60 * 1000;
const token = () => crypto.randomBytes(32).toString('base64url');
export function fail(message, statusCode = 400) { throw Object.assign(new Error(message), { statusCode }); }
export async function studentPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)).toString('hex');
  return { salt, hash };
}
async function matches(password, student) {
  if (!student || typeof password !== 'string' || password.length > 256) return false;
  const hash = await scrypt(password, student.password_salt, 64);
  return crypto.timingSafeEqual(hash, Buffer.from(student.password_hash, 'hex'));
}
export function studentView(row) {
  return { id: row.id, name: row.name, username: row.username, active: Boolean(row.active), mustChangePassword: Boolean(row.must_change_password), createdAt: row.created_at };
}
export async function parseNames(body, file) {
  let names;
  if (file) {
    if (/\.xlsx$/iu.test(file.originalname)) {
      const workbook = new ExcelJS.Workbook();
      try { await workbook.xlsx.load(file.buffer); } catch { fail('无法读取 Excel，请使用 .xlsx 格式。'); }
      const sheet = workbook.worksheets[0];
      names = [];
      sheet?.eachRow(row => { names.push(String(row.getCell(1).text || '').trim()); });
      if (names[0] === '姓名') names.shift();
    } else if (/\.txt$/iu.test(file.originalname)) {
      names = file.buffer.toString('utf8').replace(/^\uFEFF/u, '').split(/[,，\r\n]+/u);
    } else fail('名单支持 .xlsx 和 UTF-8 编码的 .txt 文件。');
  } else names = String(body?.names || '').split(/[,，\r\n]+/u);
  names = names.map(name => name.trim()).filter(Boolean);
  if (!names.length || names.length > 500) fail('每次请输入 1 至 500 个姓名。');
  for (const name of names) if (!/^[\p{Script=Han}a-zA-Z·\s]{1,40}$/u.test(name)) fail(`姓名格式不正确：${name.slice(0, 40)}`);
  return names;
}
export function previewStudents(db, names) {
  const used = new Set(db.prepare('SELECT username FROM students').all().map(row => row.username));
  return names.map(name => {
    const base = pinyin(name, { toneType: 'none', type: 'array', mode: 'surname', v: true }).join('').toLowerCase().replace(/[^a-z]/gu, '') || 'student';
    let username = base, number = 2;
    while (used.has(username)) username = base + number++;
    used.add(username);
    return { name, username };
  });
}

export function mountStudents(app, { db, publicOrigin, secureCookies, requireAdmin, requireMutation }) {
  const secure = secureCookies ?? new URL(publicOrigin).protocol === 'https:';
  const attempts = new Map();
  const cookie = (res, id, age = WEEK / 1000) => res.append('Set-Cookie', `student_sid=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`);
  function issue(res, studentId = null) {
    const session = { id: token(), csrf_token: token(), student_id: studentId };
    db.prepare('DELETE FROM student_sessions WHERE expires_at <= ?').run(new Date().toISOString());
    db.prepare('INSERT INTO student_sessions VALUES (?,?,?,?)').run(session.id, studentId, session.csrf_token, new Date(Date.now() + WEEK).toISOString());
    cookie(res, session.id);
    return session;
  }
  app.use('/api/student', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    const id = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('student_sid='))?.slice(12);
    req.studentSession = id ? db.prepare('SELECT * FROM student_sessions WHERE id = ? AND expires_at > ?').get(id, new Date().toISOString()) : null;
    req.student = req.studentSession?.student_id ? db.prepare('SELECT * FROM students WHERE id = ? AND active = 1').get(req.studentSession.student_id) : null;
    next();
  });
  function studentMutation(req, _res, next) {
    verifyOrigin(req, publicOrigin);
    if (!req.studentSession || req.get('X-CSRF-Token') !== req.studentSession.csrf_token) fail('登录状态已失效，请刷新页面。', 403);
    next();
  }
  function requireStudent(req, _res, next) {
    if (!req.student) fail('请先登录学生账号。', 401);
    next();
  }
  function requireReady(req, res, next) {
    requireStudent(req, res, () => {});
    if (req.student.must_change_password) fail('请先修改初始密码。', 403);
    next();
  }
  app.get('/api/student/session', (req, res) => {
    const session = req.studentSession || issue(res);
    res.json({ student: req.student ? studentView(req.student) : null, csrfToken: session.csrf_token });
  });
  app.post('/api/student/login', studentMutation, async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const key = `${req.ip}:${username}`;
    const now = Date.now();
    for (const [k, a] of attempts) if (a.until < now) attempts.delete(k);
    const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
    if (attempt.count >= 8) fail('尝试次数过多，请 15 分钟后再试。', 429);
    const student = db.prepare('SELECT * FROM students WHERE username = ? AND active = 1').get(username);
    if (!await matches(req.body.password, student)) { attempt.count++; attempts.set(key, attempt); fail('账号或密码不正确，或账号已停用。', 401); }
    attempts.delete(key);
    db.prepare('DELETE FROM student_sessions WHERE id = ?').run(req.studentSession.id);
    const session = issue(res, student.id);
    res.json({ student: studentView(student), csrfToken: session.csrf_token });
  });
  app.post('/api/student/logout', studentMutation, (req, res) => {
    db.prepare('DELETE FROM student_sessions WHERE id = ?').run(req.studentSession.id);
    cookie(res, '', 0);
    res.json({ student: null });
  });
  app.post('/api/student/password', requireStudent, studentMutation, async (req, res) => {
    if (!await matches(req.body.currentPassword, req.student)) fail('当前密码不正确。');
    const password = req.body.newPassword;
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) fail('新密码需要 8 至 128 个字符。');
    if (password === req.student.username || password === req.body.currentPassword) fail('新密码不能与账号或当前密码相同。');
    const value = await studentPassword(password);
    db.transaction(() => {
      db.prepare('UPDATE students SET password_hash=?, password_salt=?, must_change_password=0 WHERE id=?').run(value.hash, value.salt, req.student.id);
      db.prepare('DELETE FROM student_sessions WHERE student_id=?').run(req.student.id);
    })();
    const session = issue(res, req.student.id);
    res.json({ student: studentView({ ...req.student, must_change_password: 0 }), csrfToken: session.csrf_token });
  });
  app.get('/api/admin/students', requireAdmin, (_req, res) => {
    res.set('Cache-Control', 'no-store').json(db.prepare('SELECT id,name,username,active,must_change_password,created_at FROM students ORDER BY created_at DESC,username').all().map(studentView));
  });
  app.get('/api/admin/students/template', requireAdmin, async (_req, res) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('学生名单');
    sheet.getColumn(1).width = 24;
    sheet.addRows([['姓名'], ['张三'], ['李四']]);
    res.set('Cache-Control', 'no-store');
    res.set('Content-Disposition', "attachment; filename*=UTF-8''%E5%AD%A6%E7%94%9F%E5%90%8D%E5%8D%95%E6%A8%A1%E6%9D%BF.xlsx");
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(Buffer.from(await workbook.xlsx.writeBuffer()));
  });
  app.post('/api/admin/students/import', requireAdmin, requireMutation, async (req, res) => {
    const rows = req.body.students;
    if (!Array.isArray(rows) || !rows.length || rows.length > 500) fail('每次导入 1 至 500 人。');
    const used = new Set(db.prepare('SELECT username FROM students').all().map(row => row.username));
    for (const row of rows) {
      if (typeof row.name !== 'string' || !/^[\p{Script=Han}a-zA-Z·\s]{1,40}$/u.test(row.name) || !/^[a-z][a-z0-9]{0,79}$/u.test(row.username)) fail('姓名或账号格式不正确。');
      if (used.has(row.username)) fail('账号已存在，请重新预览名单。', 409);
      used.add(row.username);
    }
    const prepared = [];
    for (const row of rows) prepared.push({ ...row, ...await studentPassword(row.username), id: crypto.randomUUID() });
    try {
      db.transaction(() => {
        const insert = db.prepare('INSERT INTO students(id,name,username,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?)');
        for (const row of prepared) insert.run(row.id, row.name.trim(), row.username, row.hash, row.salt, new Date().toISOString());
      })();
    } catch (error) { if (error.code?.startsWith('SQLITE_CONSTRAINT')) fail('账号已存在，请重新预览名单。', 409); throw error; }
    res.status(201).json(prepared.map(row => ({ id: row.id, name: row.name, username: row.username })));
  });
  app.put('/api/admin/students/:id', requireAdmin, requireMutation, (req, res) => {
    if (typeof req.body.active !== 'boolean') fail('请指定账号状态。');
    if (!db.prepare('UPDATE students SET active=? WHERE id=?').run(Number(req.body.active), req.params.id).changes) fail('学生不存在。', 404);
    db.prepare('DELETE FROM student_sessions WHERE student_id=?').run(req.params.id);
    res.json({ ok: true });
  });
  app.post('/api/admin/students/:id/reset-password', requireAdmin, requireMutation, async (req, res) => {
    const student = db.prepare('SELECT username FROM students WHERE id=?').get(req.params.id);
    if (!student) fail('学生不存在。', 404);
    const value = await studentPassword(student.username);
    db.transaction(() => {
      db.prepare('UPDATE students SET password_hash=?,password_salt=?,must_change_password=1 WHERE id=?').run(value.hash, value.salt, req.params.id);
      db.prepare('DELETE FROM student_sessions WHERE student_id=?').run(req.params.id);
    })();
    res.json({ ok: true });
  });
  return { requireStudent, requireReady, studentMutation };
}
