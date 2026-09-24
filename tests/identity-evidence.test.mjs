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
const staffId='10000000-0000-4000-8000-000000000003';
const officeId='10000000-0000-4000-8000-000000000002';
const users={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
  office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
  officeB:[process.env.KSS_TEST_OFFICE_B_EMAIL,process.env.KSS_TEST_OFFICE_B_PASSWORD],
  staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
  staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD],
  operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD]};
async function actor(name){
  let cookies=[];
  const session=createServerClient(url,key,{cookies:{getAll:()=>cookies,
    setAll:(items)=>{cookies=items.map(({name,value})=>({name,value}));}}});
  const signed=await signInWithTestSession(session,{email:users[name][0],password:users[name][1]});
  assert.ifError(signed.error);
  return {cookie:cookies.map(({name,value})=>`${name}=${value}`).join('; '),
    db:createClient(url,key,{global:{headers:{Authorization:`Bearer ${signed.data.session.access_token}`}},
      auth:{persistSession:false,autoRefreshToken:false}})};
}
async function port(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const value=server.address().port;server.close();await once(server,'close');return value;}
const post=(body)=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});

test('03D Identity Evidence reuses exact private review and separate verification',
  {timeout:240000},async()=>{
  assert.ok(url&&key);const actors={};for(const name of Object.keys(users))actors[name]=await actor(name);
  const appPort=await port(),base=`http://127.0.0.1:${appPort}`;
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(appPort)],
    {cwd:process.cwd(),stdio:'ignore'});
  try{
    for(let i=0;i<100;i++){try{await fetch(base);break;}catch{await new Promise((resolve)=>setTimeout(resolve,200));}}
    const request=(path,as,options={})=>fetch(base+path,{redirect:'manual',...options,
      headers:{...(as?{cookie:actors[as].cookie}:{}),...(options.headers??{})}});
    const json=async(path,as,options={})=>{const r=await request(path,as,options);
      return [r.status,await r.json().catch(()=>null)];};
    const caseAt=async(as='office')=>(await json(`/api/onboarding/${caseId}`,as))[1]?.case;
    const site=await actors.office.db.from('sites').select('id').eq('name','Synthetic Static Security Site')
      .eq('created_by_person_id',officeId).single();assert.ifError(site.error);
    const [created,createdBody]=await json('/api/onboarding','office',post({targetPersonId:staffId,
      siteId:site.data.id,requestKey:randomUUID()}));assert.equal(created,201,JSON.stringify(createdBody));
    const caseId=createdBody.id;
    assert.equal((await request(`/api/onboarding/${caseId}/start`,'office',{method:'POST'})).status,200);
    const identity=()=>caseAt().then(c=>c.requirements.find(r=>r.code==='IDENTITY_EVIDENCE'));
    const requirement=await identity();assert.equal(requirement.state,'NOT_CONFIGURED');
    const definition=await actors.office.db.from('onboarding_requirement_definitions').select('provider_state,fulfilment_kind')
      .eq('id','40000000-0000-4000-8000-000000000024').single();assert.ifError(definition.error);
    assert.equal(definition.data.provider_state,'NOT_CONFIGURED');
    for(const as of ['staff','staffB','officeB','operations','admin'])
      assert.ok([403,404].includes((await request(`/api/onboarding/${caseId}/identity-request`,as,{method:'POST'})).status),as);
    const [issued,issuedBody]=await json(`/api/onboarding/${caseId}/identity-request`,'office',{method:'POST'});
    assert.equal(issued,200,JSON.stringify(issuedBody));const requestId=issuedBody.requestId;
    assert.equal((await json(`/api/onboarding/${caseId}/identity-request`,'office',{method:'POST'}))[1].requestId,requestId);
    assert.equal((await identity()).state,'AWAITING_EVIDENCE');
    const link=await actors.office.db.from('onboarding_case_requirements').select('document_request_id')
      .eq('id',requirement.id).single();assert.ifError(link.error);assert.equal(link.data.document_request_id,requestId);
    assert.ok((await actors.staff.db.from('onboarding_case_requirements').update({document_request_id:randomUUID()})
      .eq('id',requirement.id)).error);
    for(const as of ['staffB','officeB','operations']){
      assert.ok([403,404].includes((await request(`/api/documents/${requestId}`,as)).status),as);
      assert.ok([403,404].includes((await request(`/api/onboarding/${caseId}/identity-verify`,as,
        post({requirementId:requirement.id,versionId:randomUUID()}))).status),as);
    }
    const pdf=await readFile('output/pdf/synthetic-identity-evidence.pdf');
    const upload=async(name)=>{const form=new FormData();form.set('file',new File([pdf],name,{type:'application/pdf'}));
      return json(`/api/documents/${requestId}/upload`,'staff',{method:'POST',body:form});};
    assert.equal((await request(`/api/onboarding/${caseId}/identity-verify`,'office',
      post({requirementId:requirement.id,versionId:randomUUID()}))).status,403);
    assert.equal((await upload('synthetic-identity-v1.pdf'))[0],201);
    let document=(await json(`/api/documents/${requestId}`,'office'))[1].request;
    const v1=document.version.id;
    assert.equal((await identity()).state,'UNDER_REVIEW');
    const task1=await actors.office.db.from('tasks').select('id,state').eq('source_id',v1).single();
    assert.ifError(task1.error);assert.equal(task1.data.state,'OPEN');
    assert.equal((await request(`/api/onboarding/${caseId}/identity-verify`,'office',
      post({requirementId:requirement.id,versionId:v1}))).status,403);
    const rejected=await request(`/api/documents/${requestId}/reviews`,'office',
      post({versionId:v1,decision:'REJECTED',reasonCode:'INCOMPLETE',comment:'Synthetic first version needs replacement for workflow proof.'}));
    assert.equal(rejected.status,201,await rejected.text());
    assert.equal((await identity()).state,'ACTION_REQUIRED');
    assert.equal((await request(`/api/onboarding/${caseId}/identity-verify`,'office',
      post({requirementId:requirement.id,versionId:v1}))).status,403);
    assert.equal((await upload('synthetic-identity-v2.pdf'))[0],201);
    document=(await json(`/api/documents/${requestId}`,'office'))[1].request;
    const v2=document.version.id;assert.notEqual(v1,v2);
    const task2=await actors.office.db.from('tasks').select('id,state').eq('source_id',v2).single();
    assert.ifError(task2.error);assert.equal(task2.data.state,'OPEN');
    const accepted=await request(`/api/documents/${requestId}/reviews`,'office',
      post({versionId:v2,decision:'ACCEPTED_AS_EVIDENCE'}));assert.equal(accepted.status,201,await accepted.text());
    assert.equal((await actors.office.db.from('tasks').select('state').eq('id',task2.data.id).single()).data.state,'DONE');
    assert.equal((await identity()).state,'UNDER_REVIEW','Accepted evidence and Done Task do not verify');
    assert.ok((await actors.office.db.rpc('verify_onboarding_identity',{requested_case:caseId,
      requested_requirement:requirement.id,accepted_version:v1})).error,'Rejected v1 cannot verify');
    assert.ok((await actors.office.db.rpc('verify_onboarding_identity',{requested_case:randomUUID(),
      requested_requirement:requirement.id,accepted_version:v2})).error);
    const rtw=(await caseAt()).requirements.find(r=>r.code==='RIGHT_TO_WORK');
    assert.ok((await actors.office.db.rpc('verify_onboarding_identity',{requested_case:caseId,
      requested_requirement:rtw.id,accepted_version:v2})).error);
    assert.ok((await actors.office.db.rpc('verify_onboarding_identity',{requested_case:caseId,
      requested_requirement:requirement.id,accepted_version:randomUUID()})).error);
    assert.equal((await request(`/api/onboarding/${caseId}/identity-verify`,'office',
      post({requirementId:requirement.id,versionId:v2,syntheticValidUntil:new Date().toISOString()}))).status,400);
    assert.ok((await actors.staff.db.rpc('verify_onboarding_identity',{requested_case:caseId,
      requested_requirement:requirement.id,accepted_version:v2})).error);
    const dual=await actors.admin.db.from('role_assignments').insert({person_id:staffId,role_code:'OFFICE_ADMIN',
      effective_from:new Date(Date.now()-1000).toISOString()}).select('id').single();assert.ifError(dual.error);
    try{assert.ok((await actors.staff.db.rpc('verify_onboarding_identity',{requested_case:caseId,
      requested_requirement:requirement.id,accepted_version:v2})).error);}finally{
      assert.ifError((await actors.admin.db.from('role_assignments')
        .update({effective_until:new Date(Date.now()-1000).toISOString()}).eq('id',dual.data.id)).error);
    }
    assert.ok((await actors.officeB.db.rpc('verify_onboarding_identity',{requested_case:caseId,
      requested_requirement:requirement.id,accepted_version:v2})).error);
    const officeRole='20000000-0000-4000-8000-000000000002';
    const expired=await actors.admin.db.from('role_assignments')
      .update({effective_until:new Date(Date.now()-1000).toISOString()}).eq('id',officeRole);
    assert.ifError(expired.error);
    try{
      assert.ok((await actors.office.db.rpc('verify_onboarding_identity',{requested_case:caseId,
        requested_requirement:requirement.id,accepted_version:v2})).error,
      'Expired Office role cannot verify');
    }finally{
      const restored=await actors.admin.db.from('role_assignments').update({effective_until:null}).eq('id',officeRole);
      assert.ifError(restored.error);
    }
    assert.ok((await actors.office.db.from('onboarding_requirement_verifications').insert({case_id:caseId,
      requirement_id:requirement.id,target_person_id:staffId,verifier_person_id:officeId,
      evidence_version_id:v2,decision:'VERIFIED'})).error);
    assert.ok((await actors.staff.db.from('audit_events').insert({affected_person_id:staffId,
      entity_type:'onboarding_verification',entity_id:randomUUID(),action:'INSERT'})).error);
    const verified=await json(`/api/onboarding/${caseId}/identity-verify`,'office',
      post({requirementId:requirement.id,versionId:v2}));assert.equal(verified[0],200,JSON.stringify(verified[1]));
    assert.equal((await identity()).state,'VERIFIED');
    const business=await actors.office.db.from('onboarding_requirement_verifications').select('*')
      .eq('id',verified[1].verificationId).single();assert.ifError(business.error);
    assert.equal(business.data.evidence_version_id,v2);assert.equal(business.data.synthetic_valid_until,null);
    const bytesKey=await actors.office.db.from('document_versions').select('object_key').eq('id',v2).single();
    assert.ifError(bytesKey.error);
    for(const as of ['staffB','officeB','operations'])
      assert.ok((await actors[as].db.storage.from('enterprise-personnel-evidence')
        .download(bytesKey.data.object_key)).error,`${as} direct byte denial`);
    assert.equal((await request(`/api/onboarding/${caseId}/cancel`,'office',{method:'POST'})).status,200);
    assert.ok([403,404].includes((await request(`/api/onboarding/${caseId}/identity-verify`,'office',
      post({requirementId:requirement.id,versionId:v2}))).status));
    console.log(JSON.stringify({caseId,requestId,v1,v2,verificationId:verified[1].verificationId}));
  }finally{server.kill('SIGTERM');await once(server,'exit').catch(()=>{});}
});
