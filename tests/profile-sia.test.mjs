import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { londonToday, siaExpired } from '../src/lib/profile/policy.ts';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const staffId='10000000-0000-4000-8000-000000000003';
const staffBId='10000000-0000-4000-8000-000000000004';
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
  const session=createServerClient(url,key,{cookies:{getAll:()=>cookies,setAll:(items)=>{cookies=items.map(({name,value})=>({name,value}));}}});
  const signed=await signInWithTestSession(session,{email:users[name][0],password:users[name][1]});
  assert.ifError(signed.error);
  const db=createClient(url,key,{global:{headers:{Authorization:`Bearer ${signed.data.session.access_token}`}},
    auth:{persistSession:false,autoRefreshToken:false}});
  return {cookie:cookies.map(({name,value})=>`${name}=${value}`).join('; '),db};
}
async function port(){
  const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const value=server.address().port;server.close();await once(server,'close');return value;
}
const post=(value)=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
const put=(value)=>({method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
const profile={legal_first_name:'Synthetic',surname:'Starter A',preferred_name:'Staff A',
  contact_email:'synthetic.staff.a@example.invalid',mobile:'07123 000 001',
  address_line1:'1 Synthetic Lane',address_line2:'',town_city:'Example Town',postcode:'ZZ1 1ZZ'};

test('03B V2 profile and SIA preserve exact submissions, evidence and access', {timeout:300000}, async()=>{
  assert.ok(url&&key);
  const actors={};for(const name of Object.keys(users))actors[name]=await actor(name);
  const appPort=await port(),base=`http://127.0.0.1:${appPort}`;
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(appPort)],
    {cwd:process.cwd(),stdio:'ignore'});
  try{
    for(let i=0;i<100;i++){try{await fetch(base);break;}catch{await new Promise((resolve)=>setTimeout(resolve,200));}}
    const request=(path,as,options={})=>fetch(base+path,{redirect:'manual',...options,
      headers:{...(as?{cookie:actors[as].cookie}:{}),...(options.headers??{})}});
    const body=async(path,as,options)=>{const response=await request(path,as,options);return [response,await response.text()];};
    const versions=await actors.office.db.from('onboarding_template_versions').select('id,version_number')
      .order('version_number',{ascending:true});
    assert.ifError(versions.error);assert.deepEqual(versions.data.map((v)=>v.version_number),[1,2]);
    const v1=versions.data[0];
    const original=await actors.office.db.from('onboarding_cases').select('id,template_version_id')
      .eq('person_id',staffId).eq('template_version_id',v1.id).limit(1);
    assert.ifError(original.error);assert.ok(original.data.length,'03A V1 case must remain');
    const site=await actors.office.db.from('sites').select('id').eq('name','Synthetic Static Security Site')
      .eq('created_by_person_id','10000000-0000-4000-8000-000000000002').single();
    assert.ifError(site.error);
    const [created,createdText]=await body('/api/onboarding','office',post({targetPersonId:staffId,siteId:site.data.id,requestKey:randomUUID()}));
    assert.equal(created.status,201,createdText);const caseId=JSON.parse(createdText).id;
    const caseAt=async(as='office')=>{const response=await request(`/api/onboarding/${caseId}`,as);
      return [response.status,response.ok?(await response.json()).case:null];};
    let c=(await caseAt())[1];assert.equal(c.templateVersion,2);assert.equal(c.totalCount,6);
    assert.equal((await request(`/api/onboarding/${caseId}/start`,'office',{method:'POST'})).status,200);
    assert.equal((await caseAt('staff'))[0],200);
    for(const as of ['officeB','staffB','operations'])assert.ok([403,404].includes((await caseAt(as))[0]),as);
    for(const as of ['staffB','operations']){
      const direct=await actors[as].db.from('person_profiles').select('person_id').eq('person_id',staffId);
      assert.ifError(direct.error);assert.deepEqual(direct.data,[]);
      assert.ok((await actors[as].db.from('person_profile_revisions').select('id').eq('person_id',staffId)).data.length===0);
    }
    assert.equal((await request('/api/profile','staffB')).status,200);
    assert.equal((await request('/api/profile','operations')).status,403);
    const beforeRevision=await actors.staff.db.from('person_profile_revisions').select('id').eq('person_id',staffId);
    assert.ifError(beforeRevision.error);
    const invalid=await request('/api/profile','staff',put({...profile,contact_email:'invalid'}));
    assert.equal(invalid.status,400);
    assert.equal((await request('/api/profile','staff',put(profile))).status,200);
    assert.equal((await request('/api/profile','staff',put({...profile,preferred_name:'Starter A'}))).status,200);
    const draftRevisions=await actors.staff.db.from('person_profile_revisions').select('id').eq('person_id',staffId);
    assert.equal(draftRevisions.data.length,beforeRevision.data.length,'drafts do not create revisions');
    const personal=(await caseAt('staff'))[1].requirements.find((r)=>r.code==='PERSONAL_DETAILS');
    assert.equal(personal.state,'AWAITING_SUBMISSION');
    const [submitted,submittedText]=await body('/api/profile/submissions','staff',post({caseId,requestKey:randomUUID()}));
    if(submitted.status!==201){const diagnostic=await actors.staff.db.rpc('submit_onboarding_profile',{requested_case:caseId,supplied_request_key:randomUUID()});
      assert.equal(submitted.status,201,JSON.stringify({submittedText,diagnosticError:diagnostic.error}));}
    assert.equal((await caseAt('staff'))[1].requirements.find((r)=>r.code==='PERSONAL_DETAILS').state,'COMPLETE');
    assert.equal((await request('/api/profile','staff',put({...profile,preferred_name:'Optional alias'}))).status,200);
    assert.equal((await caseAt('staff'))[1].requirements.find((r)=>r.code==='PERSONAL_DETAILS').state,'COMPLETE');
    assert.equal((await request('/api/profile','staff',put({...profile,mobile:'07123 000 002'}))).status,200);
    assert.equal((await caseAt('staff'))[1].requirements.find((r)=>r.code==='PERSONAL_DETAILS').state,'UPDATE_NEEDS_SUBMISSION');
    assert.equal((await request('/api/profile','staff',put(profile))).status,200);
    assert.equal((await caseAt('staff'))[1].requirements.find((r)=>r.code==='PERSONAL_DETAILS').state,
      'UPDATE_NEEDS_SUBMISSION','restoring old values is not a resubmission');
    const oldRevision=(await caseAt())[1].submittedProfile;
    assert.equal(oldRevision.mobile,'07123 000 001');
    assert.equal((await request('/api/profile/submissions','staff',post({caseId,requestKey:randomUUID()}))).status,201);
    assert.equal((await caseAt('staff'))[1].requirements.find((r)=>r.code==='PERSONAL_DETAILS').state,'COMPLETE');
    assert.equal((await actors.office.db.from('person_profile_revisions').select('mobile').eq('id',oldRevision.id).single()).data.mobile,
      '07123 000 001');
    const directSuper=await actors.admin.db.from('person_profiles').select('person_id').eq('person_id',staffId);
    assert.ifError(directSuper.error);assert.deepEqual(directSuper.data,[],'Super Admin private values require audited case read');
    const superCase=await request(`/api/onboarding/${caseId}`,'admin');
    assert.equal(superCase.status,200,await superCase.text());
    const superReadAudit=await actors.admin.db.from('audit_events').select('id')
      .eq('entity_type','person_profile').eq('action','READ').eq('affected_person_id',staffId);
    assert.ifError(superReadAudit.error);assert.ok(superReadAudit.data.length>0);
    assert.ok((await actors.staff.db.from('person_profile_revisions').insert({person_id:staffId})).error);
    assert.ok((await actors.staffB.db.from('person_profiles').update({legal_first_name:'Forged'}).eq('person_id',staffId)).error);
    const officeBProfile=await actors.officeB.db.from('person_profiles').select('person_id').eq('person_id',staffId);
    assert.ifError(officeBProfile.error);assert.deepEqual(officeBProfile.data,[]);
    assert.ok((await actors.staff.db.from('audit_events').insert({entity_type:'profile_submission',entity_id:randomUUID(),action:'INSERT'})).error);
    const expiry=new Date(Date.now()+86400000*30).toISOString().slice(0,10);
    const credential={category:'SECURITY_GUARDING',reference:'SYN-SIA-03B-A',expiresOn:expiry};
    assert.equal((await request('/api/profile/sia','staff',put(credential))).status,200);
    assert.equal((await request('/api/profile/sia/submissions','staff',
      post({caseId,category:'DOOR_SUPERVISION',requestKey:randomUUID()}))).status,400);
    const [siaSubmit,siaText]=await body('/api/profile/sia/submissions','staff',post({caseId,category:'SECURITY_GUARDING',requestKey:randomUUID()}));
    assert.equal(siaSubmit.status,201,siaText);let submissionId=JSON.parse(siaText).submissionId;
    c=(await caseAt())[1];const sia=c.requirements.find((r)=>r.code==='SIA_LICENCE');
    assert.equal(sia.state,'AWAITING_EVIDENCE_REQUEST');
    assert.equal((await request('/api/profile/sia','staff',put({...credential,reference:'SYN-SIA-03B-CHANGED'}))).status,200);
    assert.equal((await request(`/api/onboarding/${caseId}/sia-request`,'office',
      post({requirementId:sia.id,submissionId}))).status,403,'stale credential cannot receive request');
    assert.equal((await request('/api/profile/sia','staff',put(credential))).status,200);
    assert.equal((await request(`/api/onboarding/${caseId}/sia-request`,'office',
      post({requirementId:sia.id,submissionId}))).status,403,'reverted values remain stale');
    const renewed=await request('/api/profile/sia/submissions','staff',post({caseId,category:'SECURITY_GUARDING',requestKey:randomUUID()}));
    assert.equal(renewed.status,201,await renewed.text());
    submissionId=(await caseAt())[1].requirements.find((r)=>r.code==='SIA_LICENCE').siaSubmissionId;
    assert.equal((await request(`/api/onboarding/${caseId}/sia-request`,'staff',
      post({requirementId:sia.id,submissionId}))).status,403);
    const [issued,issuedText]=await body(`/api/onboarding/${caseId}/sia-request`,'office',
      post({requirementId:sia.id,submissionId}));
    assert.equal(issued.status,200,issuedText);const requestId=JSON.parse(issuedText).requestId;
    assert.equal((await request(`/api/onboarding/${caseId}/sia-verify`,'office',
      post({requirementId:sia.id,submissionId,versionId:randomUUID()}))).status,403);
    const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
    const uploadBody=new FormData();uploadBody.set('file',new File([pdf],'synthetic-sia-evidence.pdf',{type:'application/pdf'}));
    const upload=await request(`/api/documents/${requestId}/upload`,'staff',{method:'POST',body:uploadBody});
    assert.equal(upload.status,201,await upload.text());
    const doc=(await (await request(`/api/documents/${requestId}`,'office')).json()).request;
    const versionId=doc.version.id;
    const task=(await actors.office.db.from('tasks').select('id,state').eq('source_id',versionId).single()).data;
    assert.equal(task.state,'OPEN');
    assert.equal((await request(`/api/onboarding/${caseId}/sia-verify`,'office',
      post({requirementId:sia.id,submissionId,versionId}))).status,403);
    const review=await request(`/api/documents/${requestId}/reviews`,'office',
      post({versionId,decision:'ACCEPTED_AS_EVIDENCE'}));
    assert.equal(review.status,201,await review.text());
    assert.equal((await actors.office.db.from('tasks').select('state').eq('id',task.id).single()).data.state,'DONE');
    assert.equal((await caseAt())[1].requirements.find((r)=>r.code==='SIA_LICENCE').state,'UNDER_REVIEW');
    assert.ok((await actors.office.db.from('onboarding_requirement_verifications').insert({
      case_id:caseId,requirement_id:sia.id,target_person_id:staffId,evidence_version_id:versionId,
      decision:'VERIFIED',sia_submission_id:submissionId})).error);
    assert.equal((await request(`/api/documents/${requestId}`,'operations')).status,403);
    assert.ok([403,404].includes((await request(`/api/documents/${requestId}`,'staffB')).status));
    assert.equal((await request(`/api/onboarding/${caseId}/sia-verify`,'staff',
      post({requirementId:sia.id,submissionId,versionId}))).status,403);
    const dualRole=await actors.admin.db.from('role_assignments').insert({person_id:staffId,role_code:'OFFICE_ADMIN',
      effective_from:new Date(Date.now()-1000).toISOString()}).select('id').single();
    assert.ifError(dualRole.error);
    try{
      assert.ok((await actors.staff.db.rpc('verify_onboarding_sia',{requested_case:caseId,
        requested_requirement:sia.id,requested_submission:submissionId,accepted_version:versionId})).error);
    }finally{
      const revoked=await actors.admin.db.from('role_assignments').update({effective_until:new Date(Date.now()-1000).toISOString()})
        .eq('id',dualRole.data.id);assert.ifError(revoked.error);
    }
    assert.ok((await actors.staff.db.rpc('verify_onboarding_sia',{requested_case:caseId,
      requested_requirement:sia.id,requested_submission:submissionId,accepted_version:versionId})).error);
    assert.ok((await actors.officeB.db.rpc('verify_onboarding_sia',{requested_case:caseId,
      requested_requirement:sia.id,requested_submission:submissionId,accepted_version:versionId})).error);
    const verified=await request(`/api/onboarding/${caseId}/sia-verify`,'office',
      post({requirementId:sia.id,submissionId,versionId}));
    assert.equal(verified.status,200,await verified.text());
    assert.equal((await caseAt())[1].requirements.find((r)=>r.code==='SIA_LICENCE').state,'VERIFIED');
    const rtw=(await caseAt())[1].requirements.find((r)=>r.code==='RIGHT_TO_WORK');
    assert.equal((await request(`/api/onboarding/${caseId}/rtw-request`,'office',{method:'POST'})).status,200);
    const rtwRequest=(await caseAt())[1].requirements.find((r)=>r.code==='RIGHT_TO_WORK').documentRequestId;
    const rtwUpload=new FormData();
    rtwUpload.set('file',new File([pdf],'synthetic-v2-rtw.pdf',{type:'application/pdf'}));
    const rtwUploaded=await request(`/api/documents/${rtwRequest}/upload`,'staff',{method:'POST',body:rtwUpload});
    assert.equal(rtwUploaded.status,201,await rtwUploaded.text());
    const rtwVersion=(await (await request(`/api/documents/${rtwRequest}`,'office')).json()).request.version.id;
    assert.equal((await request(`/api/onboarding/${caseId}/sia-verify`,'office',
      post({requirementId:sia.id,submissionId,versionId:rtwVersion}))).status,403);
    const rtwReviewed=await request(`/api/documents/${rtwRequest}/reviews`,'office',
      post({versionId:rtwVersion,decision:'ACCEPTED_AS_EVIDENCE'}));
    assert.equal(rtwReviewed.status,201,await rtwReviewed.text());
    const rtwVerified=await request(`/api/onboarding/${caseId}/verify`,'office',
      post({requirementId:rtw.id,versionId:rtwVersion}));
    assert.equal(rtwVerified.status,200,await rtwVerified.text());
    c=(await caseAt())[1];
    assert.equal(c.verifiedCount,3);assert.equal(c.totalCount,6);assert.equal(c.state,'IN_PROGRESS');
    assert.equal(c.requirements.find((r)=>r.code==='IDENTITY_EVIDENCE').state,'NOT_CONFIGURED');
    assert.equal(c.requirements.find((r)=>r.code==='CONTRACT_TERMS').state,'NOT_AVAILABLE');
    assert.equal(c.requirements.find((r)=>r.code==='CORE_KSS_INDUCTION').state,'NOT_CONNECTED');
    const officeRole='20000000-0000-4000-8000-000000000002';
    const expiredOffice=await actors.admin.db.from('role_assignments').update({effective_until:new Date(Date.now()-1000).toISOString()})
      .eq('id',officeRole);assert.ifError(expiredOffice.error);
    try{
      assert.ok((await actors.office.db.rpc('verify_onboarding_sia',{requested_case:caseId,
        requested_requirement:sia.id,requested_submission:submissionId,accepted_version:versionId})).error);
    }finally{
      const restored=await actors.admin.db.from('role_assignments').update({effective_until:null})
        .eq('id',officeRole);assert.ifError(restored.error);
    }
    assert.equal((await request('/api/profile/sia','staff',put({...credential,reference:'SYN-SIA-03B-EDITED'}))).status,200);
    assert.equal((await request('/api/profile/sia','staff',put(credential))).status,200);
    c=(await caseAt())[1];
    assert.equal(c.requirements.find((r)=>r.code==='SIA_LICENCE').state,'UPDATE_NEEDS_SUBMISSION');
    assert.equal(c.verifiedCount,2,'old SIA verification cannot revive after edits');
    assert.ok((await actors.office.db.rpc('verify_onboarding_sia',{requested_case:caseId,
      requested_requirement:sia.id,requested_submission:submissionId,accepted_version:versionId})).error);
    const replacementSubmit=await request('/api/profile/sia/submissions','staff',
      post({caseId,category:'SECURITY_GUARDING',requestKey:randomUUID()}));
    assert.equal(replacementSubmit.status,201,await replacementSubmit.text());
    const replacementSubmission=(await caseAt())[1].requirements.find((r)=>r.code==='SIA_LICENCE').siaSubmissionId;
    const replacementRequest=await request(`/api/onboarding/${caseId}/sia-request`,'office',
      post({requirementId:sia.id,submissionId:replacementSubmission}));
    assert.equal(replacementRequest.status,200,await replacementRequest.text());
    const replacementRequestId=(await caseAt())[1].requirements.find((r)=>r.code==='SIA_LICENCE').documentRequestId;
    assert.notEqual(replacementRequestId,requestId);
    const replacementUpload=new FormData();
    replacementUpload.set('file',new File([pdf],'synthetic-sia-renewed.pdf',{type:'application/pdf'}));
    const replaced=await request(`/api/documents/${replacementRequestId}/upload`,'staff',
      {method:'POST',body:replacementUpload});
    assert.equal(replaced.status,201,await replaced.text());
    const replacementVersion=(await (await request(`/api/documents/${replacementRequestId}`,'office')).json()).request.version.id;
    const replacementReview=await request(`/api/documents/${replacementRequestId}/reviews`,'office',
      post({versionId:replacementVersion,decision:'ACCEPTED_AS_EVIDENCE'}));
    assert.equal(replacementReview.status,201,await replacementReview.text());
    const replacementVerified=await request(`/api/onboarding/${caseId}/sia-verify`,'office',
      post({requirementId:sia.id,submissionId:replacementSubmission,versionId:replacementVersion}));
    assert.equal(replacementVerified.status,200,await replacementVerified.text());
    c=(await caseAt())[1];assert.equal(c.verifiedCount,3);assert.equal(c.state,'IN_PROGRESS');
    assert.equal((await actors.office.db.from('onboarding_requirement_verifications').select('id')
      .eq('requirement_id',sia.id)).data.length,2,'both exact verification decisions remain immutable');
    assert.equal(siaExpired(expiry,expiry),false,'valid through the displayed UK date');
    const dayAfter=new Date(`${expiry}T12:00:00Z`);dayAfter.setUTCDate(dayAfter.getUTCDate()+1);
    assert.equal(siaExpired(expiry,londonToday(dayAfter)),true,'expires from the next UK calendar day');
    assert.equal(londonToday(new Date('2026-10-24T22:59:00Z')),'2026-10-24');
    assert.equal(londonToday(new Date('2026-10-24T23:01:00Z')),'2026-10-25');
    assert.ok((await actors.office.db.from('onboarding_requirement_verifications').select('id')
      .eq('requirement_id',sia.id)).data.length===2,'expiry never deletes either historical decision');
    assert.equal((await actors.office.db.from('onboarding_cases').select('template_version_id').eq('id',original.data[0].id).single()).data.template_version_id,
      v1.id);
    assert.equal((await actors.operations.db.from('person_sia_credentials').select('id').eq('person_id',staffId)).data.length,0);
    const [coverCase,coverText]=await body('/api/onboarding','office',
      post({targetPersonId:staffBId,siteId:site.data.id,requestKey:randomUUID()}));
    assert.equal(coverCase.status,201,coverText);
    const coverId=JSON.parse(coverText).id;
    const staffBProfile={...profile,legal_first_name:'Synthetic',surname:'Starter B',
      contact_email:'synthetic.staff.b@example.invalid'};
    assert.equal((await request('/api/profile','staffB',put(staffBProfile))).status,200);
    const beforeCancel=await actors.office.db.from('person_profiles').select('person_id').eq('person_id',staffBId);
    assert.ifError(beforeCancel.error);assert.equal(beforeCancel.data.length,1);
    assert.equal((await request(`/api/onboarding/${coverId}/cancel`,'office',{method:'POST'})).status,200);
    const afterCancel=await actors.office.db.from('person_profiles').select('person_id').eq('person_id',staffBId);
    assert.ifError(afterCancel.error);assert.deepEqual(afterCancel.data,[],
      'cancelled case ownership cannot expose later current private profile');
  }finally{server.kill('SIGTERM');await once(server,'exit').catch(()=>{});}
});
