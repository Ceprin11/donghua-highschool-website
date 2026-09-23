import fs from 'node:fs/promises';
import path from 'node:path';
import { createApp } from './app.js';
import { getDataDir } from './config.js';
import { assertStopped } from '../scripts/data-files.mjs';

const dataDir = getDataDir();
const port = Number(process.env.PORT || 3001);
const publicOrigin = process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须是有效端口');
if (process.env.NODE_ENV === 'production' && !publicOrigin.startsWith('https://')) throw new Error('生产环境必须配置 HTTPS 的 PUBLIC_ORIGIN');
await fs.mkdir(dataDir, { recursive: true });
await assertStopped(dataDir);
const marker = path.join(dataDir, 'server.pid');
await fs.writeFile(marker, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
const probe = path.join(dataDir, '.startup-probe');
await fs.writeFile(probe, 'ok'); await fs.unlink(probe);
const trustProxy = process.env.TRUST_PROXY === '1' ? 1 : process.env.TRUST_PROXY || false;
const app = createApp({ dataDir, publicOrigin, staticDir: path.resolve('dist'), trustProxy });
app.locals.db.prepare('SELECT count(*) AS count FROM content_records').get();
let closing = false;
const server = app.listen(port, '0.0.0.0', () => console.log(`服务已启动，端口 ${port}；公开来源 ${publicOrigin}`));
async function close() {
  if (closing) return; closing = true;
  await new Promise(resolve => server.close(resolve));
  app.locals.close(); await fs.rm(marker, { force: true });
}
server.on('error', async error => { console.error(`启动失败：${error.code || error.message}`); await close(); process.exitCode = 1; });
process.on('SIGINT', () => { close().then(() => process.exit(0)); });
process.on('SIGTERM', () => { close().then(() => process.exit(0)); });
