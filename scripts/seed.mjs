import { openDatabase } from '../server/db.js';
import { seedInitialContent } from '../server/seed.js';
const db = openDatabase();
try { const result = await seedInitialContent(db); console.log(`初始化完成，新增 ${result.created} 条，保留已有 ${result.skipped} 条。`); }
finally { db.close(); }
