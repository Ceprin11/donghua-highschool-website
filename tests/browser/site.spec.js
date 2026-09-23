import { test, expect } from '@playwright/test';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createApp } from '../../server/app.js';
import { createAdmin } from '../../server/auth.js';
import { seedInitialContent } from '../../server/seed.js';
import { adminList, saveDraft, publishRecord, unpublishRecord, createRecord, deleteRecord } from '../../server/content.js';
import { storeUpload, deleteAsset } from '../../server/media.js';

let app, server, dataDir;
const username = 'verification-admin';
const password = crypto.randomBytes(24).toString('base64url');
const origin = 'http://127.0.0.1:4173';
const errors = new Map(), external = new Map();
test.beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'donghua-browser-'));
  app = createApp({ dataDir, publicOrigin: origin, staticDir: path.resolve('dist') });
  await seedInitialContent(app.locals.db);
  createAdmin(app.locals.db, username, password);
  server = await new Promise(resolve => { const instance = app.listen(4173, '127.0.0.1', () => resolve(instance)); });
  await mkdir('docs/screenshots', { recursive: true });
});
test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  app?.locals.close();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});
test.beforeEach(async ({ page }) => {
  errors.set(page, []); external.set(page, []);
  page.on('pageerror', error => errors.get(page).push(error.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (/^https?:/.test(url) && !url.startsWith(`${origin}/`)) { external.get(page).push(url); return route.abort(); }
    return route.continue();
  });
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page), '浏览器未处理异常').toEqual([]);
  expect(external.get(page), '生产页面必须仅请求本地资源').toEqual([]);
});
async function settled(page) { await expect(page.locator('main')).toBeVisible(); await expect(page.getByRole('status').filter({ hasText: /正在加载|正在准备|正在载入/ })).toHaveCount(0); }
async function login(page) {
  await page.goto('/admin/login');
  await page.getByLabel('账号', { exact: true }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录后台', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('已登录管理员', { exact: true })).toBeVisible();
}

test('production resources return correct types and missing API/media/models never return SPA HTML', async ({ request }) => {
  const health = await request.get('/api/health'); expect(health.ok()).toBe(true);
  for (const route of ['/api/not-found', '/media/not-found', '/models/not-found', '/models/not-found.wasm', '/.env', '/data/site.sqlite', '/_project_review/20260922-223119/PROJECT_AUDIT.md']) {
    const response = await request.get(route); expect(response.status(), route).toBe(404);
    expect(response.headers()['content-type'] || '', route).not.toContain('text/html');
  }
  const wasm = await request.get('/experiments/transformer/wasm/ort-wasm-simd-threaded.wasm');
  expect(wasm.ok()).toBe(true); expect(wasm.headers()['content-type']).toContain('application/wasm');
  const html = await request.get('/labs/cv/teachable-machine'); expect(html.ok()).toBe(true); expect(html.headers()['content-type']).toContain('text/html');
});

for (const width of [1440, 768, 360]) {
  test(`public pages and all lab routes render without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const routes = ['/', '/courses', '/labs', '/works', '/about', '/labs/neural-network', '/labs/cv', '/labs/transformer', '/labs/reward-maze', '/labs/cv/cnn-explainer', '/labs/cv/lenet', '/labs/cv/lenet-training', '/labs/cv/teachable-machine'];
    for (const route of routes) {
      await page.goto(route); await settled(page);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `横向溢出 ${route}`).toBe(true);
      if (route === '/') await page.screenshot({ path: `docs/screenshots/home-${width}.png`, fullPage: true });
    }
    await page.reload(); await settled(page);
    await expect(page.frameLocator('iframe.upstream-lab-frame').getByRole('button', { name: '开启摄像头', exact: true })).toBeVisible();
  });
}
test('homepage preview trains, pauses, resets and changes datasets without stale metrics', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await settled(page);
  const preview = page.getByLabel('神经网络训练预览', { exact: true });
  const step = preview.getByTestId('preview-step');
  await expect(step).toHaveText('000');
  await preview.getByRole('button', { name: '开始训练', exact: true }).click();
  await expect.poll(async () => Number(await step.textContent())).toBeGreaterThan(0);
  await preview.getByRole('button', { name: '暂停训练', exact: true }).click();
  const paused = await step.textContent();
  await preview.getByRole('button', { name: '圆环', exact: true }).click();
  await expect(step).toHaveText(paused);
  await preview.getByRole('button', { name: '交叉', exact: true }).click();
  await expect(step).toHaveText('000');
  await expect(preview.getByRole('button', { name: '交叉', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await preview.getByRole('button', { name: '开始训练', exact: true }).click();
  await expect.poll(async () => Number(await step.textContent())).toBeGreaterThan(0);
  await preview.getByRole('button', { name: '暂停训练', exact: true }).click();
  await preview.getByRole('button', { name: '重新训练', exact: true }).click();
  await expect(step).toHaveText('000');
  await expect(preview.locator('.preview-loss polyline')).toHaveAttribute('points', '');
  await preview.getByRole('link', { name: '打开实验', exact: true }).click();
  await expect(page.getByRole('heading', { name: '神经网络训练', exact: true })).toBeVisible();
  await expect(page.getByText(/中文简化版|独立教学实现/)).toHaveCount(0);
});

test('homepage course panels, mobile navigation and reduced motion remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await settled(page);
  const vision = page.getByRole('button', { name: '02 用计算机视觉理解现实世界', exact: true });
  await vision.click();
  await expect(vision).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('计算机看到的世界是什么样？', { exact: true })).toBeVisible();
  await expect(page.getByText('机器是怎样学会分类的？', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: '04 从大模型到具身智能', exact: true }).click();
  await expect(page.locator('.maze-path')).toHaveCSS('stroke-dashoffset', '0px');
  for (const section of await page.locator('.reveal-section').all()) await expect(section).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: '01 人工智能与社会', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/screenshots/home-redesign-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: '菜单', exact: true }).click();
  const nav = page.getByRole('navigation', { name: '手机导航', exact: true });
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: '互动实验室', exact: true }).click();
  await expect(page).toHaveURL(/\/labs$/);
  await expect(nav).toHaveCount(0);
  await page.goto('/'); await settled(page);
  await expect(page.getByTestId('preview-step')).toHaveText('000');
  await page.screenshot({ path: 'docs/screenshots/home-redesign-mobile.png', fullPage: true });
});

test('course chapters are fully displayed and subpages share the responsive visual system', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/courses'); await settled(page);
  await expect(page.locator('.course-chapter')).toHaveCount(4);
  await expect(page.getByText('学习方式', { exact: true })).toHaveCount(0);
  await expect(page.locator('.course-chapter button')).toHaveCount(0);
  await page.getByRole('navigation', { name: '课程主题', exact: true }).getByRole('link', { name: /计算机视觉/ }).click();
  await expect(page).toHaveURL(/#computer-vision$/);
  await expect.poll(async () => page.locator('#computer-vision').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(60);
  await expect.poll(async () => page.locator('#computer-vision').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeLessThan(240);
  for (const width of [1440, 768, 360]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of ['/courses', '/labs', '/about', '/works', '/credits']) {
      await page.goto(route); await settled(page);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${route} at ${width}`).toBe(true);
      await expect(page.locator('.page-heading h1')).toHaveCSS('font-weight', '400');
      if (width !== 768 && ['/courses', '/labs', '/about', '/works'].includes(route)) await page.screenshot({ path: `docs/screenshots/subpage-${route.slice(1)}-${width}.png`, fullPage: true });
    }
  }
  await page.goto('/courses'); await settled(page);
  await page.locator('#intro-ai .course-card-link').click();
  await page.locator('.course-related-links a').click();
  await expect(page.getByRole('heading', { name: '神经网络训练', exact: true })).toBeVisible();
});

test('student work lists all themes and types without filters and keeps article media and text', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const asset = await storeUpload({ db: app.locals.db, dataDir, file: { buffer: await readFile('tests/fixtures/procedural.png'), originalname: 'layout-test.png', mimetype: 'image/png' }, description: '临时版式测试图' });
  const video = await storeUpload({ db: app.locals.db, dataDir, file: { buffer: await readFile('tests/fixtures/procedural.webm'), originalname: 'layout-test.webm', mimetype: 'video/webm' }, description: '临时版式测试视频' });
  const titles = ['像素里的四季', '让机器人找到出口', '一句话的不同可能', '用手势画一幅画', '我训练的第一个网络', '一次关于颜色的实验'];
  const created = [];
  try {
    for (let i = 0; i < titles.length; i++) {
      const row = await createRecord(app.locals.db, 'works', { slug: `layout-example-${i}`, title: titles[i], author_display_name: '版式测试小组', theme_slug: ['intro-ai', 'computer-vision', 'generative-ai', 'embodied-intelligence'][i % 4], work_type: ['image', 'project', 'video', 'interactive'][i % 4], summary: '观察、尝试，再把发现记录下来。这是一份用于检验作品页面排版的临时样例。', body: '我们从一个问题开始。\n\n改变参数后，记录屏幕里的变化，再写下自己的解释。', creative_highlights: '比较两次尝试的不同结果。', ai_knowledge: '像素、概率与数据分类。', cover_asset_id: i === 0 ? asset.id : '', image_asset_ids: i === 0 ? [asset.id] : [], video_asset_id: i === 0 ? video.id : '', demo_url: i === 0 ? 'https://example.com/student-work' : '', is_demo: true, sort_order: i });
      created.push(row.id); await publishRecord(app.locals.db, 'works', row.id);
    }
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto('/works'); await settled(page);
      await expect(page.getByRole('combobox')).toHaveCount(0);
      await expect(page.getByText('筛选', { exact: true })).toHaveCount(0);
      await expect(page.locator('.work-story')).toHaveCount(6);
      await expect(page.getByRole('heading', { name: titles[5], exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `docs/screenshots/works-layout-examples-${width}.png`, fullPage: true });
      await page.getByRole('heading', { name: titles[0], exact: true }).click();
      await expect(page.locator('h1')).toHaveText(titles[0]);
      await expect(page.locator('.article-prose')).toContainText('改变参数后');
      await expect(page.getByRole('img', { name: '作品图集 1', exact: true })).toBeVisible();
      expect(await page.getByRole('img', { name: '作品图集 1', exact: true }).evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      await expect(page.locator('video')).toHaveAttribute('src', `/media/${video.id}`);
      await expect(page.getByRole('link', { name: '打开作品', exact: true })).toHaveAttribute('href', 'https://example.com/student-work');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `docs/screenshots/work-detail-layout-example-${width}.png`, fullPage: true });
    }
  } finally {
    for (const id of created) deleteRecord(app.locals.db, 'works', id);
    await deleteAsset({ db: app.locals.db, dataDir, id: asset.id });
    await deleteAsset({ db: app.locals.db, dataDir, id: video.id });
  }
});
test('maintenance, missing detail and server errors are distinct', async ({ page }) => {
  const experiment = adminList(app.locals.db, 'experiments').find(row => row.draft.engine_key === 'cnn');
  await saveDraft(app.locals.db, 'experiments', experiment.id, { runtime_status: 'maintenance' });
  await publishRecord(app.locals.db, 'experiments', experiment.id);
  await page.goto('/labs/cv/cnn-explainer'); await expect(page.getByText('该实验正在维护，暂不可运行')).toBeVisible();
  await saveDraft(app.locals.db, 'experiments', experiment.id, { runtime_status: 'ready' }); await publishRecord(app.locals.db, 'experiments', experiment.id);
  await page.goto('/works/does-not-exist'); await expect(page.getByText(/作品不存在|作品未找到/)).toBeVisible();
  await page.route('**/api/content/works', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '测试服务暂不可用' }) }));
  await page.goto('/works'); await expect(page.getByRole('alert')).toContainText('加载失败');
});

test('playground features, live neuron maps, weights and training controls work on desktop and mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/labs/neural-network'); await settled(page);
  await expect(page.locator('a[href="/data-notice"]')).toHaveCount(0);
  const output = page.locator('.nn-result-map');
  const picture = () => output.evaluate(canvas => canvas.toDataURL());
  const initial = await picture();
  await page.getByRole('button', { name: '单步训练', exact: true }).click();
  await expect(page.getByTestId('neural-step')).toHaveText('1');
  expect(await picture()).not.toBe(initial);
  await page.getByRole('button', { name: '重置模型', exact: true }).click();
  await expect(page.getByTestId('neural-step')).toHaveText('0');
  expect(await picture()).toBe(initial);
  await page.getByRole('button', { name: '输入特征 X₁²', exact: true }).click();
  await expect(page.getByRole('button', { name: '输入特征 X₁²', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('激活函数', { exact: true }).selectOption('relu');
  await page.getByLabel('正则化', { exact: true }).selectOption('l2');
  await page.getByLabel('正则化强度', { exact: true }).fill('0.01');
  await page.getByRole('button', { name: '单步训练', exact: true }).click();
  expect(Number(await page.getByTestId('neural-train-loss').textContent())).toBeGreaterThan(0);
  await page.getByRole('button', { name: '查看隐藏层 1 神经元 1', exact: true }).click();
  await expect(page.locator('.nn-field-heading')).toContainText('隐藏层 1');
  await page.getByRole('button', { name: '返回分类结果', exact: true }).click();
  await page.getByRole('button', { name: /^连接 1-1-1 权重/ }).press('Enter');
  await page.getByLabel('连接权重', { exact: true }).fill('2.5');
  await expect(page.getByRole('button', { name: /^连接 1-1-1 权重/ })).toHaveAttribute('aria-label', /2.500$/);
  await page.getByRole('button', { name: '完成', exact: true }).click();
  const withoutTest = await picture();
  await page.getByLabel('显示测试数据', { exact: true }).check();
  expect(await picture()).not.toBe(withoutTest);
  await page.getByLabel('离散化输出', { exact: true }).check();
  expect(await picture()).not.toBe(withoutTest);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '增加隐藏层', exact: true }).click();
  await expect(page.getByRole('button', { name: '增加隐藏层', exact: true })).toBeDisabled();
  await expect(page.getByLabel('隐藏层 6', { exact: true })).toHaveValue('4');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '减少隐藏层', exact: true }).click();
  await page.getByRole('button', { name: '开始训练', exact: true }).click();
  await expect.poll(async () => Number(await page.getByTestId('neural-step').textContent())).toBeGreaterThan(2);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const paused = await page.getByTestId('neural-step').textContent();
  await page.getByLabel('学习率', { exact: true }).selectOption('0.1');
  await expect(page.getByTestId('neural-step')).toHaveText(paused);
  for (const width of [1440, 768, 360]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: '单步训练', exact: true })).toBeVisible();
    if (width !== 768) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `docs/screenshots/neural-playground-${width}.png`, fullPage: true }); }
  }
});

test('regression trains continuous outputs and task switching resets the model and preserves dataset choices', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/labs/neural-network'); await settled(page);
  const task = page.getByLabel('任务类型', { exact: true });
  const steps = page.getByTestId('neural-step');
  const picture = () => page.locator('.nn-result-map').evaluate(canvas => canvas.toDataURL());
  await page.getByRole('button', { name: '交叉 / XOR', exact: true }).click();
  await page.getByLabel('离散化输出', { exact: true }).check();
  await page.getByRole('button', { name: '开始训练', exact: true }).click();
  await expect.poll(async () => Number(await steps.textContent())).toBeGreaterThan(0);
  await task.selectOption('regression');
  await expect(steps).toHaveText('0');
  await expect(page.getByRole('button', { name: '开始训练', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '平面', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('离散化输出', { exact: true })).toHaveCount(0);
  await expect(page.getByText('训练准确率', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('neural-test-metric').locator('..')).toContainText('测试 RMSE');
  const initial = await picture();
  const initialError = Number(await page.getByTestId('neural-test-metric').textContent());
  await page.getByRole('button', { name: '开始训练', exact: true }).click();
  await expect.poll(async () => Number(await page.getByTestId('neural-test-metric').textContent())).toBeLessThan(initialError * .75);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  expect(await picture()).not.toBe(initial);
  await page.locator('.nn-result-map').click({ position: { x: 70, y: 70 } });
  await expect(page.locator('.nn-prediction')).toContainText('预测值');
  await expect(page.locator('.nn-prediction')).not.toContainText('概率');
  await page.getByRole('button', { name: '重置模型', exact: true }).click();
  expect(await picture()).toBe(initial);
  await page.getByRole('button', { name: '多峰曲面', exact: true }).click();
  await page.getByRole('button', { name: '单步训练', exact: true }).click();
  await expect(steps).toHaveText('1');
  await page.getByRole('button', { name: '查看隐藏层 1 神经元 1', exact: true }).click();
  await page.getByRole('button', { name: '返回回归结果', exact: true }).click();
  await page.getByLabel('显示测试数据', { exact: true }).check();
  for (const width of [1440, 768, 360]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(task).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width !== 768) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `docs/screenshots/neural-regression-${width}.png`, fullPage: true }); }
  }
  await task.selectOption('classification');
  await expect(steps).toHaveText('0');
  await expect(page.getByRole('button', { name: '交叉 / XOR', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('离散化输出', { exact: true })).not.toBeChecked();
  await expect(page.getByTestId('neural-train-metric').locator('..')).toContainText('训练准确率');
  await task.selectOption('regression');
  await expect(page.getByRole('button', { name: '多峰曲面', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '让网络学会 XOR', exact: true }).click();
  await expect(task).toHaveValue('classification');
  await expect(steps).toHaveText('0');
});

test('neural and maze challenges replace running state; data regeneration, policy and demo controls work', async ({ page }) => {
  await page.goto('/labs/neural-network'); await settled(page);
  await page.getByRole('button', { name: '让网络学会 XOR', exact: true }).click();
  await expect(page.getByLabel(/^学习率/)).toHaveValue('0.3');
  await expect(page.getByLabel('隐藏层 2', { exact: true })).toHaveValue('4');
  const steps = page.getByText('步数', { exact: true }).locator('..').locator('.font-mono');
  await page.getByRole('button', { name: '开始训练', exact: true }).click();
  await expect.poll(async () => Number(await steps.textContent())).toBeGreaterThan(0);
  await page.getByRole('button', { name: '从两团点开始', exact: true }).click();
  await expect(steps).toHaveText('0');
  await expect(page.getByLabel('隐藏层 1', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始训练', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重新生成数据', exact: true }).click();
  await expect(page.getByText(/数据种子 43/)).toBeVisible();
  await page.getByRole('button', { name: '进入演示模式', exact: true }).click();
  await expect(page.locator('.lab-demo')).toBeVisible();
  expect(await page.getByRole('button', { name: '重新生成数据', exact: true }).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape'); await expect(page.locator('.lab-demo')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/screenshots/neural-1440.png', fullPage: true });
  await page.goto('/labs/reward-maze'); await settled(page);
  await page.getByRole('button', { name: '单轮尝试', exact: true }).click();
  const rounds = page.getByText('训练轮数', { exact: true }).locator('..').locator('.font-mono');
  await expect(rounds).toHaveText('1');
  await page.getByRole('button', { name: '奖励改变会怎样', exact: true }).click();
  await expect(page.getByLabel('终点奖励', { exact: true })).toHaveValue('15');
  await expect(page.getByLabel('陷阱惩罚', { exact: true })).toHaveValue('-20');
  await expect(rounds).toHaveText('0');
  await page.getByRole('button', { name: '单轮尝试', exact: true }).click();
  await page.getByRole('button', { name: '策略试走', exact: true }).click();
  await expect(page.getByText(/当前策略经过/)).toBeVisible();
  await expect(rounds).toHaveText('1');
  await page.getByRole('button', { name: '清空学习', exact: true }).click();
  await expect(rounds).toHaveText('0');
});
test('admin routes display their editors behind real session authentication', async ({ page }) => {
  await page.goto('/admin/works'); await expect(page).toHaveURL(/\/admin\/login/);
  await login(page);
  for (const route of ['/admin/settings', '/admin/courses', '/admin/teacher', '/admin/experiments', '/admin/works', '/admin/quizzes', '/admin/media']) {
    await page.goto(route); await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.goto('/admin'); await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('main a').filter({ hasText: '可用实验' })).toContainText('6');
  await expect(page.locator('main a').filter({ hasText: '已发布题目' })).toContainText('14');
  await page.screenshot({ path: 'docs/screenshots/admin-overview.png', fullPage: true });
});
test('work editor saves private draft, publishes, preserves old version until republish and withdraws', async ({ page, request }) => {
  await login(page); await page.goto('/admin/works');
  await page.getByRole('button', { name: '新增作品', exact: true }).click();
  await page.getByLabel('唯一 slug', { exact: true }).fill('browser-verification-work');
  await page.getByLabel('作品标题', { exact: true }).fill('验收测试作品初版');
  await page.getByLabel('作者展示名', { exact: true }).fill('验收测试小组');
  await page.getByLabel('作品简介', { exact: true }).fill('这是临时验收环境中的测试记录，不是真实学生作品。');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByRole('heading', { name: '验收测试作品初版', exact: true })).toBeVisible();
  expect((await request.get('/api/content/works/browser-verification-work')).status()).toBe(404);
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await expect(page.getByRole('heading', { name: '作品预览', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await expect.poll(async () => (await request.get('/api/content/works/browser-verification-work')).status()).toBe(200);
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('作品标题', { exact: true }).fill('验收测试作品新版');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByRole('heading', { name: '验收测试作品新版', exact: true })).toBeVisible();
  expect((await (await request.get('/api/content/works/browser-verification-work')).json()).title).toBe('验收测试作品初版');
  await page.getByRole('button', { name: '发布更新', exact: true }).click();
  await expect.poll(async () => (await (await request.get('/api/content/works/browser-verification-work')).json()).title).toBe('验收测试作品新版');
  await page.getByRole('button', { name: '下架', exact: true }).click();
  await expect.poll(async () => (await request.get('/api/content/works/browser-verification-work')).status()).toBe(404);
});
test('teacher form publishes one shared profile and hidden profile disappears on both pages', async ({ page }) => {
  await login(page); await page.goto('/admin/teacher');
  await page.getByLabel('姓名', { exact: true }).fill('验收测试教师');
  await page.getByLabel('单位或学院', { exact: true }).fill('仅用于临时验收');
  await page.getByLabel('职称或身份', { exact: true }).fill('测试资料');
  await page.getByLabel('项目职责', { exact: true }).fill('验证页面同步');
  await page.getByLabel('简短介绍', { exact: true }).fill('临时测试内容，不代表实际教师信息。');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByText('教师资料已保存为草稿', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await expect(page.getByText('教师资料已发布', { exact: true })).toBeVisible();
  for (const route of ['/', '/about']) { await page.goto(route); await expect(page.getByText('验收测试教师', { exact: true })).toBeVisible(); }
  await page.goto('/admin/teacher'); await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: '保存草稿', exact: true }).click(); await expect(page.getByText('教师资料已保存为草稿', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '发布', exact: true }).click(); await expect(page.getByText('教师资料已发布', { exact: true })).toBeVisible();
  for (const route of ['/', '/about']) { await page.goto(route); await settled(page); await expect(page.getByText('验收测试教师', { exact: true })).toHaveCount(0); }
});
test('media upload and source editing persist through the real API', async ({ page, request }) => {
  await login(page); await page.goto('/admin/media');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/procedural.png');
  await page.getByPlaceholder('来源说明（可选）').fill('浏览器程序图，验收素材');
  await page.getByRole('button', { name: '上传', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'procedural.png', exact: true })).toBeVisible();
  const assets = await (await page.request.get('/api/admin/media')).json();
  const asset = assets.find(item => item.original_name === 'procedural.png');
  expect(asset).toBeTruthy();
  expect((await request.get(asset.url)).status()).toBe(404);
  await page.getByRole('button', { name: '来源', exact: true }).click();
  await page.locator('textarea').fill('更新后的程序图来源');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('来源：更新后的程序图来源', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('来源：更新后的程序图来源', { exact: true })).toBeVisible();
});

test('all five admin parameter forms and a preset save and republish through their real contract', async ({ page, request }) => {
  await login(page); await page.goto('/admin/experiments');
  const fields = { neural: ['learningRate', '学习率', '0.12'], maze: ['epsilon', '探索 ε', '0.45'] };
  const records = await (await page.request.get('/api/admin/content/experiments')).json();
  for (const record of records.filter(record => fields[record.draft.engine_key])) {
    const [key, label, value] = fields[record.draft.engine_key];
    const row = page.locator('div.rounded-lg').filter({ has: page.getByText(`/${record.slug} · ${record.draft.computation_label}`, { exact: true }) });
    await row.getByRole('button', { name: '编辑', exact: true }).click();
    expect(await page.getByLabel('唯一 slug', { exact: true }).evaluate(input => input.readOnly || input.disabled)).toBe(true);
    await page.getByLabel(label, { exact: true }).fill(value);
    if (record.draft.engine_key === 'neural') {
      await page.getByLabel('任务类型', { exact: true }).selectOption('regression');
      await page.getByLabel('回归数据集', { exact: true }).selectOption('reg-gauss');
    }
    await page.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByRole('heading', { name: '编辑实验', exact: true })).toHaveCount(0);
    const publicBefore = await (await request.get(`/api/content/experiments/${record.slug}`)).json();
    expect(publicBefore.default_config[key]).toBe(record.published.default_config[key]);
    await row.getByRole('button', { name: '发布更新', exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/content/experiments/${record.slug}`)).json()).default_config[key]).toBe(Number(value));
    if (record.draft.engine_key === 'neural') {
      const published = await (await request.get(`/api/content/experiments/${record.slug}`)).json();
      expect(published.default_config.problem).toBe('regression');
      expect(published.default_config.regressionDataset).toBe('reg-gauss');
    }
  }
  await page.getByRole('button', { name: '挑战案例与默认参数', exact: true }).click();
  const presets = await (await page.request.get('/api/admin/content/presets')).json();
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  await page.getByLabel('挑战标题', { exact: true }).fill('验收挑战配置');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByRole('heading', { name: '编辑挑战案例', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '发布更新', exact: true }).first().click();
  await expect.poll(async () => (await (await request.get(`/api/content/presets/${presets[0].slug}`)).json()).title).toBe('验收挑战配置');
});

test('course and quiz editors publish updates and create a two-option question', async ({ page, request }) => {
  await login(page); await page.goto('/admin/courses');
  await expect(page.getByRole('button', { name: '新增主题', exact: true })).toHaveCount(0);
  const courseRow = page.locator('div.rounded-xl').filter({ has: page.getByRole('heading', { name: '人工智能与社会', exact: true }) });
  await courseRow.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('主题简介', { exact: true }).fill('临时验收课程介绍');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByRole('heading', { name: '编辑课程主题', exact: true })).toHaveCount(0);
  await courseRow.getByRole('button', { name: '发布更新', exact: true }).click();
  await expect.poll(async () => (await (await request.get('/api/content/themes/intro-ai')).json()).summary).toBe('临时验收课程介绍');
  await page.goto('/admin/quizzes'); await page.getByRole('button', { name: '新增题目', exact: true }).click();
  await page.getByLabel('唯一 slug', { exact: true }).fill('browser-judge-question');
  await page.getByLabel('关联实验', { exact: true }).selectOption('neural-network');
  await page.getByLabel('题型', { exact: true }).selectOption('truefalse');
  await page.getByLabel('题目', { exact: true }).fill('临时验收判断题');
  await page.getByPlaceholder('选项 1', { exact: true }).fill('正确');
  await page.getByPlaceholder('选项 2', { exact: true }).fill('错误');
  await page.getByLabel('正确答案', { exact: true }).selectOption('a');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByText('题目已保存为草稿', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await expect.poll(async () => (await request.get('/api/content/quizzes/browser-judge-question')).status()).toBe(200);
  const saved = await (await request.get('/api/content/quizzes/browser-judge-question')).json();
  expect(saved.type).toBe('truefalse'); expect(saved.options).toHaveLength(2);
  const row = page.locator('div.rounded-xl').filter({ has: page.getByText('临时验收判断题', { exact: true }) });
  await row.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('解析', { exact: true }).fill('更新后的判断题解析');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByRole('heading', { name: '编辑题目', exact: true })).toHaveCount(0);
  await row.getByRole('button', { name: '发布更新', exact: true }).click();
  await expect.poll(async () => (await (await request.get('/api/content/quizzes/browser-judge-question')).json()).explanation).toBe('更新后的判断题解析');
});

test('site and activity media selectors persist selected files and publish actual photos', async ({ page, request }) => {
  await login(page); await page.goto('/admin/media');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/procedural.png');
  await page.getByRole('button', { name: '上传', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'procedural.png', exact: true }).first()).toBeVisible();
  await page.goto('/admin/settings');
  const choose = async label => {
    const picker = page.getByText(label, { exact: true }).locator('..');
    await picker.getByRole('button', { name: /选择素材|添加素材/ }).click();
    await page.getByRole('button', { name: 'procedural.png', exact: true }).first().click();
    const finish = page.getByRole('button', { name: '完成', exact: true });
    if (await finish.isVisible()) await finish.click();
  };
  await choose('网站主视觉图片'); await choose('双校 Logo（最多两张）');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByText('首页设置已保存为草稿', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '发布当前草稿', exact: true }).click();
  await expect(page.getByText('首页设置已发布', { exact: true })).toBeVisible();
  const settings = await (await request.get('/api/content/settings/site')).json();
  expect(settings.hero_media_asset_id).toBeTruthy(); expect(settings.logo_asset_ids).toHaveLength(1);
  await page.getByRole('button', { name: '教学活动', exact: true }).click();
  await page.getByLabel('唯一 slug', { exact: true }).fill('browser-activity');
  await page.getByLabel('活动标题', { exact: true }).fill('临时验收活动');
  await page.getByLabel('活动说明', { exact: true }).fill('临时程序图，不是真实课堂照片。');
  await choose('教学活动照片');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByText('临时验收活动', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await expect.poll(async () => (await request.get('/api/content/activities/browser-activity')).status()).toBe(200);
  for (const route of ['/', '/about']) {
    await page.goto(route); await expect(page.getByRole('img', { name: '临时验收活动', exact: true })).toBeVisible();
  }
  await page.goto('/admin/settings'); await page.getByRole('button', { name: '教学活动', exact: true }).click();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('活动说明', { exact: true }).fill('临时活动新版');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByText('临时活动新版', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '发布更新', exact: true }).click();
  await expect.poll(async () => (await (await request.get('/api/content/activities/browser-activity')).json()).description).toBe('临时活动新版');
  await page.getByRole('button', { name: '下架', exact: true }).click();
  await expect.poll(async () => (await request.get('/api/content/activities/browser-activity')).status()).toBe(404);
});

test('course cards open PPT-based details and support keyboard, mobile and publication', async ({page,request})=>{
  const courses=[
    ['intro-ai','人工智能与社会','给 AI 作文评分系统提问题'],
    ['computer-vision','用计算机视觉理解现实世界','训练自己的姿势分类器'],
    ['generative-ai','生成式 AI 与智能内容创作','制作一张城市数字名片'],
    ['embodied-intelligence','从大模型到具身智能','为走迷宫的机器人设计奖励'],
  ];
  for(const width of [1440,768,360]) {
    await page.setViewportSize({width,height:960});
    await page.emulateMedia({reducedMotion:'reduce'});
    for(const [slug,title,activity] of courses) {
      await page.goto('/courses');
      const card=page.getByRole('link',{name:'查看课程：'+title,exact:true});
      if(width===1440) {await card.focus();await page.keyboard.press('Enter');} else await card.click();
      await expect(page).toHaveURL('/courses/'+slug);
      await expect(page.locator('main h1')).toHaveText(title);
      await expect(page.locator('.course-section')).toHaveCount(4);
      await expect(page.locator('.course-outcomes li')).toHaveCount(3);
      await expect(page.getByRole('heading',{name:activity,exact:true})).toBeVisible();
      await expect(page.locator('.course-related-links a')).toHaveCount(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      if(slug==='computer-vision') {
        await page.screenshot({path:'_project_review/20260923-course-content/course-'+width+'.png',fullPage:true});
      }
    }
  }
  await page.goto('/');await page.locator('.course-answer:not([hidden]) a').click();await expect(page).toHaveURL('/courses/intro-ai');
  await page.getByRole('link',{name:/下一课/}).click();await expect(page).toHaveURL('/courses/computer-vision');
  await page.getByRole('link',{name:/计算机视觉实验室/}).click();await expect(page).toHaveURL('/labs/cv');
  await page.goto('/courses/unknown');await expect(page.getByRole('heading',{name:'课程不存在或尚未发布'})).toBeVisible();
  const hidden=adminList(app.locals.db,'themes').find(row=>row.slug==='generative-ai');
  unpublishRecord(app.locals.db,'themes',hidden.id);
  try {
    expect((await request.get('/api/content/themes/generative-ai')).status()).toBe(404);
    await page.goto('/courses/generative-ai');await expect(page.getByRole('heading',{name:'课程不存在或尚未发布'})).toBeVisible();
  } finally {await publishRecord(app.locals.db,'themes',hidden.id);}
});

test('course detail editor saves a private draft and publishes the new reading content',async({page})=>{
  await login(page);await page.goto('/admin/courses');
  const row=page.locator('div.rounded-xl').filter({has:page.getByRole('heading',{name:'从大模型到具身智能',exact:true})});
  await row.getByRole('button',{name:'编辑',exact:true}).click();
  await page.getByLabel('课程详细介绍',{exact:true}).fill('课程详情编辑验收');
  await page.getByLabel('内容 1 标题',{exact:true}).fill('感知与身体');
  await page.getByLabel('内容 1 说明',{exact:true}).fill('观察传感器如何帮助机器人感知环境。');
  await page.getByLabel('学习收获（每行一条）',{exact:true}).fill('认识传感器\\n理解奖励'.replaceAll('\\n','\n'));
  await page.getByRole('button',{name:'保存草稿',exact:true}).click();
  await expect(page.getByText('课程主题已保存为草稿')).toBeVisible();
  await page.goto('/courses/embodied-intelligence');await expect(page.locator('.page-heading')).not.toContainText('课程详情编辑验收');
  await page.goto('/admin/courses');
  await page.locator('div.rounded-xl').filter({has:page.getByRole('heading',{name:'从大模型到具身智能',exact:true})}).getByRole('button',{name:'发布更新',exact:true}).click();
  await expect(page.getByText('课程主题更新已发布')).toBeVisible();
  await page.goto('/courses/embodied-intelligence');
  await expect(page.locator('.page-heading')).toContainText('课程详情编辑验收');
  await expect(page.getByRole('heading',{name:'感知与身体',exact:true})).toBeVisible();
  await expect(page.locator('.course-outcomes li')).toHaveCount(2);
});
