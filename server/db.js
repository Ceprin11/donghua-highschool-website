import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getDataDir } from './config.js';

function migrationFiles() {
  const directory = path.resolve(process.cwd(), 'migrations');
  return fs.readdirSync(directory)
    .filter((name) => /^\d+_.+\.sql$/u.test(name))
    .sort((a, b) => Number(a.split('_', 1)[0]) - Number(b.split('_', 1)[0]));
}

export function openDatabase(dataDirInput) {
  const dataDir = getDataDir(dataDirInput);
  fs.mkdirSync(dataDir, { recursive: true });
  const databasePath = path.join(dataDir, 'site.sqlite');
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version));
  const insertMigration = db.prepare('INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)');
  for (const file of migrationFiles()) {
    const version = Number(file.split('_', 1)[0]);
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(process.cwd(), 'migrations', file), 'utf8');
    const apply = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(version, file, new Date().toISOString());
    });
    apply();
  }
  return db;
}

export function closeDatabase(db) {
  if (db && db.open) db.close();
}

export function transaction(db, callback) {
  return db.transaction(callback)();
}

export function now() {
  return new Date().toISOString();
}
