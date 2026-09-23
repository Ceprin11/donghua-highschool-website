// Developer fixture generation only. Uses a drawn canvas, never a camera.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ ...(existsSync(chromePath) ? { executablePath: chromePath } : {}), headless: true });
try {
  const page = await browser.newPage();
  const fixtures = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120;
    const context = canvas.getContext('2d'); context.fillStyle = '#9b2635'; context.fillRect(0, 0, 160, 120);
    const image = canvas.toDataURL('image/png').split(',')[1];
    const stream = canvas.captureStream(10);
    const chunks = [], recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const finished = new Promise(resolve => { recorder.ondataavailable = event => chunks.push(event.data); recorder.onstop = resolve; });
    recorder.start();
    for (let frame = 0; frame < 5; frame++) { context.fillStyle = frame % 2 ? '#eee' : '#9b2635'; context.fillRect(frame * 20, 20, 30, 30); await new Promise(resolve => setTimeout(resolve, 100)); }
    recorder.stop(); await finished; stream.getTracks().forEach(track => track.stop());
    const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
    return { image, video: btoa(String.fromCharCode(...bytes)) };
  });
  await mkdir('tests/fixtures', { recursive: true });
  await writeFile('tests/fixtures/procedural.png', Buffer.from(fixtures.image, 'base64'));
  await writeFile('tests/fixtures/procedural.webm', Buffer.from(fixtures.video, 'base64'));
  console.log('程序生成的 PNG 与 WebM 测试素材已写入 tests/fixtures。');
} finally { await browser.close(); }
