import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const officeId='10000000-0000-4000-8000-000000000002';
const staffId='10000000-0000-4000-8000-000000000003';
const users={
  admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
  office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
  officeB:[process.env.KSS_TEST_OFFICE_B_EMAIL,process.env.KSS_TEST_OFFICE_B_PASSWORD],
  staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
  staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD],
  operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
};
async function actor(name){
  let cookies=[];
  const session=createServerClient(url,key,{cookies:{getAll:()=>cookies,
    setAll:(items)=>{cookies=items.map(({name,value})=>({name,value}));}}});
  const signed=await signInWithTestSession(session,{email:users[name][0],password:users[name][1]});
  assert.ifError(signed.error);
  const db=createClient(url,key,{global:{headers:{Authorization:`Bearer ${signed.data.session.access_token}`}},
    auth:{persistSession:false,autoRefreshToken:false}});
  return {cookie:cookies.map(({name,value})=>`${name}=${value}`).join('; '),db};
}
async function port(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const value=server.address().port;server.close();await once(server,'close');return value;}
const post=(body)=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});

test('03C controlled publication, exact access and acknowledgement remain scoped and immutable',
  {timeout:300000},async()=>{
  assert.ok(url&&key);
  const actors={};for(const name of Object.keys(users))actors[name]=await actor(name);
  const appPort=await port(),base=`http://127.0.0.1:${appPort}`;
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(appPort)],
    {cwd:process.cwd(),stdio:'ignore'});
  try{
    for(let i=0;i<100;i++){try{await fetch(base);break;}catch{await new Promise((resolve)=>setTimeout(resolve,200));}}
    const request=(path,as,options={})=>fetch(base+path,{redirect:'manual',...options,
      headers:{...(as?{cookie:actors[as].cookie}:{}),...(options.headers??{})}});
    const responseBody=async(path,as,options)=>{const r=await request(path,as,options);return [r,await r.text()];};
    const caseAt=async(id,as='office')=>{const r=await request(`/api/onboarding/${id}`,as);
      return [r.status,r.ok?(await r.json()).case:null];};
    assert.equal((await request('/api/controlled-documents','operations')).status,403);
    assert.equal((await request('/api/controlled-documents','staff')).status,403);
    assert.equal((await request('/api/controlled-documents/grants','office',
      post({personId:officeId,expiresAt:new Date(Date.now()+86400000).toISOString()}))).status,403);
    const existing=await actors.admin.db.from('controlled_publisher_grants').select('id,effective_until')
      .eq('person_id',officeId).is('revoked_at',null).gt('effective_until',new Date().toISOString()).limit(1);
    assert.ifError(existing.error);
    let grantId=existing.data?.[0]?.id;
    if(!grantId){
      const [g,t]=await responseBody('/api/controlled-documents/grants','admin',
        post({personId:officeId,expiresAt:new Date(Date.now()+86400000*7).toISOString()}));
      assert.equal(g.status,201,t);grantId=JSON.parse(t).grantId;
    }
    const before=await actors.office.db.from('onboarding_requirement_definitions')
      .select('id,provider_state').eq('id','40000000-0000-4000-8000-000000000025').single();
    assert.ifError(before.error);assert.equal(before.data.provider_state,'NOT_AVAILABLE');
    const [created,createdText]=await responseBody('/api/controlled-documents','office',{method:'POST'});
    assert.equal(created.status,201,createdText);const documentId=JSON.parse(createdText).documentId;
    assert.equal((await request('/api/controlled-documents','officeB',{method:'POST'})).status,403);
    const pdfV1=await readFile('output/pdf/kss-development-terms-v1.pdf');
    const pdfV2=await readFile('output/pdf/kss-development-terms-v2.pdf');
    const upload=async(bytes,filename)=>{const form=new FormData();
      form.set('file',new File([bytes],filename,{type:'application/pdf'}));
      return responseBody(`/api/controlled-documents/${documentId}/versions`,'office',{method:'POST',body:form});};
    const [draft,draftText]=await upload(pdfV1,'kss-development-terms-v1.pdf');
    assert.equal(draft.status,201,draftText);const v1=JSON.parse(draftText).versionId;
    const site=await actors.office.db.from('sites').select('id').eq('name','Synthetic Static Security Site')
      .eq('created_by_person_id',officeId).single();assert.ifError(site.error);
    // The 03E case guard requires a current SiteAssignment. Earlier suites may
    // have expired their own synthetic assignment; create this case's scope via
    // the ordinary Office route without rewriting any earlier assignment.
    const assignments=await actors.admin.db.from('site_assignments')
      .select('id,effective_from,effective_until,revoked_at').eq('site_id',site.data.id).eq('person_id',staffId);
    assert.ifError(assignments.error);
    const now=Date.now();
    if(!assignments.data.some((row)=>!row.revoked_at && Date.parse(row.effective_from)<=now &&
      (!row.effective_until || Date.parse(row.effective_until)>now+60_000))){
      const [scope,scopeText]=await responseBody('/api/access/sites','office',post({siteId:site.data.id,
        personId:staffId,effectiveFrom:new Date(now-60_000).toISOString(),
        effectiveUntil:new Date(now+86_400_000).toISOString(),
        reason:'Synthetic 03C controlled-document case scope'}));
      assert.equal(scope.status,201,scopeText);
    }
    const [caseCreated,caseText]=await responseBody('/api/onboarding','office',
      post({targetPersonId:staffId,siteId:site.data.id,requestKey:randomUUID()}));
    assert.equal(caseCreated.status,201,caseText);const caseId=JSON.parse(caseText).id;
    assert.equal((await request(`/api/onboarding/${caseId}/start`,'office',{method:'POST'})).status,200);
    let c=(await caseAt(caseId))[1];const contract=c.requirements.find((r)=>r.code==='CONTRACT_TERMS');
    assert.equal(contract.state,'NOT_AVAILABLE');
    assert.equal((await request(`/api/onboarding/${caseId}/contract/assign`,'office',
      post({versionId:v1}))).status,403,'Draft cannot be assigned');
    const [published,publishedText]=await responseBody(`/api/controlled-documents/${documentId}/versions/${v1}/publish`,
      'office',post({effectiveOn:new Date().toISOString().slice(0,10)}));
    if(published.status!==200){const diagnostic=await actors.office.db.rpc('publish_controlled_version',
      {requested_version:v1,requested_effective_on:new Date().toISOString().slice(0,10)});
      assert.equal(published.status,200,JSON.stringify({publishedText,error:diagnostic.error}));}
    assert.equal((await request(`/api/onboarding/${caseId}/contract/assign`,'officeB',
      post({versionId:v1}))).status,403);
    assert.equal((await request(`/api/onboarding/${caseId}/contract/assign`,'staff',
      post({versionId:v1}))).status,403);
    const [assigned,assignedText]=await responseBody(`/api/onboarding/${caseId}/contract/assign`,'office',
      post({versionId:v1}));assert.equal(assigned.status,201,assignedText);
    const assignmentId=JSON.parse(assignedText).assignmentId;
    const keyV1=(await actors.office.db.from('controlled_document_versions')
      .select('object_key').eq('id',v1).single()).data.object_key;
    assert.ok((await actors.staff.db.storage.from('enterprise-controlled-documents')
      .download(keyV1)).error,'Direct Staff Storage access requires a typed exact-version access event');
    c=(await caseAt(caseId,'staff'))[1];assert.equal(c.requirements.find((r)=>r.code==='CONTRACT_TERMS').state,
      'AWAITING_DOCUMENT_ACCESS');
    assert.equal((await request(`/api/onboarding/${caseId}/contract/acknowledge`,'staff',
      post({confirmed:true}))).status,403,'Access is a database prerequisite');
    assert.equal((await request(`/api/onboarding/${caseId}/contract/acknowledge`,'staff',
      post({confirmed:false}))).status,400);
    const [second,secondText]=await upload(pdfV2,'kss-development-terms-v2.pdf');
    assert.equal(second.status,201,secondText);const v2=JSON.parse(secondText).versionId;
    assert.equal((await request(`/api/controlled-documents/${documentId}/versions/${v2}/publish`,'office',
      post({effectiveOn:new Date().toISOString().slice(0,10)}))).status,409,
      'An unresolved active v1 assignment prevents supersession');
    for(const as of ['office','admin','officeB','staffB','operations']){
      assert.ok([403,404].includes((await request(`/api/onboarding/${caseId}/contract/acknowledge`,as,
        post({confirmed:true}))).status),as);
    }
    for(const as of ['officeB','staffB','operations']){
      assert.ok([403,404].includes((await request(`/api/onboarding/${caseId}/contract/file`,as)).status),as);
      const direct=await actors[as].db.storage.from('enterprise-controlled-documents').download(
        (await actors.office.db.from('controlled_document_versions').select('object_key').eq('id',v1).single()).data.object_key);
      assert.ok(direct.error,`${as} cannot retrieve bytes directly`);
    }
    assert.ok((await actors.staff.db.rpc('record_controlled_access',
      {requested_assignment:assignmentId,server_proof:'f'.repeat(64)})).error);
    const opened=await request(`/api/onboarding/${caseId}/contract/file`,'staff');
    const openedBytes=Buffer.from(await opened.arrayBuffer());
    assert.equal(opened.status,200,openedBytes.toString('utf8').slice(0,160));
    assert.deepEqual(openedBytes,pdfV1);
    const directAfterOpen=await actors.staff.db.storage.from('enterprise-controlled-documents').download(keyV1);
    assert.ifError(directAfterOpen.error);
    assert.deepEqual(Buffer.from(await directAfterOpen.data.arrayBuffer()),pdfV1);
    assert.equal((await caseAt(caseId,'staff'))[1].requirements.find((r)=>r.code==='CONTRACT_TERMS').state,
      'AWAITING_ACKNOWLEDGEMENT');
    assert.equal((await request(`/api/onboarding/${caseId}/contract/acknowledge`,'office',
      post({confirmed:true}))).status,403);
    const completionBefore=await actors.staff.db.rpc('training_completion_mine');
    assert.ifError(completionBefore.error);
    const [ack,ackText]=await responseBody(`/api/onboarding/${caseId}/contract/acknowledge`,'staff',
      post({confirmed:true}));assert.equal(ack.status,201,ackText);const acknowledgementId=JSON.parse(ackText).acknowledgementId;
    const completionAfter=await actors.staff.db.rpc('training_completion_mine');
    assert.ifError(completionAfter.error);
    assert.deepEqual(completionAfter.data,completionBefore.data,
      'document acknowledgement cannot create or change the same Staff Training completion');
    assert.equal((await caseAt(caseId,'staff'))[1].requirements.find((r)=>r.code==='CONTRACT_TERMS').state,
      'ACKNOWLEDGED');
    assert.ok((await actors.staff.db.from('controlled_acknowledgements').delete().eq('id',acknowledgementId)).error);
    assert.ok((await actors.staff.db.from('controlled_acknowledgements').insert({assignment_id:assignmentId})).error);
    const storedAck=await actors.office.db.from('controlled_acknowledgements').select('*')
      .eq('id',acknowledgementId).single();assert.ifError(storedAck.error);
    assert.equal(storedAck.data.version_id,v1);assert.equal(storedAck.data.target_person_id,staffId);
    const duplicate=await actors.staff.db.rpc('acknowledge_controlled_assignment',{requested_assignment:assignmentId});
    assert.ifError(duplicate.error);assert.equal(duplicate.data,acknowledgementId);
    assert.equal((await request(`/api/onboarding/${caseId}/contract/assign`,'office',
      post({versionId:v1}))).status,403,'Assignment cannot be retargeted');
    assert.equal((await request(`/api/controlled-documents/${documentId}/versions/${v2}/publish`,'office',
      post({effectiveOn:new Date().toISOString().slice(0,10)}))).status,200);
    const old=await actors.office.db.from('controlled_document_versions').select('state,sha256,object_key')
      .eq('id',v1).single();assert.ifError(old.error);assert.equal(old.data.state,'SUPERSEDED');
    assert.ok((await actors.office.db.from('controlled_document_versions').update({title:'Changed'}).eq('id',v1)).error);
    assert.ok((await actors.office.db.storage.from('enterprise-controlled-documents')
      .upload(old.data.object_key,pdfV2,{contentType:'application/pdf',upsert:true})).error);
    const oldBytes=await actors.office.db.storage.from('enterprise-controlled-documents').download(old.data.object_key);
    assert.ifError(oldBytes.error);assert.deepEqual(Buffer.from(await oldBytes.data.arrayBuffer()),pdfV1);
    const unchanged=await actors.office.db.from('controlled_acknowledgements').select('version_id,acknowledged_at')
      .eq('id',acknowledgementId).single();assert.ifError(unchanged.error);assert.equal(unchanged.data.version_id,v1);
    assert.equal((await actors.office.db.from('controlled_acknowledgements').select('id').eq('version_id',v2)).data.length,0);
    assert.equal((await caseAt(caseId))[1].requirements.find((r)=>r.code==='CONTRACT_TERMS').state,'ACKNOWLEDGED');
    const after=await actors.office.db.from('onboarding_requirement_definitions')
      .select('provider_state').eq('id','40000000-0000-4000-8000-000000000025').single();
    assert.ifError(after.error);assert.equal(after.data.provider_state,'NOT_AVAILABLE');
    assert.ok((await actors.staff.db.from('audit_events').insert({entity_type:'controlled_acknowledgement',
      entity_id:randomUUID(),action:'INSERT',affected_person_id:staffId})).error);
    const revoked=await request('/api/controlled-documents/grants','admin',
      {method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({grantId})});
    assert.equal(revoked.status,200,await revoked.text());
    assert.equal((await request('/api/controlled-documents','office',{method:'POST'})).status,403);
    const restored=await request('/api/controlled-documents/grants','admin',
      post({personId:officeId,expiresAt:new Date(Date.now()+86400000*7).toISOString()}));
    assert.equal(restored.status,201,await restored.text());
    console.log(JSON.stringify({caseId,documentId,v1,v2,assignmentId,acknowledgementId}));
  }finally{server.kill('SIGTERM');await once(server,'exit').catch(()=>{});}
});
