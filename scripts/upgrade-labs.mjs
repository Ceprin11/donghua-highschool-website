import { parseArgs } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import { openDatabase } from '../server/db.js';
import { upgradeLabs, rollbackLabs } from '../server/lab-upgrade.js';
import { assertStopped, assertPrivateDirectory } from './data-files.mjs';
const {values} = parseArgs({options:{'data-dir':{type:'string'},apply:{type:'boolean'},rollback:{type:'string'}}});
if(!values['data-dir']) throw new Error('请明确传入 --data-dir。默认只列出计划，--apply 才修改内容。');
const directory=path.resolve(values['data-dir']);
assertPrivateDirectory(directory);
if(!values.apply && !values.rollback) {
  console.log('计划下架 pixel-vision、temperature-sampling、gesture-lab 及其专属内容；更新课程关联；补齐 CV 和 Transformer。');
} else {
  await assertStopped(directory);
  const db=openDatabase(directory);
  try {
    if(values.rollback) {
      const journal=JSON.parse(await fs.readFile(path.resolve(values.rollback),'utf8'));
      rollbackLabs(db,journal);console.log('实验内容已回滚。');
    } else {
      const backupDir=path.join(directory,'lab-upgrade-backups');await fs.mkdir(backupDir,{recursive:true});
      const name=new Date().toISOString().replaceAll(':','-');
      await db.backup(path.join(backupDir,`${name}.sqlite`));
      const journal=await upgradeLabs(db);
      const file=path.join(backupDir,`${name}.json`);await fs.writeFile(file,JSON.stringify(journal,null,2));
      console.log(JSON.stringify({changed:journal.changed,created:journal.created.length,rollbackJournal:file},null,2));
    }
  } finally {db.close();}
}
