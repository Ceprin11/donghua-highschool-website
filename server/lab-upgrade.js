import { seedInitialContent } from './seed.js';
import { LEGACY_LAB_REDIRECTS } from '../shared/lab-registry.js';
import { NEW_LABS, NEW_PRESETS, NEW_QUESTIONS } from './lab-seed.js';
const kinds = "'experiments','presets','quizzes','themes','settings'";

export function snapshotLabContent(db) {
  return {
    records: db.prepare(`SELECT * FROM content_records WHERE kind IN (${kinds})`).all(),
    refs: db.prepare(`SELECT * FROM media_refs WHERE record_id IN (SELECT id FROM content_records WHERE kind IN (${kinds}))`).all(),
  };
}
export async function upgradeLabs(db) {
  const before = snapshotLabContent(db);
  const retired = new Set(Object.keys(LEGACY_LAB_REDIRECTS));
  const changed = [];
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of before.records) {
      const draft = JSON.parse(row.draft_json), published = row.published_json ? JSON.parse(row.published_json) : null;
      if ((row.kind === 'experiments' && retired.has(row.slug)) || (['presets','quizzes'].includes(row.kind) && retired.has(draft.experiment_slug))) {
        if (row.status !== 'draft' || row.published_json) {
          db.prepare("UPDATE content_records SET status='draft', published_json=NULL, published_at=NULL WHERE id=?").run(row.id);
          db.prepare("DELETE FROM media_refs WHERE record_id=? AND phase='published'").run(row.id);
          changed.push(`${row.kind}/${row.slug}`);
        }
        continue;
      }
      if (!['themes','settings'].includes(row.kind)) continue;
      const field = row.kind === 'themes' ? 'experiment_slugs' : 'featured_experiment_slugs';
      const map = { 'pixel-vision':'cv', 'temperature-sampling':'transformer', 'gesture-lab':'teachable-machine', 'lenet-training':'lenet' };
      const replace = payload => {
        if (!payload) return payload;
        let slugs = (payload[field] || []).map(slug=>map[slug] || slug);
        if (row.kind === 'settings') slugs=slugs.filter(slug=>slug!=='teachable-machine');
        if (row.slug === 'embodied-intelligence') slugs=slugs.filter(slug=>slug!=='teachable-machine');
        return {...payload,[field]:[...new Set(slugs)]};
      };
      const nextDraft=JSON.stringify(replace(draft)), nextPublished=published ? JSON.stringify(replace(published)) : null;
      if(nextDraft !== row.draft_json || nextPublished !== row.published_json) {
        db.prepare('UPDATE content_records SET draft_json=?, published_json=? WHERE id=?').run(nextDraft,nextPublished,row.id);
        changed.push(`${row.kind}/${row.slug}`);
      }
    }
    await seedInitialContent(db);
    changed.push(...upgradePoseLab(db).changed);
    const ids = new Set(before.records.map(row=>row.id));
    const created = snapshotLabContent(db).records.filter(row=>!ids.has(row.id)).map(row=>row.id);
    db.exec('COMMIT');
    return { before, created, changed };
  } catch(error) { db.exec('ROLLBACK'); throw error; }
}

export function upgradePoseLab(db) {
  const before = snapshotLabContent(db), changed = [];
  const pose = NEW_LABS.find(lab => lab.slug === 'teachable-machine');
  const task = NEW_PRESETS.find(preset => preset.experiment_slug === pose.slug);
  const questions = NEW_QUESTIONS.filter(question => question[0] === pose.slug);
  db.transaction(() => {
    for (const row of before.records) {
      const draft = JSON.parse(row.draft_json);
      if (row.slug === 'lenet-training' || (['presets','quizzes'].includes(row.kind) && draft.experiment_slug === 'lenet-training')) {
        if (row.published_json || row.status !== 'draft') {
          db.prepare("UPDATE content_records SET status='draft',published_json=NULL,published_at=NULL WHERE id=?").run(row.id);
          db.prepare("DELETE FROM media_refs WHERE record_id=? AND phase='published'").run(row.id);
          changed.push(row.kind + '/' + row.slug);
        }
        continue;
      }
      const update = payload => {
        if (!payload) return payload;
        if (row.kind === 'experiments' && row.slug === pose.slug) {
          for (const field of ['title','summary','instructions','explanation']) payload[field] = pose[field];
        }
        if (row.kind === 'presets' && row.slug === task.slug) payload.task_description = task.task_description;
        if (row.kind === 'quizzes' && row.slug === 'teachable-machine-q1') {
          const [,question,answers,correct,explanation] = questions[0];
          Object.assign(payload, { question, options: answers.map((text,index)=>({id:String.fromCharCode(97+index),text})), correct_option_id:String.fromCharCode(97+correct), explanation });
        }
        for (const field of ['experiment_slugs','featured_experiment_slugs']) {
          if (Array.isArray(payload[field])) payload[field] = [...new Set(payload[field].map(slug=>slug === 'lenet-training' ? 'lenet' : slug))];
        }
        if (row.kind === 'themes' && row.slug === 'computer-vision') payload.summary = payload.summary.replace('亲手训练图像分类器','亲手训练姿势分类器');
        return payload;
      };
      const nextDraft = JSON.stringify(update(draft)), nextPublished = row.published_json ? JSON.stringify(update(JSON.parse(row.published_json))) : null;
      if (nextDraft !== row.draft_json || nextPublished !== row.published_json) {
        db.prepare('UPDATE content_records SET draft_json=?,published_json=? WHERE id=?').run(nextDraft,nextPublished,row.id);
        changed.push(row.kind + '/' + row.slug);
      }
    }
  })();
  return {before,created:[],changed};
}

export function rollbackLabs(db, journal) {
  db.transaction(()=>{
    const ids = journal.created;
    for(const id of ids) db.prepare('DELETE FROM media_refs WHERE record_id=?').run(id);
    for(const id of ids) db.prepare('DELETE FROM content_records WHERE id=? AND kind IN (\'presets\',\'quizzes\')').run(id);
    for(const id of ids) db.prepare('DELETE FROM content_records WHERE id=?').run(id);
    for(const row of journal.before.records) {
      const columns=Object.keys(row).filter(key=>key!=='id');
      db.prepare(`UPDATE content_records SET ${columns.map(key=>`${key}=?`).join(',')} WHERE id=?`).run(...columns.map(key=>row[key]),row.id);
      db.prepare('DELETE FROM media_refs WHERE record_id=?').run(row.id);
    }
    for(const ref of journal.before.refs) {
      const columns=Object.keys(ref);
      db.prepare(`INSERT INTO media_refs(${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...columns.map(key=>ref[key]));
    }
  })();
}
