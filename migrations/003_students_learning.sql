CREATE TABLE students (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
 must_change_password INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);
CREATE TABLE student_sessions (
 id TEXT PRIMARY KEY, student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
 csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX student_sessions_student ON student_sessions(student_id);
CREATE TABLE learning_files (
 id TEXT PRIMARY KEY, student_id TEXT REFERENCES students(id),
 original_name TEXT NOT NULL, storage_name TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE learning_items (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('resource','assignment')),
 draft_json TEXT NOT NULL, published_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE homework_submissions (
 assignment_id TEXT NOT NULL REFERENCES learning_items(id),
 student_id TEXT NOT NULL REFERENCES students(id),
 file_id TEXT NOT NULL REFERENCES learning_files(id), submitted_at TEXT NOT NULL,
 PRIMARY KEY(assignment_id, student_id)
);
