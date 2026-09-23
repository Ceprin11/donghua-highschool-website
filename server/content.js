import crypto from 'node:crypto';
import { CONTENT_KINDS, normalizeKind } from './config.js';
import { now, transaction } from './db.js';
import { ENGINE_KEYS, validateConfig as validateSharedConfig } from '../shared/experiment-config.js';
import { LAB_REGISTRY } from '../shared/lab-registry.js';

const SINGLETONS = Object.freeze({ settings: 'site', teacher: 'teacher' });
const WORK_TYPES = new Set(['project', 'image', 'video', 'interactive']);
const QUIZ_TYPES = new Set(['single', 'truefalse']);
const FIXED_THEME_SLUGS = new Set([
  'intro-ai',
  'computer-vision',
  'generative-ai',
  'embodied-intelligence',
]);
const FIXED_EXPERIMENTS = Object.freeze(Object.fromEntries(Object.entries(LAB_REGISTRY).map(([slug, lab]) => [slug, lab.engine])));

function fail(message, statusCode = 400, code = 'INVALID_CONTENT') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ensurePlainObject(value, label = 'payload') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function text(value, field, { required = false, max = 20_000 } = {}) {
  if (value === undefined || value === null) {
    if (required) fail(`${field} is required`);
    return '';
  }
  if (typeof value !== 'string') fail(`${field} must be a string`);
  const result = value.trim();
  if (required && !result) fail(`${field} is required`);
  if (result.length > max) fail(`${field} is too long`);
  return result;
}

function bool(value, field, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') fail(`${field} must be a boolean`);
  return value;
}

function integer(value, field, fallback = 0, { min = -100_000, max = 100_000 } = {}) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) fail(`${field} must be an integer between ${min} and ${max}`);
  return value;
}

function stringArray(value, field, { maxItems = 100, maxLength = 200 } = {}) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) fail(`${field} must be an array`);
  return value.map((item, index) => text(item, `${field}[${index}]`, { max: maxLength }));
}

function slug(value, field = 'slug') {
  const result = text(value, field, { required: true, max: 80 });
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,79}$/u.test(result)) {
    fail(`${field} must contain letters, numbers, underscores or hyphens`);
  }
  return result;
}

function safeUrl(value, field) {
  const result = text(value, field, { max: 2_000 });
  if (!result) return '';
  try {
    const parsed = new URL(result);
    if (!['http:', 'https:'].includes(parsed.protocol)) fail(`${field} must use http or https`);
  } catch {
    fail(`${field} must be a valid URL`);
  }
  return result;
}

function localMediaUrl(value, field) {
  const result = text(value, field, { max: 300 });
  if (result && !/^\/media\/[A-Za-z0-9_-]+$/u.test(result)) fail(`${field} must reference a local media asset`);
  return result;
}

const RESERVED_FIELDS = new Set([
  'id', '_id', 'created_at', 'created_date', 'updated_at', 'updated_date',
  'published_at', 'draft', 'published', 'status', 'record_id', 'owner_id',
]);

const REQUIRED_FIELDS = Object.freeze({
  settings: [],
  teacher: [],
  themes: ['title'],
  experiments: ['engine_key', 'title'],
  presets: ['experiment_slug', 'title'],
  quizzes: ['experiment_slug', 'question'],
  works: ['title'],
  activities: ['title'],
});

function copyInput(input, kind) {
  const source = ensurePlainObject(input);
  const output = {};
  const allowed = new Set([...Object.keys(baseDefaults(kind)), ...(REQUIRED_FIELDS[kind] || []), 'slug']);
  for (const [key, value] of Object.entries(source)) {
    if (RESERVED_FIELDS.has(key)) continue;
    if (!allowed.has(key)) fail(`Unsupported field: ${key}`, 400, 'UNSUPPORTED_FIELD');
    output[key] = value;
  }
  return output;
}

function collectMediaRefs(value, path = '', output = []) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectMediaRefs(item, `${path}[${index}]`, output));
    return output;
  }
  for (const [key, item] of Object.entries(value)) {
    const itemPath = path ? `${path}.${key}` : key;
    if (/(?:asset|media)_ids?$/iu.test(key)) {
      const values = Array.isArray(item) ? item : [item];
      for (const candidate of values) {
        if (typeof candidate === 'string' && candidate.trim()) output.push({ id: candidate.trim(), fieldPath: itemPath });
      }
      continue;
    }
    collectMediaRefs(item, itemPath, output);
  }
  return output;
}

function baseDefaults(kind) {
  if (kind === 'settings') return {
    key: 'site', site_name: '', school_names: [], logo_asset_ids: [], hero_title: '', hero_description: '',
    hero_media_asset_id: '', project_intro: '', teaching_features: [], about_text: '', contact_email: '',
    footer_text: '', filing_info: '', section_visibility: {}, featured_experiment_slugs: [], featured_work_slugs: [],
  };
  if (kind === 'teacher') return {
    key: 'teacher', name: '', photo_asset_id: '', photo_url: '', organization: '', title_or_identity: '',
    project_role: '', short_bio: '', visible: false,
  };
  if (kind === 'themes') return { summary: '', overview: '', sections: [], takeaways: [], activity_title: '', activity_description: '', discussion: '', keywords: [], cover_asset_id: '', cover_url: '', experiment_slugs: [], sort_order: 0 };
  if (kind === 'experiments') return {
    parent_slug: '', entry_kind: 'experiment',
    summary: '', theme_slug: '', cover_asset_id: '', cover_url: '', instructions: '', explanation: '', computation_label: '',
    default_config: {}, sort_order: 0, featured: false, runtime_status: 'maintenance',
  };
  if (kind === 'presets') return { task_description: '', hint: '', config: {}, sort_order: 0, challenge_kind: 'configuration' };
  if (kind === 'quizzes') return { type: 'single', options: [], correct_option_id: '', explanation: '', sort_order: 0 };
  if (kind === 'works') return {
    summary: '', body: '', theme_slug: '', work_type: 'project', author_display_name: '', ai_knowledge: '', creative_highlights: '',
    cover_asset_id: '', cover_image_url: '', image_asset_ids: [], video_asset_id: '', demo_url: '', featured: false,
    sort_order: 0, is_demo: false,
  };
  return { description: '', photo_asset_ids: [], sort_order: 0 };
}

function normalizeQuizOptions(value, type) {
  if (!Array.isArray(value)) fail('options must be an array');
  if (type === 'truefalse' && value.length !== 2) fail('truefalse questions must have exactly two options');
  if (value.length < 2 || value.length > 8) fail('questions must have 2-8 options');
  const ids = new Set();
  return value.map((option, index) => {
    ensurePlainObject(option, `options[${index}]`);
    const id = text(option.id, `options[${index}].id`, { required: true, max: 40 });
    if (ids.has(id)) fail('question option ids must be unique');
    ids.add(id);
    return { id, text: text(option.text, `options[${index}].text`, { required: true, max: 2_000 }) };
  });
}

async function validateConfig(engineKey, config, { partial = false } = {}) {
  try {
    const result = validateSharedConfig(engineKey, config || {}, { partial });
    return result === undefined ? config || {} : result;
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    error.code = error.code || 'INVALID_EXPERIMENT_CONFIG';
    throw error;
  }
}

export async function normalizePayload(db, kindInput, input, { existing = null } = {}) {
  const kind = normalizeKind(kindInput);
  const raw = { ...baseDefaults(kind), ...copyInput(input, kind) };
  if (kind === 'settings' || kind === 'teacher') {
    raw.key = SINGLETONS[kind];
    raw.slug = SINGLETONS[kind];
  } else {
    raw.slug = slug(raw.slug, 'slug');
  }
  if (kind === 'themes') {
    if (existing && existing.slug !== raw.slug) fail('Course theme slugs are fixed', 409, 'FIXED_CONTENT_IMMUTABLE');
    if (!FIXED_THEME_SLUGS.has(raw.slug)) fail('Only the four fixed course themes are supported', 400, 'FIXED_THEME_REQUIRED');
  }
  if (kind === 'settings') {
    raw.site_name = text(raw.site_name, 'site_name', { max: 300 });
    raw.school_names = stringArray(raw.school_names, 'school_names', { maxItems: 10, maxLength: 200 });
    raw.logo_asset_ids = stringArray(raw.logo_asset_ids, 'logo_asset_ids', { maxItems: 10, maxLength: 100 });
    raw.hero_title = text(raw.hero_title, 'hero_title', { max: 500 });
    raw.hero_description = text(raw.hero_description, 'hero_description', { max: 5_000 });
    raw.hero_media_asset_id = text(raw.hero_media_asset_id, 'hero_media_asset_id', { max: 100 });
    raw.project_intro = text(raw.project_intro, 'project_intro', { max: 10_000 });
    raw.teaching_features = stringArray(raw.teaching_features, 'teaching_features', { maxItems: 30, maxLength: 500 });
    raw.about_text = text(raw.about_text, 'about_text', { max: 10_000 });
    raw.contact_email = text(raw.contact_email, 'contact_email', { max: 320 });
    if (raw.contact_email && !/^\S+@\S+\.\S+$/u.test(raw.contact_email)) fail('contact_email is invalid');
    raw.footer_text = text(raw.footer_text, 'footer_text', { max: 2_000 });
    raw.filing_info = text(raw.filing_info, 'filing_info', { max: 500 });
    if (!raw.section_visibility || typeof raw.section_visibility !== 'object' || Array.isArray(raw.section_visibility)) fail('section_visibility must be an object');
    raw.section_visibility = Object.fromEntries(['themes', 'teacher', 'experiments', 'works', 'activities'].map((key) => [key, bool(raw.section_visibility[key], `section_visibility.${key}`, true)]));
    raw.featured_experiment_slugs = stringArray(raw.featured_experiment_slugs, 'featured_experiment_slugs', { maxItems: 20, maxLength: 80 });
    raw.featured_work_slugs = stringArray(raw.featured_work_slugs, 'featured_work_slugs', { maxItems: 50, maxLength: 80 });
  } else if (kind === 'teacher') {
    raw.name = text(raw.name, 'name', { max: 300 });
    raw.photo_asset_id = text(raw.photo_asset_id, 'photo_asset_id', { max: 100 });
    raw.photo_url = localMediaUrl(raw.photo_url, 'photo_url');
    raw.organization = text(raw.organization, 'organization', { max: 300 });
    raw.title_or_identity = text(raw.title_or_identity, 'title_or_identity', { max: 300 });
    raw.project_role = text(raw.project_role, 'project_role', { max: 1_000 });
    raw.short_bio = text(raw.short_bio, 'short_bio', { max: 10_000 });
    raw.visible = bool(raw.visible, 'visible', false);
  } else if (kind === 'themes') {
    raw.title = text(raw.title, 'title', { required: true, max: 300 });
    raw.summary = text(raw.summary, 'summary', { max: 3_000 });
    raw.overview = text(raw.overview, 'overview', { max: 3_000 });
    if (!Array.isArray(raw.sections) || raw.sections.length > 12) fail('sections must be an array of up to 12 items');
    raw.sections = raw.sections.map((section, index) => {
      ensurePlainObject(section, `sections[${index}]`);
      return { title: text(section.title, 'section.title', { required: true, max: 200 }), body: text(section.body, 'section.body', { required: true, max: 3_000 }) };
    });
    raw.takeaways = stringArray(raw.takeaways, 'takeaways', { maxItems: 12, maxLength: 500 });
    raw.activity_title = text(raw.activity_title, 'activity_title', { max: 300 });
    raw.activity_description = text(raw.activity_description, 'activity_description', { max: 3_000 });
    raw.discussion = text(raw.discussion, 'discussion', { max: 1_000 });
    raw.keywords = stringArray(raw.keywords, 'keywords', { maxItems: 30, maxLength: 100 });
    raw.cover_asset_id = text(raw.cover_asset_id, 'cover_asset_id', { max: 100 });
    raw.cover_url = localMediaUrl(raw.cover_url, 'cover_url');
    raw.experiment_slugs = stringArray(raw.experiment_slugs, 'experiment_slugs', { maxItems: 10, maxLength: 80 });
    raw.sort_order = integer(raw.sort_order, 'sort_order');
  } else if (kind === 'experiments') {
    raw.engine_key = text(raw.engine_key, 'engine_key', { required: true, max: 40 });
    if (!ENGINE_KEYS.includes(raw.engine_key)) fail('engine_key is not supported');
    const expectedEngine = FIXED_EXPERIMENTS[raw.slug];
    if (existing) {
      const currentMeta = db.prepare('SELECT engine_key FROM experiment_meta WHERE record_id = ?').get(existing.id);
      if (existing.slug !== raw.slug || currentMeta?.engine_key !== raw.engine_key) fail('Experiment slug and engine key are fixed', 409, 'FIXED_CONTENT_IMMUTABLE');
    }
    if (!expectedEngine || expectedEngine !== raw.engine_key) fail('Experiment is not in the fixed registry', 400, 'FIXED_EXPERIMENT_REQUIRED');
    raw.parent_slug = LAB_REGISTRY[raw.slug].parent;
    raw.entry_kind = LAB_REGISTRY[raw.slug].kind;
    raw.title = text(raw.title, 'title', { required: true, max: 300 });
    raw.summary = text(raw.summary, 'summary', { max: 3_000 });
    raw.theme_slug = text(raw.theme_slug, 'theme_slug', { max: 80 });
    raw.cover_asset_id = text(raw.cover_asset_id, 'cover_asset_id', { max: 100 });
    raw.cover_url = localMediaUrl(raw.cover_url, 'cover_url');
    raw.instructions = text(raw.instructions, 'instructions', { max: 10_000 });
    raw.explanation = text(raw.explanation, 'explanation', { max: 20_000 });
    raw.computation_label = text(raw.computation_label, 'computation_label', { max: 500 });
    raw.default_config = await validateConfig(raw.engine_key, ensurePlainObject(raw.default_config, 'default_config'));
    raw.sort_order = integer(raw.sort_order, 'sort_order');
    raw.featured = bool(raw.featured, 'featured', false);
    raw.runtime_status = text(raw.runtime_status, 'runtime_status', { max: 20 }) || 'maintenance';
    if (!['ready', 'maintenance'].includes(raw.runtime_status)) fail('runtime_status is invalid');
  } else if (kind === 'presets') {
    raw.experiment_slug = slug(raw.experiment_slug, 'experiment_slug');
    raw.title = text(raw.title, 'title', { required: true, max: 300 });
    raw.task_description = text(raw.task_description, 'task_description', { max: 5_000 });
    raw.hint = text(raw.hint, 'hint', { max: 3_000 });
    raw.config = ensurePlainObject(raw.config, 'config');
    const parent = db.prepare(`SELECT e.engine_key
                                 FROM content_records c JOIN experiment_meta e ON e.record_id = c.id
                                WHERE c.kind = 'experiments' AND c.slug = ?`).get(raw.experiment_slug);
    if (!parent) fail('Referenced experiment does not exist', 400, 'PARENT_NOT_FOUND');
    if (LAB_REGISTRY[raw.experiment_slug]?.kind !== 'experiment') fail('Challenges require a runnable experiment');
    raw.challenge_kind = LAB_REGISTRY[raw.experiment_slug].configurable ? 'configuration' : 'observation';
    raw.config = await validateConfig(parent.engine_key, raw.config, { partial: true });
    raw.sort_order = integer(raw.sort_order, 'sort_order');
  } else if (kind === 'quizzes') {
    raw.experiment_slug = slug(raw.experiment_slug, 'experiment_slug');
    raw.type = text(raw.type, 'type', { max: 20 }) || 'single';
    if (!QUIZ_TYPES.has(raw.type)) fail('quiz type is invalid');
    raw.question = text(raw.question, 'question', { required: true, max: 3_000 });
    raw.options = normalizeQuizOptions(raw.options, raw.type);
    raw.correct_option_id = text(raw.correct_option_id, 'correct_option_id', { required: true, max: 40 });
    if (!raw.options.some((option) => option.id === raw.correct_option_id)) fail('correct_option_id must reference an option');
    raw.explanation = text(raw.explanation, 'explanation', { max: 3_000 });
    raw.sort_order = integer(raw.sort_order, 'sort_order');
  } else if (kind === 'works') {
    raw.title = text(raw.title, 'title', { required: true, max: 300 });
    raw.summary = text(raw.summary, 'summary', { max: 3_000 });
    raw.body = text(raw.body, 'body', { max: 50_000 });
    raw.theme_slug = text(raw.theme_slug, 'theme_slug', { max: 80 });
    raw.work_type = text(raw.work_type, 'work_type', { max: 30 }) || 'project';
    if (!WORK_TYPES.has(raw.work_type)) fail('work_type is invalid');
    raw.author_display_name = text(raw.author_display_name, 'author_display_name', { max: 300 });
    raw.ai_knowledge = text(raw.ai_knowledge, 'ai_knowledge', { max: 10_000 });
    raw.creative_highlights = text(raw.creative_highlights, 'creative_highlights', { max: 10_000 });
    raw.cover_asset_id = text(raw.cover_asset_id, 'cover_asset_id', { max: 100 });
    raw.cover_image_url = localMediaUrl(raw.cover_image_url, 'cover_image_url');
    raw.image_asset_ids = stringArray(raw.image_asset_ids, 'image_asset_ids', { maxItems: 30, maxLength: 100 });
    raw.video_asset_id = text(raw.video_asset_id, 'video_asset_id', { max: 100 });
    raw.demo_url = safeUrl(raw.demo_url, 'demo_url');
    raw.featured = bool(raw.featured, 'featured', false);
    raw.sort_order = integer(raw.sort_order, 'sort_order');
    raw.is_demo = bool(raw.is_demo, 'is_demo', false);
  } else {
    raw.title = text(raw.title, 'title', { required: true, max: 300 });
    raw.description = text(raw.description, 'description', { max: 5_000 });
    raw.photo_asset_ids = stringArray(raw.photo_asset_ids, 'photo_asset_ids', { maxItems: 30, maxLength: 100 });
    raw.sort_order = integer(raw.sort_order, 'sort_order');
  }
  const refs = collectMediaRefs(raw);
  if (refs.length) {
    const placeholders = refs.map(() => '?').join(',');
    const found = new Set(db.prepare(`SELECT id FROM media_assets WHERE id IN (${placeholders})`).all(...refs.map((item) => item.id)).map((row) => row.id));
    const missing = refs.find((item) => !found.has(item.id));
    if (missing) fail(`Referenced media asset does not exist: ${missing.id}`, 400, 'MEDIA_NOT_FOUND');
  }
  return raw;
}

function rowPayload(row, field) {
  const payload = parseJson(row[field], {});
  if (!payload.id) payload.id = row.id;
  if (!payload.slug) payload.slug = row.slug;
  return payload;
}

function publicRow(db, row) {
  if (!row?.published_json || row.status !== 'published') return null;
  if (row.kind === 'teacher') {
    const payload = rowPayload(row, 'published_json');
    if (payload.visible !== true) return null;
  }
  return rowPayload(row, 'published_json');
}

export function parentIsPublic(db, row) {
  const content = parseJson(row.published_json, {});
  if (row.kind === 'experiments') {
    const entry = LAB_REGISTRY[content.slug];
    if (!entry) return false;
    if (!entry.parent) return true;
    const group = db.prepare("SELECT * FROM content_records WHERE kind = 'experiments' AND slug = ? AND status = 'published'").get(entry.parent);
    return Boolean(group && parseJson(group.published_json, {}).runtime_status === 'ready');
  }
  if (!['presets', 'quizzes'].includes(row.kind)) return true;
  const payload = parseJson(row.published_json, {});
  const parent = db.prepare(`
    SELECT c.*
      FROM content_records c
     WHERE c.kind = 'experiments' AND c.status = 'published'
       AND json_extract(c.published_json, '$.slug') = ?
     LIMIT 1
  `).get(payload.experiment_slug);
  if (!parent) return false;
  const published = parseJson(parent.published_json, {});
  return parent.status === 'published' && published.runtime_status === 'ready' && parentIsPublic(db, parent);
}

export function publicList(db, kindInput) {
  const kind = normalizeKind(kindInput);
  const rows = db.prepare('SELECT * FROM content_records WHERE kind = ? AND status = \'published\' ORDER BY COALESCE(json_extract(published_json, \'$.sort_order\'), 0), json_extract(published_json, \'$.slug\')').all(kind);
  return rows.filter((row) => parentIsPublic(db, row)).map((row) => publicRow(db, row)).filter(Boolean);
}

export function publicBySlug(db, kindInput, requestedSlug) {
  const kind = normalizeKind(kindInput);
  const row = db.prepare("SELECT * FROM content_records WHERE kind = ? AND status = 'published' AND json_extract(published_json, '$.slug') = ? LIMIT 1").get(kind, String(requestedSlug));
  if (!row || !parentIsPublic(db, row)) return null;
  return publicRow(db, row);
}

function envelope(row) {
  if (!row) return null;
  const draft = rowPayload(row, 'draft_json');
  const published = row.published_json ? rowPayload(row, 'published_json') : null;
  return {
    id: row.id,
    slug: row.slug,
    draft,
    published,
    status: row.status,
    draftPending: Boolean(published && JSON.stringify(draft) !== JSON.stringify(published)),
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
  };
}

export function adminList(db, kindInput) {
  const kind = normalizeKind(kindInput);
  return db.prepare('SELECT * FROM content_records WHERE kind = ? ORDER BY updated_at DESC, slug').all(kind).filter(row => {
    if (kind === 'experiments') return Boolean(LAB_REGISTRY[row.slug]);
    if (['presets', 'quizzes'].includes(kind)) return Boolean(LAB_REGISTRY[parseJson(row.draft_json, {}).experiment_slug]);
    return true;
  }).map(envelope);
}

export function adminById(db, kindInput, id) {
  const kind = normalizeKind(kindInput);
  const row = db.prepare('SELECT * FROM content_records WHERE kind = ? AND id = ?').get(kind, String(id));
  return envelope(row);
}

function assertUniqueSlug(db, kind, value, exceptId = null) {
  const row = db.prepare('SELECT id FROM content_records WHERE kind = ? AND slug = ?').get(kind, value);
  if (row && row.id !== exceptId) fail('slug already exists', 409, 'SLUG_EXISTS');
}

function assertParent(db, kind, payload) {
  if (!['presets', 'quizzes'].includes(kind)) return null;
  const parent = db.prepare(`
    SELECT c.id, c.status, e.engine_key, e.runtime_status
      FROM content_records c JOIN experiment_meta e ON e.record_id = c.id
     WHERE c.kind = 'experiments' AND c.slug = ?
  `).get(payload.experiment_slug);
  if (!parent) fail('Referenced experiment does not exist', 400, 'PARENT_NOT_FOUND');
  return parent;
}

function assertPublishedParent(db, kind, payload) {
  if (kind === 'experiments' && LAB_REGISTRY[payload.slug]?.parent) {
    const parent = publicBySlug(db, 'experiments', LAB_REGISTRY[payload.slug].parent);
    if (!parent || parent.runtime_status !== 'ready') fail('Parent group is not published', 409, 'PARENT_NOT_PUBLISHED');
  }
  if (!['presets', 'quizzes'].includes(kind)) return null;
  const parent = db.prepare(`
    SELECT c.id, c.status, c.published_json
      FROM content_records c
     WHERE c.kind = 'experiments' AND c.status = 'published'
       AND json_extract(c.published_json, '$.slug') = ?
     LIMIT 1
  `).get(payload.experiment_slug);
  if (!parent) fail('Parent experiment is not published', 409, 'PARENT_NOT_PUBLISHED');
  const published = parseJson(parent.published_json, {});
  if (published.runtime_status !== 'ready' || !publicBySlug(db, 'experiments', payload.experiment_slug)) fail('Parent experiment is not publicly available', 409, 'PARENT_NOT_PUBLISHED');
  return parent;
}

function insertMeta(db, kind, recordId, payload) {
  if (kind === 'experiments') {
    db.prepare('INSERT INTO experiment_meta(record_id, engine_key, runtime_status) VALUES (?, ?, ?)')
      .run(recordId, payload.engine_key, payload.runtime_status);
  } else if (kind === 'presets' || kind === 'quizzes') {
    const parent = assertParent(db, kind, payload);
    db.prepare('INSERT INTO child_content_meta(record_id, parent_experiment_id) VALUES (?, ?)').run(recordId, parent.id);
  }
}

function updateMeta(db, kind, recordId, payload) {
  if (kind === 'experiments') {
    db.prepare('UPDATE experiment_meta SET engine_key = ?, runtime_status = ? WHERE record_id = ?').run(payload.engine_key, payload.runtime_status, recordId);
  } else if (kind === 'presets' || kind === 'quizzes') {
    const parent = assertParent(db, kind, payload);
    db.prepare('UPDATE child_content_meta SET parent_experiment_id = ? WHERE record_id = ?').run(parent.id, recordId);
  }
}

function replaceRefs(db, recordId, phase, payload) {
  db.prepare('DELETE FROM media_refs WHERE record_id = ? AND phase = ?').run(recordId, phase);
  const insert = db.prepare('INSERT INTO media_refs(record_id, media_id, phase, field_path) VALUES (?, ?, ?, ?)');
  const seen = new Set();
  for (const ref of collectMediaRefs(payload)) {
    const key = `${ref.id}\u0000${ref.fieldPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    insert.run(recordId, ref.id, phase, ref.fieldPath);
  }
}

function log(db, actorId, action, entity, recordId, success = true, detail = '') {
  db.prepare('INSERT INTO admin_logs(actor_id, action, entity, record_id, success, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(actorId || null, action, entity || '', recordId || '', success ? 1 : 0, String(detail || '').slice(0, 2_000), now());
}

export async function createRecord(db, kindInput, input, actorId = null) {
  const kind = normalizeKind(kindInput);
  if (SINGLETONS[kind]) {
    const existing = db.prepare('SELECT id FROM content_records WHERE kind = ?').get(kind);
    if (existing) fail(`${kind} is a singleton`, 409, 'SINGLETON_EXISTS');
  }
  const payload = await normalizePayload(db, kind, input);
  const recordId = SINGLETONS[kind] || crypto.randomUUID();
  const timestamp = now();
  assertUniqueSlug(db, kind, payload.slug, null);
  transaction(db, () => {
    db.prepare(`INSERT INTO content_records(id, kind, slug, singleton_key, status, draft_json, created_at, updated_at, draft_updated_at)
                VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)`)
      .run(recordId, kind, payload.slug, SINGLETONS[kind] || null, JSON.stringify(payload), timestamp, timestamp, timestamp);
    insertMeta(db, kind, recordId, payload);
    replaceRefs(db, recordId, 'draft', payload);
    log(db, actorId, 'create_draft', kind, recordId);
  });
  return adminById(db, kind, recordId);
}

export async function saveDraft(db, kindInput, id, input, actorId = null) {
  const kind = normalizeKind(kindInput);
  const existing = db.prepare('SELECT * FROM content_records WHERE kind = ? AND id = ?').get(kind, String(id));
  if (!existing) fail('Content record not found', 404, 'CONTENT_NOT_FOUND');
  const source = { ...rowPayload(existing, 'draft_json'), ...ensurePlainObject(input) };
  const payload = await normalizePayload(db, kind, source, { existing });
  assertUniqueSlug(db, kind, payload.slug, existing.id);
  const timestamp = now();
  transaction(db, () => {
    db.prepare('UPDATE content_records SET slug = ?, draft_json = ?, updated_at = ?, draft_updated_at = ? WHERE id = ?')
      .run(payload.slug, JSON.stringify(payload), timestamp, timestamp, existing.id);
    updateMeta(db, kind, existing.id, payload);
    replaceRefs(db, existing.id, 'draft', payload);
    log(db, actorId, 'save_draft', kind, existing.id);
  });
  return adminById(db, kind, existing.id);
}

export async function publishRecord(db, kindInput, id, actorId = null) {
  const kind = normalizeKind(kindInput);
  const existing = db.prepare('SELECT * FROM content_records WHERE kind = ? AND id = ?').get(kind, String(id));
  if (!existing) fail('Content record not found', 404, 'CONTENT_NOT_FOUND');
  const payload = await normalizePayload(db, kind, rowPayload(existing, 'draft_json'), { existing });
  assertPublishedParent(db, kind, payload);
  const timestamp = now();
  transaction(db, () => {
    db.prepare('UPDATE content_records SET slug = ?, draft_json = ?, published_json = ?, status = \'published\', updated_at = ?, draft_updated_at = ?, published_at = ? WHERE id = ?')
      .run(payload.slug, JSON.stringify(payload), JSON.stringify(payload), timestamp, timestamp, timestamp, existing.id);
    updateMeta(db, kind, existing.id, payload);
    replaceRefs(db, existing.id, 'draft', payload);
    replaceRefs(db, existing.id, 'published', payload);
    log(db, actorId, 'publish', kind, existing.id);
  });
  return adminById(db, kind, existing.id);
}

export function unpublishRecord(db, kindInput, id, actorId = null) {
  const kind = normalizeKind(kindInput);
  const existing = db.prepare('SELECT * FROM content_records WHERE kind = ? AND id = ?').get(kind, String(id));
  if (!existing) fail('Content record not found', 404, 'CONTENT_NOT_FOUND');
  transaction(db, () => {
    db.prepare('UPDATE content_records SET status = \'draft\', published_json = NULL, published_at = NULL, updated_at = ? WHERE id = ?').run(now(), existing.id);
    db.prepare('DELETE FROM media_refs WHERE record_id = ? AND phase = \'published\'').run(existing.id);
    log(db, actorId, 'unpublish', kind, existing.id);
  });
  return adminById(db, kind, existing.id);
}

export function deleteRecord(db, kindInput, id, actorId = null) {
  const kind = normalizeKind(kindInput);
  if (SINGLETONS[kind]) fail(`${kind} is a singleton and cannot be deleted`, 409, 'SINGLETON_DELETE_FORBIDDEN');
  if (kind === 'themes' || kind === 'experiments') fail(`${kind} is fixed and cannot be deleted`, 409, 'FIXED_CONTENT_DELETE_FORBIDDEN');
  const existing = db.prepare('SELECT * FROM content_records WHERE kind = ? AND id = ?').get(kind, String(id));
  if (!existing) fail('Content record not found', 404, 'CONTENT_NOT_FOUND');
  try {
    transaction(db, () => {
      const result = db.prepare('DELETE FROM content_records WHERE id = ?').run(existing.id);
      if (!result.changes) fail('Content record not found', 404, 'CONTENT_NOT_FOUND');
      log(db, actorId, 'delete', kind, existing.id);
    });
  } catch (error) {
    if (String(error.message).includes('FOREIGN KEY')) fail('Content record is still referenced', 409, 'CONTENT_REFERENCED');
    throw error;
  }
  return { id: existing.id, deleted: true };
}

export function recordForAdmin(db, kindInput, id) {
  const kind = normalizeKind(kindInput);
  const row = db.prepare('SELECT * FROM content_records WHERE kind = ? AND id = ?').get(kind, String(id));
  if (!row) fail('Content record not found', 404, 'CONTENT_NOT_FOUND');
  return row;
}

export function getPublishedMediaIds(db) {
  return new Set(db.prepare("SELECT DISTINCT media_id FROM media_refs WHERE phase = 'published'").all().map((row) => row.media_id));
}

export function mediaReferences(db, mediaId) {
  return db.prepare(`
    SELECT r.record_id, r.phase, r.field_path, c.kind, c.slug, c.status
      FROM media_refs r JOIN content_records c ON c.id = r.record_id
     WHERE r.media_id = ? ORDER BY r.phase, c.kind, c.slug
  `).all(mediaId);
}

export function hasPublicMediaReference(db, mediaId) {
  const refs = db.prepare(`
    SELECT r.record_id, c.kind, c.status, c.published_json
      FROM media_refs r JOIN content_records c ON c.id = r.record_id
     WHERE r.media_id = ? AND r.phase = 'published'
  `).all(mediaId);
  return refs.some((row) => row.status === 'published' && (row.kind !== 'teacher' || parseJson(row.published_json, {}).visible === true) && parentIsPublic(db, row));
}

export function overview(db) {
  const counts = Object.fromEntries(CONTENT_KINDS.map((kind) => [kind, db.prepare("SELECT COUNT(*) AS count FROM content_records WHERE kind = ? AND status = 'published'").get(kind).count]));
  const labs = publicList(db, 'experiments');
  const groups = labs.filter(lab => LAB_REGISTRY[lab.slug].kind === 'group').length;
  const experiments = labs.filter(lab => LAB_REGISTRY[lab.slug].kind === 'experiment' && lab.runtime_status === 'ready').length;
  const questions = publicList(db, 'quizzes').length;
  counts.experiments = labs.length - groups;
  return {
    published: counts,
    works_published: counts.works,
    experiments_ready: experiments,
    groups_published: groups,
    quizzes_published: questions,
    themes_published: counts.themes,
    readyExperiments: experiments,
    publishedQuestions: questions,
    initialized: db.prepare('SELECT 1 FROM admins LIMIT 1').get() !== undefined,
  };
}

export function exportData(db) {
  const kinds = Object.fromEntries(CONTENT_KINDS.map((kind) => [kind, db.prepare('SELECT * FROM content_records WHERE kind = ? ORDER BY id').all(kind).filter(row => {
    if (kind === 'experiments') return Boolean(LAB_REGISTRY[row.slug]);
    if (['presets', 'quizzes'].includes(kind)) return Boolean(LAB_REGISTRY[parseJson(row.draft_json, {}).experiment_slug]);
    return true;
  }).map((row) => ({
    id: row.id,
    slug: row.slug,
    status: row.status,
    draft: parseJson(row.draft_json, {}),
    published: parseJson(row.published_json, null),
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
  }))]));
  const media = db.prepare('SELECT id, original_name, mime_type, asset_kind, size_bytes, source, description, created_at, updated_at FROM media_assets ORDER BY id').all()
    .map((row) => ({ ...row, refs: mediaReferences(db, row.id) }));
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), content: kinds, media };
}
