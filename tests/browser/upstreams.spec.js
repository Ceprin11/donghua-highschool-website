import { test, expect } from '@playwright/test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../../server/app.js';
test.use({hasTouch:true});

let app, server, dataDir;
const externalRequests = new WeakMap();
test.beforeEach(async ({page}) => {
  externalRequests.set(page, []);
  await page.route('**/*', route => {
    const url=route.request().url();
    if (/^https?:/.test(url) && !url.startsWith('http://127.0.0.1:4173/')) {
      externalRequests.get(page).push(url); return route.abort();
    }
    return route.continue();
  });
});
test.afterEach(async ({page}) => { expect(externalRequests.get(page)).toEqual([]); });
test.beforeAll(async () => {
  await mkdir('public/lab-previews',{recursive:true});
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'donghua-upstreams-'));
  app = createApp({ dataDir, publicOrigin: 'http://127.0.0.1:4173', staticDir: path.resolve('dist') });
  server = await new Promise(resolve => { const s = app.listen(4173, '127.0.0.1', () => resolve(s)); });
});
test('LeNet 手写与三维推理', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/experiments/tensorspace/examples/lenet/lenet.html');
  await expect(page.locator('#prediction')).toHaveText('请写下一个数字', { timeout: 30000 });
  const canvas = page.locator('#signature-pad'); const box = await canvas.boundingBox();
  await page.mouse.move(box.x+110,box.y+35); await page.mouse.down();
  await page.mouse.move(box.x+110,box.y+190,{steps:20}); await page.mouse.up();
  await expect(page.locator('#prediction')).toContainText('预测');
  await page.screenshot({path:'_project_review/20260923-lab-upgrade/lenet-prediction.png'});
  await page.locator('#container').screenshot({path:'public/lab-previews/lenet.png'});
  await page.locator('#reset-view').click(); await page.locator('#clear').click();
  await expect(page.locator('#prediction')).toHaveText('请写下一个数字');
  await page.mouse.move(box.x+110,box.y+35); await page.mouse.down();
  for(let angle=0;angle<=Math.PI*2+.1;angle+=.2) await page.mouse.move(box.x+110+55*Math.sin(angle),box.y+110-75*Math.cos(angle));
  await page.mouse.up(); await expect(page.locator('#prediction')).toContainText('预测');
  const view=await page.locator('#container').boundingBox();
  await page.mouse.move(view.x+view.width/2,view.y+view.height/2);await page.mouse.down();
  await page.mouse.move(view.x+view.width/2+90,view.y+view.height/2+45,{steps:10});await page.mouse.up();
  await page.mouse.wheel(0,120); await page.locator('#reset-view').click();
  expect(errors).toEqual([]);
});
test('Transformer 本地模型与词元', async ({ page }) => {
  test.setTimeout(180000);
  const errors=[], external=[];
  page.on('pageerror',error=>{errors.push(error.message);console.log('TRANSFORMER',error.message);});
  page.on('console',message=>{if(message.type()==='error')console.log('ORT',message.text());});
  page.on('requestfailed',request=>console.log('FAILED',request.url(),request.failure()?.errorText));
  page.on('response',response=>{if(response.status()>=400)console.log('HTTP',response.status(),response.url());});
  await page.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:4173/')){external.push(url);return route.abort();}return route.continue();});
  await page.goto('/experiments/transformer/');
  await expect(page.locator('#app')).toBeVisible({timeout:30000});
  await expect(page.locator('.model-load-status')).toHaveText(/GPT-2 已就绪|模型加载失败/,{timeout:150000});
  await expect(page.locator('.model-load-status')).toContainText('GPT-2 已就绪');
  await expect(page.locator('[contenteditable="true"]').first()).toBeVisible({timeout:30000});
  const input=page.locator('.text-box[contenteditable]');
  await input.fill('The cat is');await page.locator('[data-click="generate-btn"]').click();
  await expect(page.locator('[data-click="embedding-step"]')).toContainText('cat',{timeout:60000});
  await expect(page.locator('[data-click="embedding-step"]')).not.toContainText('visualization');
  await expect(page.locator('[data-click="generate-btn"]')).toBeEnabled({timeout:60000});
  await expect(page.locator('.predicted')).not.toBeEmpty();
  await expect(input).toContainText('The cat is');
  await page.getByRole('button',{name:'✕',exact:true}).click();
  const tokenView=page.locator('[data-click="embedding-step"]');
  await page.locator('[data-click="embedding-step-title"]').click();await expect(tokenView).toHaveClass(/expanded/);
  await page.screenshot({path:'_project_review/20260923-lab-upgrade/transformer-embedding.png'});
  await page.locator('[data-click="embedding-step-title"]').click();await expect(tokenView).not.toHaveClass(/expanded/);
  await page.locator('.attention-result').first().click();
  await expect(page.locator('[data-click="attention-step"]').first()).toHaveClass(/expanded/);
  await page.screenshot({path:'_project_review/20260923-lab-upgrade/transformer-attention.png'});
  await page.locator('.main-section').click({position:{x:5,y:5}});
  await expect(page.locator('[data-click="attention-step"]').first()).not.toHaveClass(/expanded/);
  await page.getByRole('radio',{name:'Top-p',exact:true}).check();
  await page.locator('.temperature-input input[type="range"]').fill('8');
  await page.locator('[data-click="generate-btn"]').click();await expect(page.locator('[data-click="generate-btn"]')).toBeEnabled({timeout:60000});
  await page.screenshot({path:'_project_review/20260923-lab-upgrade/transformer-first.png'});
  const article=page.locator('#description');
  await expect(article.getByRole('heading',{name:'什么是 Transformer？',exact:true})).toBeVisible();
  await expect(article.getByRole('heading',{name:'原项目作者',exact:true})).toBeVisible();
  await expect(article.locator('img')).toHaveCount(5);
  expect(await article.locator('img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0&&img.alt.length>0))).toBe(true);
  await expect(article.locator('.katex')).toHaveCount(1);await expect(article.locator('.katex-error')).toHaveCount(0);
  await expect(article).not.toContainText('What is a Transformer?');
  await article.locator('h1').first().evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:'_project_review/20260923-pose-upgrade/transformer-article-desktop.png'});
  await page.setViewportSize({width:360,height:800});
  await page.evaluate(()=>{location.hash='article-token-embedding';});
  await expect.poll(()=>page.locator('#article-token-embedding').evaluate(el=>Math.abs(el.getBoundingClientRect().top-100))).toBeLessThan(5);
  expect(await article.evaluate(el=>{const rect=el.getBoundingClientRect();return rect.left>=0&&rect.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1;})).toBe(true);
  await article.locator('h1').first().evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:'_project_review/20260923-pose-upgrade/transformer-article-mobile.png'});
  expect(errors).toEqual([]);expect(external).toEqual([]);
});
test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve)); app.locals.close();
  await rm(dataDir, { recursive: true, force: true });
});
test('CNN 原版模型与切图', async ({ page }) => {
  const errors = [], external = [], failed = [];
  page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR', error.message); });
  page.on('console', message => { if (message.type() === 'error') console.log('CONSOLE', message.text()); });
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (/^https?:/.test(url) && !url.startsWith('http://127.0.0.1:4173/')) { external.push(url); return route.abort(); }
    return route.continue();
  });
  await page.goto('/experiments/cnn-explainer/index.html');
  await expect(page.locator('#cnn-svg image').first()).toBeVisible({ timeout: 30000 });
  const numeric = await page.evaluate(()=>{
    const conv=document.querySelector('#cnn-layer-group-1 .node-group').__data__;
    const errors=[];
    for(const [y,x] of [[0,0],[12,19],[30,30]]) {
      let value=conv.bias;
      for(const link of conv.inputLinks) for(let ky=0;ky<link.weight.length;ky++) for(let kx=0;kx<link.weight[ky].length;kx++) value+=link.weight[ky][kx]*link.source.output[y+ky][x+kx];
      errors.push(Math.abs(value-conv.output[y][x]));
    }
    return {error:Math.max(...errors),tensors:window.tf.memory().numTensors};
  });
  expect(numeric.error).toBeLessThan(0.0001);
  await page.screenshot({ path: '_project_review/20260923-lab-upgrade/cnn-local-adapted.png', fullPage: true });
  await page.locator('#cnn-svg').screenshot({path:'public/lab-previews/cnn-explainer.png'});
  const before = await page.locator('#cnn-svg').innerHTML();
  await page.locator('.image-container[data-imagename]').nth(1).click();
  await expect.poll(() => page.locator('#cnn-svg').innerHTML()).not.toBe(before);
  await page.locator('#detailed-button').click();
  await page.locator('#cnn-layer-group-1 .node-group').first().click();
  await expect(page.locator('.intermediate-node').first()).toBeVisible();
  await page.locator('.intermediate-node').first().click();
  await expect(page.locator('#detailview .play-button')).toBeVisible();
  await page.locator('#detailview .play-button').click();
  await page.screenshot({path:'_project_review/20260923-lab-upgrade/cnn-convolution.png'});
  await page.locator('#detailview .delete-button').click();
  await page.locator('#cnn-svg').click({position:{x:4,y:4}});
  await expect(page.locator('#detailed-button')).toBeEnabled();
  await page.locator('#cnn-layer-group-5 .node-group').first().click();
  await expect(page.locator('#detailview .play-button')).toBeVisible();
  await page.screenshot({path:'_project_review/20260923-lab-upgrade/cnn-pooling.png'});
  await page.locator('#detailview .delete-button').click();
  await expect(page.locator('#detailed-button')).toBeEnabled();
  await page.screenshot({ path: '_project_review/20260923-lab-upgrade/cnn-details.png', fullPage: true });
  for(const index of [2,3,4]) {
    const previous=await page.locator('#cnn-svg .node-image').first().getAttribute('href');
    await page.locator('.image-container[data-imagename]').nth(index).click();
    await expect.poll(()=>page.locator('#cnn-svg .node-image').first().getAttribute('href')).not.toBe(previous);
  }
  expect(await page.evaluate(()=>window.tf.memory().numTensors)).toBeLessThanOrEqual(numeric.tensors);
  expect(errors).toEqual([]); expect(external).toEqual([]); expect(failed).toEqual([]);
});
