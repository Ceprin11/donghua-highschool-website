import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {openDatabase} from '../server/db.js';
import {seedInitialContent} from '../server/seed.js';
import {saveDraft,publishRecord,unpublishRecord,publicBySlug,adminList,exportData} from '../server/content.js';

test('course details preserve publication boundaries and validate structured content',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'course-content-')),db=openDatabase(dir);
  try {
    await seedInitialContent(db);
    const course=adminList(db,'themes').find(row=>row.slug==='intro-ai');
    const published=publicBySlug(db,'themes',course.slug);
    assert.equal(published.sections.length,4);assert.equal(published.takeaways.length,3);
    await saveDraft(db,'themes',course.id,{overview:'教师修改的简介',sections:[{title:'新的内容',body:'新的说明'}],takeaways:['新的收获']});
    assert.deepEqual(publicBySlug(db,'themes',course.slug).sections,published.sections);
    assert.notEqual(publicBySlug(db,'themes',course.slug).overview,'教师修改的简介');
    await publishRecord(db,'themes',course.id);
    assert.equal(publicBySlug(db,'themes',course.slug).overview,'教师修改的简介');
    assert.deepEqual(publicBySlug(db,'themes',course.slug).sections,[{title:'新的内容',body:'新的说明'}]);
    assert.equal(exportData(db).content.themes.find(row=>row.slug===course.slug).published.overview,'教师修改的简介');
    await assert.rejects(saveDraft(db,'themes',course.id,{sections:[{title:'标题',body:42}]}),/must be a string/);
    await assert.rejects(saveDraft(db,'themes',course.id,{sections:[{title:'',body:'说明'}]}),/required/);
    unpublishRecord(db,'themes',course.id);
    assert.equal(publicBySlug(db,'themes',course.slug),null);
    assert.equal(adminList(db,'themes').find(row=>row.id===course.id).draft.overview,'教师修改的简介');
  } finally {db.close();await rm(dir,{recursive:true,force:true});}
});

