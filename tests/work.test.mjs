import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const staffA = '10000000-0000-4000-8000-000000000003';
const officeId = '10000000-0000-4000-8000-000000000002';
const siteA = '30000000-0000-4000-8000-000000000001';
const people = {
  admin: [process.env.KSS_TEST_ADMIN_EMAIL, process.env.KSS_TEST_ADMIN_PASSWORD],
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  officeB: [process.env.KSS_TEST_OFFICE_B_EMAIL, process.env.KSS_TEST_OFFICE_B_PASSWORD],
  staff: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
  other: [process.env.KSS_TEST_STAFF_B_EMAIL, process.env.KSS_TEST_STAFF_B_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
  unmapped: [process.env.KSS_TEST_UNMAPPED_EMAIL, process.env.KSS_TEST_UNMAPPED_PASSWORD],
};
const firstFile = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const secondFile = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
async function actor(name) {
  let cookies = [];
  const sessionClient = createServerClient(url,key,{cookies:{getAll:()=>cookies,setAll:(items)=>{cookies=items.map(({name,value})=>({name,value}));}}});
  const signed = await sessionClient.auth.signInWithPassword({email:people[name][0],password:people[name][1]});
  assert.ifError(signed.error);
  const db = createClient(url,key,{global:{headers:{Authorization:`Bearer ${signed.data.session.access_token}`}},
    auth:{persistSession:false,autoRefreshToken:false}});
  return {cookie:cookies.map(({name,value})=>`${name}=${value}`).join('; '),db};
}
async function port() {
  const server = createServer(); server.listen(0,'127.0.0.1'); await once(server,'listening');
  const value = server.address().port; server.close(); await once(server,'close'); return value;
}

test('02C exact-version work follows submission and review without granting source access', {timeout:300000}, async () => {
  assert.ok(url && key);
  const actors = {};
  for (const name of Object.keys(people)) actors[name] = await actor(name);
  const appPort = await port();
  const base = `http://127.0.0.1:${appPort}`;
  const server = spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(appPort)],
    {cwd:process.cwd(),stdio:'ignore'});
  try {
    for (let i=0;i<100;i++) {try {await fetch(base);break;} catch {await new Promise((resolve)=>setTimeout(resolve,200));}}
    const request = (path,as,options={}) => fetch(base+path,{redirect:'manual',...options,
      headers:{...(as?{cookie:actors[as].cookie}:{}),...(options.headers??{})}});
    const json = (value) => ({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
    const upload = (id,as,bytes,name,type) => {const body=new FormData();body.set('file',new File([bytes],name,{type}));
      return request(`/api/documents/${id}/upload`,as,{method:'POST',body});};
    const created = await request('/api/documents','office',json({targetPersonId:staffA,siteId:siteA,title:`Synthetic 02C work ${Date.now()}`}));
    const createdBody = await created.text();
    assert.equal(created.status,201,createdBody);
    const id = JSON.parse(createdBody).id;
    const firstUpload = await upload(id,'staff',firstFile,'synthetic-work-v1.pdf','application/pdf');
    assert.equal(firstUpload.status,201,await firstUpload.text());
    const current1 = (await (await request(`/api/documents/${id}`,'office')).json()).request.version;
    const v1 = current1.id;
    const task1Result = await actors.admin.db.from('tasks').select('*').eq('source_id',v1);
    assert.ifError(task1Result.error);
    assert.equal(task1Result.data.length,1);
    const task1 = task1Result.data[0];
    assert.equal(task1.assignee_person_id,officeId);
    assert.equal(task1.state,'OPEN');
    assert.equal(task1.source_kind,'DOCUMENT_VERSION');
    assert.equal(task1.completion_event_id,null);
    assert.deepEqual((await actors.admin.db.from('document_reviews').select('id').eq('version_id',v1)).data,[]);
    const officeList = await request('/api/tasks','office');
    assert.equal(officeList.status,200);
    assert.ok((await officeList.json()).tasks.some((row)=>row.id===task1.id && row.versionNumber===1));
    for (const as of ['officeB','staff','other','operations','unmapped']) {
      const response = await request(`/api/tasks/${task1.id}`,as);
      assert.ok([401,403,404].includes(response.status),`${as}: ${response.status}`);
      const direct = await actors[as].db.from('tasks').select('id').eq('id',task1.id);
      assert.ifError(direct.error); assert.deepEqual(direct.data,[]);
    }
    assert.equal((await request('/api/tasks',undefined)).status,401);
    assert.equal((await request(`/api/tasks/${task1.id}`,'officeB')).status,404);
    assert.equal((await request(`/api/tasks/${randomUUID()}`,'office')).status,404);
    assert.equal((await request(`/work/${task1.id}`,'officeB')).status,404);
    const openTask = await request(`/work/${task1.id}`,'office');
    assert.equal(openTask.status,307);
    assert.match(openTask.headers.get('location'),new RegExp(`/documents/${id}\\?version=${v1}`));
    assert.ok((await actors.office.db.from('tasks').insert({task_type:'DOCUMENT_REVIEW',title:'Review submitted personnel evidence',
      assignee_person_id:officeId,source_kind:'DOCUMENT_VERSION',source_id:randomUUID()})).error);
    assert.ok((await actors.office.db.from('tasks').update({state:'DONE'}).eq('id',task1.id)).error);
    assert.ok((await actors.office.db.from('tasks').delete().eq('id',task1.id)).error);
    assert.ok((await actors.office.db.from('audit_events').insert({affected_person_id:officeId,entity_type:'task',entity_id:task1.id,action:'UPDATE'})).error);
    assert.equal((await request(`/api/tasks/${task1.id}`,'office',{method:'POST'})).status,405);
    const reject = await request(`/api/documents/${id}/reviews`,'office',json({versionId:v1,decision:'REJECTED',
      reasonCode:'INCOMPLETE',comment:'Please provide the complete synthetic document.'}));
    assert.equal(reject.status,201,await reject.text());
    const review1 = (await (await actors.admin.db.from('document_reviews').select('id').eq('version_id',v1).single()).data).id;
    const done1 = (await (await actors.admin.db.from('tasks').select('*').eq('id',task1.id).single()).data);
    assert.equal(done1.state,'DONE'); assert.equal(done1.completion_event_id,review1);
    assert.equal(done1.assignee_person_id,officeId);
    assert.equal((await upload(id,'staff',secondFile,'synthetic-work-v2.png','image/png')).status,201);
    const v2 = (await (await request(`/api/documents/${id}`,'office')).json()).request.version.id;
    assert.notEqual(v1,v2);
    const task2Rows = await actors.admin.db.from('tasks').select('*').eq('source_id',v2);
    assert.ifError(task2Rows.error); assert.equal(task2Rows.data.length,1);
    const task2 = task2Rows.data[0];
    assert.notEqual(task1.id,task2.id); assert.equal(task2.state,'OPEN');
    assert.equal((await request(`/work/${task1.id}`,'office')).headers.get('location').includes(`version=${v1}`),true);
    const secondDecision = await request(`/api/documents/${id}/reviews`,'office',json({versionId:v2,decision:'ACCEPTED_AS_EVIDENCE'}));
    assert.equal(secondDecision.status,201,await secondDecision.text());
    const review2 = (await (await actors.admin.db.from('document_reviews').select('id').eq('version_id',v2).single()).data).id;
    const done2 = (await (await actors.admin.db.from('tasks').select('*').eq('id',task2.id).single()).data);
    assert.equal(done2.state,'DONE'); assert.equal(done2.completion_event_id,review2);
    assert.equal((await actors.admin.db.from('tasks').select('id').eq('source_id',v1)).data.length,1);
    assert.equal((await actors.admin.db.from('tasks').select('id').eq('source_id',v2)).data.length,1);
    const audit = await actors.admin.db.from('audit_events').select('action,actor_person_id,affected_person_id,after_value')
      .eq('entity_type','task').in('entity_id',[task1.id,task2.id]);
    assert.ifError(audit.error); assert.equal(audit.data.length,4);
    assert.ok(audit.data.every((row)=>row.affected_person_id===officeId && !JSON.stringify(row).includes('synthetic-work-v')));
    const officeRole = '20000000-0000-4000-8000-000000000002';
    const expired = await actors.admin.db.from('role_assignments').update({effective_until:new Date(Date.now()-1000).toISOString()}).eq('id',officeRole);
    assert.ifError(expired.error);
    try {
      assert.ok([401,403].includes((await request('/api/tasks','office')).status));
      assert.deepEqual((await actors.office.db.from('tasks').select('id').eq('id',task1.id)).data,[]);
      const expiredLink = await request(`/work/${task1.id}`,'office');
      assert.ok([307,404].includes(expiredLink.status));
      if (expiredLink.status === 307) assert.match(expiredLink.headers.get('location'),/\/\?next=/);
    } finally {
      const restored = await actors.admin.db.from('role_assignments').update({effective_until:null}).eq('id',officeRole);
      assert.ifError(restored.error);
    }
  } finally {server.kill();}
});
