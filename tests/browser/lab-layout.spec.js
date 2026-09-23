import { test, expect } from '@playwright/test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {createApp} from '../../server/app.js';
import {seedInitialContent} from '../../server/seed.js';
test.use({hasTouch:true,reducedMotion:'reduce'});
let app,server,dataDir;
test.beforeAll(async()=>{
  dataDir=await mkdtemp(path.join(os.tmpdir(),'lab-layout-'));
  app=createApp({dataDir,publicOrigin:'http://127.0.0.1:4173',staticDir:path.resolve('dist')});
  await seedInitialContent(app.locals.db);
  await mkdir('_project_review/20260923-lab-upgrade/layouts',{recursive:true});
  server=await new Promise(resolve=>{const s=app.listen(4173,'127.0.0.1',()=>resolve(s));});
});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve));app.locals.close();await rm(dataDir,{recursive:true,force:true});});
test('四个总入口、三个 CV 子页与旧地址重定向',async({page,browser})=>{
  console.log('验收浏览器',browser.version());
  const runtime=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/experiments/'))runtime.push(r.url());});
  await page.goto('/labs');await expect(page.locator('.lab-feature')).toHaveCount(4);
  await page.goto('/labs/cv');await expect(page.locator('.cv-gallery .lab-feature')).toHaveCount(3);
  await expect(page.locator('.cv-preview')).toHaveCount(3);
  for(const img of await page.locator('.cv-preview').all()) {
    await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  }
  expect(runtime).toEqual([]);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'_project_review/20260923-lab-upgrade/layouts/cv-desktop.png',fullPage:true});
  for(const [from,to] of [['pixel-vision','cv'],['temperature-sampling','transformer'],['gesture-lab','cv/teachable-machine'],['cv/lenet-training','cv/lenet']]){
    await page.goto(`/labs/${from}`);await expect(page).toHaveURL(new RegExp(`/labs/${to}$`));
  }
});
for(const width of [768,360])test(`上游核心操作在 ${width}px 触屏和减少动效下可用`,async({page})=>{
  test.setTimeout(120000);await page.setViewportSize({width,height:960});
  const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:4173/')){external.push(url);return route.abort();}return route.continue();});
  await page.goto('/labs/cv');await expect(page.locator('.cv-preview')).toHaveCount(3);
  await page.screenshot({path:`_project_review/20260923-lab-upgrade/layouts/cv-${width}.png`,fullPage:true});
  await page.goto('/labs/cv/teachable-machine');const frame=page.frameLocator('iframe');
  await frame.locator('#examples').tap();await expect(frame.locator('.sample')).toHaveCount(24,{timeout:90000});await frame.locator('.advanced summary').tap();
  await frame.locator('#epochs').fill('1');await frame.locator('#train').tap();
  await expect(frame.locator('#status')).toHaveText('训练完成，可以测试姿势',{timeout:60000});
  expect(await frame.locator('body').evaluate(body=>body.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`_project_review/20260923-lab-upgrade/layouts/teachable-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'进入演示模式'}).click();await page.getByRole('button',{name:'退出演示模式'}).click();
  await page.goto('/labs/cv/lenet');const lenet=page.frameLocator('iframe');
  await expect(lenet.locator('#prediction')).toHaveText('请写下一个数字',{timeout:30000});
  await lenet.locator('#signature-pad').tap();await expect(lenet.locator('#prediction')).toContainText('预测');
  await lenet.locator('#clear').tap();await expect(lenet.locator('#prediction')).toHaveText('请写下一个数字');
  await page.screenshot({path:`_project_review/20260923-lab-upgrade/layouts/lenet-${width}.png`,fullPage:true});
  await page.goto('/labs/cv/cnn-explainer');const cnn=page.frameLocator('iframe');
  await expect(cnn.locator('#cnn-layer-group-5 .node-group').first()).toBeVisible({timeout:30000});
  await cnn.locator('#cnn-layer-group-5 .node-group').first().tap();await expect(cnn.locator('#detailview .play-button')).toBeVisible();
  await cnn.locator('#detailview .square').first().tap();await cnn.locator('#detailview .delete-button').tap();
  await page.goto('/labs/transformer');const transformer=page.frameLocator('iframe');
  await expect(transformer.locator('.model-load-status')).toContainText('GPT-2 已就绪',{timeout:60000});
  const input=transformer.locator('.text-box[contenteditable]');await expect(input).toHaveAttribute('contenteditable','true',{timeout:30000});
  await input.fill('Hello world');await transformer.locator('[data-click="generate-btn"]').tap();
  await expect(transformer.locator('[data-click="embedding-step"]')).toContainText('Hello',{timeout:30000});
  await expect(transformer.locator('[data-click="generate-btn"]')).toBeEnabled({timeout:30000});
  const textbook=transformer.locator('.text-card');
  expect(await transformer.locator('.sampling-type-input').evaluate(control=>{
    const rect=control.getBoundingClientRect();
    return rect.left>=0&&rect.right<=innerWidth;
  })).toBe(true);
  await expect(textbook).toBeVisible();
  expect(await textbook.evaluate(card=>{
    const rect=card.getBoundingClientRect();
    return rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight;
  })).toBe(true);
  const pageCounter=transformer.locator('.page-counter');
  expect(await transformer.locator('.nav-section.right').evaluate(control=>{
    const rect=control.getBoundingClientRect(),card=control.closest('.text-card').getBoundingClientRect();
    return rect.right<=card.right&&rect.left>=card.left;
  })).toBe(true);
  const before=await pageCounter.textContent();
  await page.locator('iframe').evaluate(frame=>frame.scrollIntoView({block:'end'}));
  await transformer.locator('.nav-section.right').tap();
  await expect(pageCounter).not.toHaveText(before);
  await pageCounter.tap();
  await transformer.locator('.dropdown-item').last().tap();
  await expect(pageCounter).toHaveText('20 / 20');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`_project_review/20260923-lab-upgrade/layouts/transformer-${width}.png`,fullPage:true});
  expect(errors).toEqual([]);expect(external).toEqual([]);
});
