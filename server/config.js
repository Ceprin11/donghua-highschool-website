import path from 'node:path';

export const CONTENT_KINDS = Object.freeze([
  'settings',
  'teacher',
  'themes',
  'experiments',
  'presets',
  'quizzes',
  'works',
  'activities',
]);

export function normalizeKind(value) {
  const key = String(value || '').trim();
  const kind = key;
  if (!CONTENT_KINDS.includes(kind)) {
    const error = new Error(`Unknown content kind: ${key}`);
    error.statusCode = 404;
    error.code = 'UNKNOWN_CONTENT_KIND';
    throw error;
  }
  return kind;
}

export function getDataDir(input) {
  const directory = path.resolve(input || process.env.DATA_DIR || path.join(process.cwd(), 'data'));
  const projectRoot = path.resolve(process.cwd());
  for (const name of ['public', 'dist']) {
    const forbidden = path.join(projectRoot, name);
    const relative = path.relative(forbidden, directory);
    const inside = relative === ''
      || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
    if (inside) throw new Error('DATA_DIR must be outside the public and dist directories');
  }
  return directory;
}

export function getPublicOrigin(input) {
  const origin = input || process.env.PUBLIC_ORIGIN || 'http://localhost:3000';
  try {
    return new URL(origin).origin;
  } catch {
    throw new Error(`PUBLIC_ORIGIN must be an absolute origin: ${origin}`);
  }
}

export const LIMITS = Object.freeze({
  imageBytes: 20 * 1024 * 1024,
  videoBytes: 20 * 1024 * 1024,
  jsonBytes: 2 * 1024 * 1024,
  sessionMs: 8 * 60 * 60 * 1000,
  loginWindowMs: 15 * 60 * 1000,
  loginAttempts: 8,
});
