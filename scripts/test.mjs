import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = readdirSync('tests').filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/${name}`);
if (!files.length) throw new Error('未找到测试文件');
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
