import { test, expect } from '@playwright/test';
import { mkdtemp, rm, mkdir, open, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createApp } from '../../server/app.js';
import { createAdmin } from '../../server/auth.js';
import { seedInitialContent } from '../../server/seed.js';

let app, server, dataDir;
const username = 'student-test-admin', password = crypto.randomBytes(20).toString('hex');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
test.beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'donghua-student-browser-'));
  app = createApp({ dataDir, publicOrigin: 'http://127.0.0.1:4173', staticDir: path.resolve('dist') });
  await seedInitialContent(app.locals.db); createAdmin(app.locals.db, username, password);
  server = await new Promise(resolve => { const s = app.listen(4173, '127.0.0.1', () => resolve(s)); });
  await mkdir('_project_review/student-system', { recursive: true });
});
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); app.locals.close(); await rm(dataDir, { recursive: true, force: true }); });
test('teacher imports students and publishes; student changes password, downloads and submits; teacher reads submission', async ({ page, browser }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/admin/login');
  await page.getByLabel('账号', { exact: true }).fill(username); await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录后台', exact: true }).click();
  await expect(page.getByText('已登录管理员')).toBeVisible();
  await page.goto('/admin/students');
  await page.getByLabel('或直接粘贴姓名').fill('张三，张三,李四');
  await page.getByRole('button', { name: '预览账号', exact: true }).click();
  await expect(page.getByLabel('张三的账号 2')).toHaveValue('zhangsan2');
  await page.getByRole('button', { name: '确认导入 3 人' }).click();
  await expect(page.getByRole('heading', { name: '账号列表 · 3' })).toBeVisible();
  const downloadWait = page.waitForEvent('download'); await page.getByRole('button', { name: '下载本次账号与初始密码' }).click();
  expect((await downloadWait).suggestedFilename()).toBe('学生账号.csv');
  await page.screenshot({ path: '_project_review/student-system/admin-students.png', fullPage: true });
  // A classroom attachment larger than the old 50 MB limit must upload without leaving the editor.
  await page.goto('/admin/resources');
  await page.getByLabel('标题', { exact: true }).fill('大文件上传检查');
  const largePath = path.join(dataDir, 'large-course.pdf');
  const largeFile = await open(largePath, 'w');
  await largeFile.write(pdf); await largeFile.truncate(120000 * 1024); await largeFile.close();
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/admin/learning/files') && response.request().method() === 'POST');
  await page.getByLabel('添加附件').setInputFiles(largePath);
  const uploadResponse = await uploaded; expect(uploadResponse.status()).toBe(201);
  const uploadResult = await uploadResponse.json();
  expect(uploadResult.size).toBe(120000 * 1024);
  const stored = app.locals.db.prepare('SELECT storage_name FROM learning_files WHERE id=?').get(uploadResult.id);
  expect((await stat(path.join(dataDir, 'media', stored.storage_name))).size).toBe(120000 * 1024);
  await expect(page).toHaveURL(/\/admin\/resources$/);
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('大文件上传检查');
  await expect(page.locator('.learning-upload-status')).toContainText('上传完成');
  expect(await readdir(path.join(dataDir, 'uploads'))).toEqual([]);
  const oversizedPath = path.join(dataDir, 'oversized.pdf');
  const oversizedFile = await open(oversizedPath, 'w'); await oversizedFile.write(pdf);
  await oversizedFile.truncate(501 * 1024 * 1024); await oversizedFile.close();
  await page.getByLabel('添加附件').setInputFiles(oversizedPath);
  await expect(page.getByRole('alert')).toContainText('超过 500 MB 上限');
  await expect(page.getByRole('alert')).toBeInViewport();
  await expect(page).toHaveURL(/\/admin\/resources$/);
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('大文件上传检查');
  await page.getByLabel('添加附件').setInputFiles({ name: '错误格式.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toContainText('文件格式不支持');
  expect(await readdir(path.join(dataDir, 'uploads'))).toEqual([]);
  for (const [route, title] of [['resources', '人工智能与社会'], ['resources', '生成式 AI 与智能内容创作'], ['resources', '视觉课程资料'], ['assignments', '第一次课程作业']]) {
    await page.goto(`/admin/${route}`);
    await page.getByLabel('标题', { exact: true }).fill(title);
    if (route === 'resources') await page.getByLabel('资料说明').fill('课程课件与课堂参考资料。');
    if (route === 'assignments') {
      await page.getByLabel('文字内容 1').fill('观察下图中的网络结构。\n记录每一层的作用，并提交你的说明。');
      await page.getByLabel('添加正文图片', { exact: true }).setInputFiles('public/lab-previews/lenet.png');
      await expect(page.getByLabel('图片说明 2')).toBeVisible();
      await page.getByLabel('图片说明 2').fill('手写数字与三维网络');
      await page.getByRole('button', { name: '添加文字', exact: true }).click();
      await page.getByLabel('文字内容 3').fill('完成后上传 Word 或 PDF 文件。');
      await page.getByRole('button', { name: '上移第 3 段' }).click();
      await expect(page.getByLabel('文字内容 2')).toHaveValue('完成后上传 Word 或 PDF 文件。');
      await page.getByRole('button', { name: '下移第 2 段' }).click();
      await page.getByRole('button', { name: '预览作业' }).click();
      await expect(page.locator('.assignment-preview img')).toBeVisible();
      await page.getByRole('button', { name: '继续编辑' }).click();
      await page.screenshot({ path: '_project_review/student-system/assignment-editor.png', fullPage: true });
      await page.getByText('附件（可选）', { exact: true }).click();
    }
    await page.getByLabel('添加附件').setInputFiles({ name: '课堂资料.pdf', mimeType: 'application/pdf', buffer: pdf });
    await expect(page.getByRole('link', { name: '课堂资料.pdf', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('草稿已保存');
    await page.locator('.learning-admin-item').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).getByRole('button', { name: '发布', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('已发布');
  }
  const studentContext = await browser.newContext();
  const student = await studentContext.newPage(); student.on('pageerror', e => errors.push(e.message));
  await student.goto('http://127.0.0.1:4173/assignments');
  await expect(student).toHaveURL(/\/student\/login/);
  await student.getByLabel('账号', { exact: true }).fill('zhangsan'); await student.getByLabel('密码', { exact: true }).fill('zhangsan');
  await student.getByRole('button', { name: '登录', exact: true }).click();
  await expect(student.getByRole('heading', { name: '设置新密码' })).toBeVisible();
  await student.getByLabel('当前密码').fill('zhangsan'); await student.getByLabel('新密码', { exact: true }).fill('student-password-2026'); await student.getByLabel('确认新密码').fill('student-password-2026');
  await student.getByRole('button', { name: '保存新密码' }).click();
  await expect(student).toHaveURL(/\/assignments$/);
  await expect(student.getByRole('heading', { name: '第一次课程作业' })).toBeVisible();
  await expect(student.getByText('观察下图中的网络结构。', { exact: false })).toBeVisible();
  const bodyImage = student.locator('.assignment-body img');
  await expect(bodyImage).toBeVisible();
  await expect(bodyImage).toHaveJSProperty('complete', true);
  expect(await bodyImage.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(student.locator('.assignment-body figcaption')).toHaveText('手写数字与三维网络');
  await student.getByLabel('作业文件').focus();
  await expect(student.getByLabel('作业文件')).toBeFocused();
  await student.getByLabel('作业文件').setInputFiles({ name: '张三作业.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(student.locator('.student-upload-name')).toHaveText('张三作业.pdf');
  await student.getByRole('button', { name: '提交作业', exact: true }).click();
  await expect(student.getByRole('status')).toHaveText('提交成功');
  await expect(student.getByRole('button', { name: '重新提交', exact: true })).toBeVisible();
  await student.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await student.screenshot({ path: '_project_review/student-system/student-assignment.png', fullPage: true, animations: 'disabled' });
  for (const width of [1440, 1024, 768, 360]) {
    await student.setViewportSize({ width, height: 900 });
    expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`).toBe(true);
    const imageBox = await bodyImage.boundingBox();
    expect(imageBox.width).toBeLessThanOrEqual(width);
  }
  await student.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await student.screenshot({ path: '_project_review/student-system/student-mobile.png', fullPage: true, animations: 'disabled' });
  await student.goto('http://127.0.0.1:4173/downloads');
  await expect(student.getByRole('heading', { name: '视觉课程资料' })).toBeVisible();
  const fileWait = student.waitForEvent('download'); await student.getByRole('link', { name: '下载', exact: true }).first().click(); expect((await fileWait).suggestedFilename()).toBe('课堂资料.pdf');
  await student.reload(); await expect(student.getByRole('heading', { name: '视觉课程资料' })).toBeVisible();
  for (const width of [1440, 768, 360]) {
    await student.setViewportSize({ width, height: 900 });
    expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `downloads overflow at ${width}`).toBe(true);
    for (const heading of await student.locator('.student-resource h2').all()) {
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
    }
    await student.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await student.screenshot({ path: `_project_review/student-system/downloads-${width}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.getByRole('button', { name: '查看提交', exact: true }).click();
  await expect(page.getByText('已提交 1 / 3 人', { exact: true })).toBeVisible();
  await expect(page.getByText('张三作业.pdf', { exact: true })).toBeVisible();
  const viewed = page.waitForEvent('popup'); await page.getByRole('link', { name: '查看', exact: true }).click(); const popup = await viewed; await expect(popup).toHaveURL(/api\/admin\/learning\/files/); await popup.close();
  await page.screenshot({ path: '_project_review/student-system/admin-submissions.png', fullPage: true });
  await studentContext.close(); expect(errors).toEqual([]);
});
