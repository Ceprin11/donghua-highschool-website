import { parseArgs } from 'node:util';
import path from 'node:path';
import { getDataDir } from '../server/config.js';
import { backupData } from './data-files.mjs';
const { values } = parseArgs({ options: { out: { type: 'string' }, stopped: { type: 'boolean' } } });
if (!values.out || !values.stopped) throw new Error('先停止服务，再执行 npm run backup -- --stopped --out 一个新的私有目录');
const result = await backupData(getDataDir(), path.resolve(values.out));
console.log(`备份完成，${result.content} 条内容、${result.media} 个实际文件。备份含敏感管理员数据，请私下保管。`);
