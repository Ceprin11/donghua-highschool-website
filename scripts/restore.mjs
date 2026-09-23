import { parseArgs } from 'node:util';
import path from 'node:path';
import { restoreData } from './data-files.mjs';
const { values } = parseArgs({ options: { from: { type: 'string' }, to: { type: 'string' } } });
if (!values.from || !values.to) throw new Error('用法 npm run restore -- --from 备份目录 --to 新的恢复目录');
const result = await restoreData(path.resolve(values.from), path.resolve(values.to));
console.log(`已恢复到新目录并校验，${result.content} 条内容、${result.media} 个实际文件。旧会话已失效。请确认后将 DATA_DIR 指向该目录。`);
