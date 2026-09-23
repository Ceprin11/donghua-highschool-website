import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createApp } from '../server/app.js';
import { getDataDir } from '../server/config.js';
import { upgradeLabs } from '../server/lab-upgrade.js';
import { openDatabase } from '../server/db.js';

const root=path.resolve(import.meta.dirname,'..');
const source=getDataDir();
const dataDir=path.join(root,'_project_review/20260923-lab-upgrade/preview-data');
const marker=path.join(dataDir,'preview-ready.json');
await fs.mkdir(dataDir,{recursive:true});
try { await fs.access(marker); }
catch {
  const sourceFile=path.join(source,'site.sqlite');
  try {
    await fs.access(sourceFile);
    const db=new Database(sourceFile,{readonly:true,fileMustExist:true});
    try { await db.backup(path.join(dataDir,'site.sqlite')); } finally {db.close();}
    await fs.cp(path.join(source,'media'),path.join(dataDir,'media'),{recursive:true}).catch(error=>{if(error.code!=='ENOENT')throw error;});
  } catch(error) {if(error.code!=='ENOENT')throw error;}
  const db=openDatabase(dataDir);
  try {
    const journal=await upgradeLabs(db);
    await fs.writeFile(path.join(dataDir,'upgrade-journal.json'),JSON.stringify(journal));
  }finally{db.close();}
  await fs.writeFile(marker,JSON.stringify({created:new Date().toISOString()}));
}
const publicOrigin='http://127.0.0.1:4180';
const app=createApp({dataDir,publicOrigin,staticDir:path.join(root,'dist'),secureCookies:false});
const server=app.listen(4180,'127.0.0.1',()=>console.log(`实验升级预览 ${publicOrigin}/labs；使用独立数据副本。`));
function close(){server.close(()=>{app.locals.close();process.exit(0);});}
process.on('SIGINT',close);process.on('SIGTERM',close);
