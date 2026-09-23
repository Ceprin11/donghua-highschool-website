import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {openDatabase} from '../server/db.js';
import {seedInitialContent} from '../server/seed.js';
import {upgradeLabs,upgradePoseLab,rollbackLabs,snapshotLabContent} from '../server/lab-upgrade.js';
import {adminList,createRecord,saveDraft,publishRecord,unpublishRecord,publicList,publicBySlug,overview,exportData} from '../server/content.js';
import {importContent} from '../scripts/import.mjs';
import {LAB_REGISTRY} from '../shared/lab-registry.js';

test('pose upgrade retires CNN training and preserves separate drafts and unrelated content',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'pose-migration-')),db=openDatabase(dir);
  try {
    await seedInitialContent(db);
    const pose=db.prepare("SELECT * FROM content_records WHERE kind='experiments' AND slug='teachable-machine'").get();
    const published={...JSON.parse(pose.published_json),title:'教 AI 认识图像',summary:'原图像介绍'};
    const draft={...published,sort_order:91};
    db.prepare('UPDATE content_records SET draft_json=?,published_json=? WHERE id=?').run(JSON.stringify(draft),JSON.stringify(published),pose.id);
    const retired={...published,slug:'lenet-training',engine_key:'lenet-training',title:'看 CNN 怎样训练'};
    db.prepare("INSERT INTO content_records(id,kind,slug,status,draft_json,published_json,created_at,updated_at,draft_updated_at) VALUES ('retired-training','experiments','lenet-training','published',?,?,?,?,?)").run(JSON.stringify(retired),JSON.stringify(retired),pose.created_at,pose.updated_at,pose.draft_updated_at);
    db.prepare("INSERT INTO experiment_meta(record_id,engine_key,runtime_status) VALUES ('retired-training','lenet-training','ready')").run();
    const task=db.prepare("SELECT * FROM content_records WHERE kind='presets' LIMIT 1").get();
    const child={...JSON.parse(task.draft_json),slug:'retired-observation',experiment_slug:'lenet-training'};
    db.prepare("INSERT INTO content_records(id,kind,slug,status,draft_json,published_json,created_at,updated_at,draft_updated_at) VALUES ('retired-child','presets','retired-observation','published',?,?,?,?,?)").run(JSON.stringify(child),JSON.stringify(child),task.created_at,task.updated_at,task.draft_updated_at);
    db.prepare("INSERT INTO child_content_meta(record_id,parent_experiment_id) VALUES ('retired-child','retired-training')").run();
    const theme=db.prepare("SELECT * FROM content_records WHERE kind='themes' AND slug='computer-vision'").get();
    const themePayload={...JSON.parse(theme.draft_json),summary:'亲手训练图像分类器',experiment_slugs:['lenet-training','lenet','teachable-machine']};
    db.prepare('UPDATE content_records SET draft_json=?,published_json=? WHERE id=?').run(JSON.stringify(themePayload),JSON.stringify(themePayload),theme.id);
    const before=snapshotLabContent(db), neural=JSON.stringify(publicBySlug(db,'experiments','neural-network'));
    const journal=upgradePoseLab(db);
    assert.ok(journal.changed.includes('experiments/lenet-training'));
    assert.equal(publicBySlug(db,'experiments','lenet-training'),null);
    for(const id of ['retired-training','retired-child']) {
      const row=db.prepare('SELECT * FROM content_records WHERE id=?').get(id);
      assert.equal(row.status,'draft');assert.equal(row.published_json,null);assert.ok(row.draft_json);
    }
    const updated=db.prepare('SELECT * FROM content_records WHERE id=?').get(pose.id);
    assert.match(JSON.parse(updated.published_json).title,/姿势/);
    assert.equal(JSON.parse(updated.draft_json).sort_order,91);
    assert.equal(JSON.parse(updated.published_json).sort_order,published.sort_order);
    assert.deepEqual(publicBySlug(db,'themes','computer-vision').experiment_slugs,['lenet','teachable-machine']);
    assert.equal(JSON.stringify(publicBySlug(db,'experiments','neural-network')),neural);
    assert.deepEqual(upgradePoseLab(db).changed,[]);
    rollbackLabs(db,journal);assert.deepEqual(snapshotLabContent(db),before);
  } finally { db.close();await rm(dir,{recursive:true,force:true}); }
});

test('CV publication hides child details, presets and quizzes without leaking drafts',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'cv-publish-')),db=openDatabase(dir);
  try{
    await seedInitialContent(db);
    assert.equal(overview(db).experiments_ready,6);assert.equal(overview(db).groups_published,1);
    const group=adminList(db,'experiments').find(row=>row.slug==='cv');
    const child=adminList(db,'experiments').find(row=>row.slug==='cnn-explainer');
    await saveDraft(db,'experiments',group.id,{runtime_status:'maintenance'});
    assert.ok(publicBySlug(db,'experiments','cnn-explainer'));
    await publishRecord(db,'experiments',group.id);
    assert.equal(publicBySlug(db,'experiments','cnn-explainer'),null);
    assert.equal(publicList(db,'quizzes').some(q=>q.experiment_slug==='cnn-explainer'),false);
    assert.equal(publicList(db,'presets').some(q=>q.experiment_slug==='cnn-explainer'),false);
    await assert.rejects(publishRecord(db,'experiments',child.id),/Parent group/);
    await saveDraft(db,'experiments',group.id,{runtime_status:'ready'});await publishRecord(db,'experiments',group.id);
    assert.ok(publicBySlug(db,'experiments','cnn-explainer'));
    unpublishRecord(db,'experiments',group.id);assert.equal(publicBySlug(db,'experiments','lenet'),null);
  }finally{db.close();await rm(dir,{recursive:true,force:true});}
});

test('lab migration is repeatable, reversible and preserves unrelated content',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'lab-migration-')),db=openDatabase(dir);
  try{
    await seedInitialContent(db);
    const work=await createRecord(db,'works',{slug:'student-project',title:'学生作品'});await publishRecord(db,'works',work.id);
    // Model the pre-upgrade database: only the two retained engines exist.
    for(const lab of adminList(db,'experiments').filter(row=>!LAB_REGISTRY[row.slug].configurable)) {
      db.prepare('DELETE FROM content_records WHERE id IN (SELECT record_id FROM child_content_meta WHERE parent_experiment_id=?)').run(lab.id);
      db.prepare('DELETE FROM content_records WHERE id=?').run(lab.id);
    }
    const base=adminList(db,'experiments').find(row=>row.slug==='neural-network');
    const payload={...base.draft,slug:'pixel-vision',engine_key:'vision',title:'历史图像实验',default_config:{}};
    const stamp=new Date().toISOString();
    db.prepare("INSERT INTO content_records(id,kind,slug,status,draft_json,published_json,created_at,updated_at,draft_updated_at) VALUES ('legacy-test','experiments','pixel-vision','published',?,?,?,?,?)").run(JSON.stringify(payload),JSON.stringify(payload),stamp,stamp,stamp);
    db.prepare("INSERT INTO experiment_meta(record_id,engine_key,runtime_status) VALUES ('legacy-test','vision','ready')").run();
    const before=snapshotLabContent(db), retained=JSON.stringify(publicBySlug(db,'experiments','neural-network'));
    const journal=await upgradeLabs(db);assert.ok(journal.changed.includes('experiments/pixel-vision'));
    assert.ok(journal.created.length > 6);
    assert.equal(publicBySlug(db,'experiments','pixel-vision'),null);
    const again=await upgradeLabs(db);assert.equal(again.changed.length,0);assert.equal(again.created.length,0);
    assert.equal(JSON.stringify(publicBySlug(db,'experiments','neural-network')),retained);
    assert.equal(publicBySlug(db,'works','student-project').title,'学生作品');
    const bundle=exportData(db);
    assert.equal(bundle.content.experiments.some(row=>row.slug==='pixel-vision'),false);
    const imported=await importContent(db,bundle,false);
    assert.equal(imported.created,0);
    rollbackLabs(db,journal);assert.deepEqual(snapshotLabContent(db),before);
  }finally{db.close();await rm(dir,{recursive:true,force:true});}
});

