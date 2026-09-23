import { openDatabase } from '../server/db.js';
const db = openDatabase();
try { console.log(`数据库迁移完成，当前版本 ${db.prepare('SELECT max(version) AS version FROM schema_migrations').get().version}`); }
finally { db.close(); }
