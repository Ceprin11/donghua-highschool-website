PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS content_records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('settings','teacher','themes','experiments','presets','quizzes','works','activities')),
  slug TEXT NOT NULL,
  singleton_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  draft_json TEXT NOT NULL,
  published_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  draft_updated_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE(kind, slug),
  UNIQUE(kind, singleton_key)
);

CREATE INDEX IF NOT EXISTS idx_content_kind_status ON content_records(kind, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_content_kind_slug ON content_records(kind, slug);

CREATE TABLE IF NOT EXISTS experiment_meta (
  record_id TEXT PRIMARY KEY REFERENCES content_records(id) ON DELETE CASCADE,
  engine_key TEXT NOT NULL UNIQUE CHECK (engine_key IN ('neural','vision','temperature','maze','gesture')),
  runtime_status TEXT NOT NULL DEFAULT 'maintenance' CHECK (runtime_status IN ('ready','maintenance'))
);

CREATE TABLE IF NOT EXISTS child_content_meta (
  record_id TEXT PRIMARY KEY REFERENCES content_records(id) ON DELETE CASCADE,
  parent_experiment_id TEXT NOT NULL REFERENCES content_records(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  storage_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('image','video')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  source TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_mime ON media_assets(mime_type);

CREATE TABLE IF NOT EXISTS media_refs (
  record_id TEXT NOT NULL REFERENCES content_records(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  phase TEXT NOT NULL CHECK (phase IN ('draft','published')),
  field_path TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(record_id, media_id, phase, field_path)
);

CREATE INDEX IF NOT EXISTS idx_media_refs_media ON media_refs(media_id, phase);

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES admins(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT '',
  record_id TEXT NOT NULL DEFAULT '',
  success INTEGER NOT NULL DEFAULT 1 CHECK (success IN (0,1)),
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at);
