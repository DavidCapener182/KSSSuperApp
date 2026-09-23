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
const staffId = '10000000-0000-4000-8000-000000000003';
const staffBId = '10000000-0000-4000-8000-000000000004';
const officeId = '10000000-0000-4000-8000-000000000002';
const users = {
  admin: [process.env.KSS_TEST_ADMIN_EMAIL, process.env.KSS_TEST_ADMIN_PASSWORD],
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  officeB: [process.env.KSS_TEST_OFFICE_B_EMAIL, process.env.KSS_TEST_OFFICE_B_PASSWORD],
  staff: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
  staffB: [process.env.KSS_TEST_STAFF_B_EMAIL, process.env.KSS_TEST_STAFF_B_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
};
async function actor(name) {
  let cookies = [];
  const session = createServerClient(url,key,{cookies:{getAll:()=>cookies,setAll:(items)=>{cookies=items.map(({name,value})=>({name,value}));}}});
  const signed = await session.auth.signInWithPassword({email:users[name][0],password:users[name][1]});
  assert.ifError(signed.error);
  const db = createClient(url,key,{global:{headers:{Authorization:`Bearer ${signed.data.session.access_token}`}},
    auth:{persistSession:false,autoRefreshToken:false}});
  return { cookie:cookies.map(({name,value})=>`${name}=${value}`).join('; '), db };
}
async function port() {
  const server=createServer(); server.listen(0,'127.0.0.1'); await once(server,'listening');
  const value=server.address().port; server.close(); await once(server,'close'); return value;
}
const json=(value)=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});

test('03A synthetic case separates document evidence from requirement verification', {timeout:300000}, async () => {
  assert.ok(url && key);
  const actors={};
  for (const name of Object.keys(users)) actors[name]=await actor(name);
  const appPort=await port(), base=`http://127.0.0.1:${appPort}`;
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(appPort)],
    {cwd:process.cwd(),stdio:'ignore'});
  try {
    for(let i=0;i<100;i++){try{await fetch(base);break;}catch{await new Promise((resolve)=>setTimeout(resolve,200));}}
    const request=(path,as,options={})=>fetch(base+path,{redirect:'manual',...options,
      headers:{...(as?{cookie:actors[as].cookie}:{}),...(options.headers??{})}});
    const body=async(path,as,options)=>{const response=await request(path,as,options);return [response,await response.text()];};
    let site=(await actors.office.db.from('sites').select('id,status').eq('name','Synthetic Static Security Site')
      .eq('created_by_person_id',officeId).maybeSingle()).data;
    if(!site){
      const [created,text]=await body('/api/sites','office',json({site_reference:'SYN-STATIC-03A',name:'Synthetic Static Security Site',
        address_line1:'Synthetic address',town_city:'Synthetic town',postcode:'ZZ1 1ZZ',reporting_point:'Synthetic static-security reception'}));
      assert.equal(created.status,201,text);site=JSON.parse(text).site;
    }
    if(site.status==='DRAFT'){
      const activated=await request(`/api/sites/${site.id}`,'office',{method:'PATCH',headers:{'content-type':'application/json'},
        body:JSON.stringify({status:'ACTIVE'})});assert.equal(activated.status,200,await activated.text());
    }
    for(const personId of [staffId,staffBId]){
      const assignments=await actors.admin.db.from('site_assignments').select('id,effective_until,revoked_at')
        .eq('site_id',site.id).eq('person_id',personId);
      assert.ifError(assignments.error);
      if(!assignments.data.some((row)=>!row.revoked_at&&(!row.effective_until||Date.parse(row.effective_until)>Date.now()+60000))){
        const assigned=await request('/api/access/sites','office',json({siteId:site.id,personId,
          effectiveFrom:new Date(Date.now()-60000).toISOString(),effectiveUntil:new Date(Date.now()+86400000).toISOString(),
          reason:'Synthetic 03A onboarding scope proof'}));
        assert.equal(assigned.status,201,await assigned.text());
      }
    }
    const key1=randomUUID();
    const [created,createdText]=await body('/api/onboarding','office',json({targetPersonId:staffId,siteId:site.id,requestKey:key1}));
    assert.equal(created.status,201,createdText);const id=JSON.parse(createdText).id;
    const retry=await request('/api/onboarding','office',json({targetPersonId:staffId,siteId:site.id,requestKey:key1}));
    assert.equal(retry.status,201);assert.equal((await retry.json()).id,id);
    assert.equal((await request('/api/onboarding','staff',json({targetPersonId:staffId,siteId:site.id,requestKey:randomUUID()}))).status,403);
    const getCase=async(as='office')=>{const response=await request(`/api/onboarding/${id}`,as);return [response.status,await response.json()];};
    let [status,record]=await getCase();assert.equal(status,200);assert.equal(record.case.state,'DRAFT');
    assert.equal(record.case.templateVersion,1);assert.equal(record.case.requirements.length,6);
    assert.equal(record.case.verifiedCount,0);assert.equal(record.case.personId,staffId);
    assert.equal(record.case.requirements.find((r)=>r.code==='PERSONAL_DETAILS').state,'NOT_CONFIGURED');
    assert.equal(record.case.requirements.find((r)=>r.code==='CONTRACT_TERMS').state,'NOT_AVAILABLE');
    assert.equal(record.case.requirements.find((r)=>r.code==='CORE_KSS_INDUCTION').state,'NOT_CONNECTED');
    const rtw=record.case.requirements.find((r)=>r.code==='RIGHT_TO_WORK');assert.equal(rtw.state,'NOT_STARTED');
    assert.equal((await getCase('staff'))[0],200);
    for(const as of ['officeB','staffB','operations']){
      assert.ok([403,404].includes((await getCase(as))[0]),as);
      const direct=await actors[as].db.from('onboarding_cases').select('id').eq('id',id);
      assert.ifError(direct.error);assert.deepEqual(direct.data,[]);
    }
    assert.equal((await request(`/api/onboarding/${id}/start`,'staff',{method:'POST'})).status,403);
    assert.equal((await request(`/api/onboarding/${id}/start`,'office',{method:'POST'})).status,200);
    assert.equal((await request(`/api/onboarding/${id}/start`,'office',{method:'POST'})).status,200);
    assert.equal((await request(`/api/onboarding/${id}/rtw-request`,'staff',{method:'POST'})).status,403);
    const issued=await request(`/api/onboarding/${id}/rtw-request`,'office',{method:'POST'});
    assert.equal(issued.status,200,await issued.text());const requestId=(await (await getCase())[1]).case.requirements.find((r)=>r.code==='RIGHT_TO_WORK').documentRequestId;
    assert.ok(requestId);assert.equal((await request(`/api/onboarding/${id}/rtw-request`,'office',{method:'POST'})).status,200);
    const beforeUpload=(await getCase())[1].case.requirements.find((r)=>r.code==='RIGHT_TO_WORK');
    assert.equal(beforeUpload.state,'AWAITING_EVIDENCE');
    const invalidVerify=await request(`/api/onboarding/${id}/verify`,'office',json({requirementId:rtw.id,versionId:randomUUID()}));
    assert.equal(invalidVerify.status,403);
    const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
    const uploadBody=new FormData();uploadBody.set('file',new File([pdf],'synthetic-onboarding-rtw.pdf',{type:'application/pdf'}));
    const upload=await request(`/api/documents/${requestId}/upload`,'staff',{method:'POST',body:uploadBody});
    assert.equal(upload.status,201,await upload.text());
    const doc=(await (await request(`/api/documents/${requestId}`,'office')).json()).request;
    const versionId=doc.version.id;
    const task=(await actors.admin.db.from('tasks').select('id,state').eq('source_id',versionId).single()).data;
    assert.equal(task.state,'OPEN');
    const beforeReview=(await getCase())[1].case;
    assert.equal(beforeReview.requirements.find((r)=>r.code==='RIGHT_TO_WORK').state,'UNDER_REVIEW');
    assert.equal(beforeReview.verifiedCount,0);
    assert.equal((await request(`/api/onboarding/${id}/verify`,'office',json({requirementId:rtw.id,versionId}))).status,403);
    const reviewed=await request(`/api/documents/${requestId}/reviews`,'office',json({versionId,decision:'ACCEPTED_AS_EVIDENCE'}));
    assert.equal(reviewed.status,201,await reviewed.text());
    assert.equal((await actors.admin.db.from('tasks').select('state').eq('id',task.id).single()).data.state,'DONE');
    const afterReview=(await getCase())[1].case;
    assert.equal(afterReview.requirements.find((r)=>r.code==='RIGHT_TO_WORK').state,'UNDER_REVIEW');
    assert.equal(afterReview.verifiedCount,0);
    assert.equal((await request(`/api/onboarding/${id}/verify`,'staff',json({requirementId:rtw.id,versionId}))).status,403);
    assert.equal((await request(`/api/onboarding/${id}/verify`,'officeB',json({requirementId:rtw.id,versionId}))).status,404);
    assert.equal((await request(`/api/onboarding/${id}/verify`,'office',json({requirementId:randomUUID(),versionId}))).status,403);
    const contractRequirement=record.case.requirements.find((r)=>r.code==='CONTRACT_TERMS');
    const inductionRequirement=record.case.requirements.find((r)=>r.code==='CORE_KSS_INDUCTION');
    for(const unavailable of [contractRequirement,inductionRequirement]){
      assert.equal((await request(`/api/onboarding/${id}/verify`,'office',
        json({requirementId:unavailable.id,versionId}))).status,403);
      assert.ok((await actors.office.db.rpc('verify_onboarding_rtw',
        {requested_case:id,requested_requirement:unavailable.id,accepted_version:versionId})).error);
    }
    assert.ok((await actors.officeB.db.rpc('verify_onboarding_rtw',
      {requested_case:id,requested_requirement:rtw.id,accepted_version:versionId})).error);
    assert.ok((await actors.operations.db.rpc('verify_onboarding_rtw',
      {requested_case:id,requested_requirement:rtw.id,accepted_version:versionId})).error);
    assert.ok((await actors.office.db.from('onboarding_requirement_verifications').insert({case_id:id,requirement_id:rtw.id,
      target_person_id:staffId,verifier_person_id:officeId,evidence_version_id:versionId,decision:'VERIFIED'})).error);
    assert.ok((await actors.office.db.from('audit_events').insert({affected_person_id:staffId,
      entity_type:'onboarding_verification',entity_id:randomUUID(),action:'INSERT'})).error);
    const syntheticValidUntil=new Date(Date.now()+30000).toISOString();
    const verified=await request(`/api/onboarding/${id}/verify`,'office',json({requirementId:rtw.id,versionId,syntheticValidUntil}));
    const verifiedText=await verified.text();assert.equal(verified.status,200,verifiedText);
    const verificationId=JSON.parse(verifiedText).verificationId;
    const duplicate=await request(`/api/onboarding/${id}/verify`,'office',json({requirementId:rtw.id,versionId,syntheticValidUntil}));
    assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).verificationId,verificationId);
    const finalCase=(await getCase())[1].case;
    assert.equal(finalCase.verifiedCount,1);assert.equal(finalCase.totalCount,6);assert.equal(finalCase.state,'IN_PROGRESS');
    assert.equal(finalCase.requirements.find((r)=>r.code==='RIGHT_TO_WORK').state,'VERIFIED');
    assert.equal(finalCase.requirements.find((r)=>r.code==='CONTRACT_TERMS').state,'NOT_AVAILABLE');
    assert.equal(finalCase.requirements.find((r)=>r.code==='CORE_KSS_INDUCTION').state,'NOT_CONNECTED');
    assert.equal((await actors.admin.db.from('onboarding_requirement_verifications').select('id').eq('requirement_id',rtw.id)).data.length,1);
    const staffRole=await actors.admin.db.from('role_assignments').insert({person_id:staffId,role_code:'OFFICE_ADMIN',
      effective_from:new Date(Date.now()-1000).toISOString()}).select('id').single();
    assert.ifError(staffRole.error);
    try{
      assert.equal((await request(`/api/onboarding/${id}/verify`,'staff',json({requirementId:rtw.id,versionId}))).status,403);
      const rpc=await actors.staff.db.rpc('verify_onboarding_rtw',{requested_case:id,requested_requirement:rtw.id,accepted_version:versionId});
      assert.ok(rpc.error);
    }finally{
      const revoked=await actors.admin.db.from('role_assignments').update({effective_until:new Date(Date.now()-1000).toISOString()}).eq('id',staffRole.data.id);
      assert.ifError(revoked.error);
    }
    const officeRole='20000000-0000-4000-8000-000000000002';
    const expired=await actors.admin.db.from('role_assignments').update({effective_until:new Date(Date.now()-1000).toISOString()}).eq('id',officeRole);
    assert.ifError(expired.error);
    try{ assert.ok([401,403].includes((await request(`/api/onboarding/${id}/verify`,'office',json({requirementId:rtw.id,versionId}))).status)); }
    finally{ const restored=await actors.admin.db.from('role_assignments').update({effective_until:null}).eq('id',officeRole);assert.ifError(restored.error); }
    const cancelKey=randomUUID();
    const extra=await request('/api/onboarding','office',json({targetPersonId:staffId,siteId:site.id,requestKey:cancelKey}));
    const extraText=await extra.text();assert.equal(extra.status,201,extraText);const cancelledId=JSON.parse(extraText).id;
    assert.equal((await request(`/api/onboarding/${cancelledId}/cancel`,'office',{method:'POST'})).status,200);
    assert.equal((await request(`/api/onboarding/${cancelledId}/start`,'office',{method:'POST'})).status,403);
    assert.equal((await request(`/api/onboarding/${cancelledId}/rtw-request`,'office',{method:'POST'})).status,403);
    assert.equal((await (await request(`/api/onboarding/${cancelledId}`,'office')).json()).case.state,'CANCELLED');
    const uploadCancel=await request('/api/onboarding','office',json({targetPersonId:staffId,siteId:site.id,requestKey:randomUUID()}));
    assert.equal(uploadCancel.status,201);const uploadCancelId=(await uploadCancel.json()).id;
    assert.equal((await request(`/api/onboarding/${uploadCancelId}/start`,'office',{method:'POST'})).status,200);
    assert.equal((await request(`/api/onboarding/${uploadCancelId}/rtw-request`,'office',{method:'POST'})).status,200);
    const uploadCancelRequest=(await (await request(`/api/onboarding/${uploadCancelId}`,'office')).json()).case.requirements
      .find((r)=>r.code==='RIGHT_TO_WORK').documentRequestId;
    assert.equal((await request(`/api/onboarding/${uploadCancelId}/cancel`,'office',{method:'POST'})).status,200);
    const cancelledUpload=new FormData();cancelledUpload.set('file',new File([pdf],'synthetic-cancelled-rtw.pdf',{type:'application/pdf'}));
    assert.equal((await request(`/api/documents/${uploadCancelRequest}/upload`,'staff',
      {method:'POST',body:cancelledUpload})).status,409);
    const cancelledDocument=await actors.admin.db.from('documents').select('id').eq('request_id',uploadCancelRequest).single();
    assert.ifError(cancelledDocument.error);
    assert.deepEqual((await actors.admin.db.from('document_versions').select('id')
      .eq('document_id',cancelledDocument.data.id)).data,[]);
    const reviewCancel=await request('/api/onboarding','office',json({targetPersonId:staffId,siteId:site.id,requestKey:randomUUID()}));
    assert.equal(reviewCancel.status,201);const reviewCancelId=(await reviewCancel.json()).id;
    assert.equal((await request(`/api/onboarding/${reviewCancelId}/start`,'office',{method:'POST'})).status,200);
    assert.equal((await request(`/api/onboarding/${reviewCancelId}/rtw-request`,'office',{method:'POST'})).status,200);
    const reviewCancelRequest=(await (await request(`/api/onboarding/${reviewCancelId}`,'office')).json()).case.requirements
      .find((r)=>r.code==='RIGHT_TO_WORK').documentRequestId;
    const reviewCancelUpload=new FormData();reviewCancelUpload.set('file',new File([pdf],
      'synthetic-before-cancellation.pdf',{type:'application/pdf'}));
    assert.equal((await request(`/api/documents/${reviewCancelRequest}/upload`,'staff',
      {method:'POST',body:reviewCancelUpload})).status,201);
    const reviewCancelVersion=(await (await request(`/api/documents/${reviewCancelRequest}`,'office')).json()).request.version.id;
    assert.equal((await request(`/api/onboarding/${id}/verify`,'office',
      json({requirementId:rtw.id,versionId:reviewCancelVersion}))).status,403);
    assert.ok((await actors.office.db.rpc('verify_onboarding_rtw',
      {requested_case:id,requested_requirement:rtw.id,accepted_version:reviewCancelVersion})).error);
    assert.equal((await request(`/api/onboarding/${reviewCancelId}/cancel`,'office',{method:'POST'})).status,200);
    assert.notEqual((await request(`/api/documents/${reviewCancelRequest}/reviews`,'office',
      json({versionId:reviewCancelVersion,decision:'ACCEPTED_AS_EVIDENCE'}))).status,201);
    assert.deepEqual((await actors.admin.db.from('document_reviews').select('id')
      .eq('version_id',reviewCancelVersion)).data,[]);
    const rejectedCase=await request('/api/onboarding','office',json({targetPersonId:staffId,siteId:site.id,requestKey:randomUUID()}));
    assert.equal(rejectedCase.status,201);const rejectedId=(await rejectedCase.json()).id;
    assert.equal((await request(`/api/onboarding/${rejectedId}/start`,'office',{method:'POST'})).status,200);
    assert.equal((await request(`/api/onboarding/${rejectedId}/rtw-request`,'office',{method:'POST'})).status,200);
    const rejectedDetail=(await (await request(`/api/onboarding/${rejectedId}`,'office')).json()).case;
    const rejectedRtw=rejectedDetail.requirements.find((r)=>r.code==='RIGHT_TO_WORK');
    const rejectedUpload=new FormData();rejectedUpload.set('file',new File([pdf],
      'synthetic-rejected-rtw.pdf',{type:'application/pdf'}));
    assert.equal((await request(`/api/documents/${rejectedRtw.documentRequestId}/upload`,'staff',
      {method:'POST',body:rejectedUpload})).status,201);
    const rejectedVersion=(await (await request(`/api/documents/${rejectedRtw.documentRequestId}`,'office')).json()).request.version.id;
    const rejection=await request(`/api/documents/${rejectedRtw.documentRequestId}/reviews`,'office',
      json({versionId:rejectedVersion,decision:'REJECTED',reasonCode:'WRONG_DOCUMENT',
        comment:'Synthetic wrong document for this test.'}));
    assert.equal(rejection.status,201,await rejection.text());
    assert.equal((await request(`/api/onboarding/${rejectedId}/verify`,'office',
      json({requirementId:rejectedRtw.id,versionId:rejectedVersion}))).status,403);
    assert.ok((await actors.office.db.rpc('verify_onboarding_rtw',
      {requested_case:rejectedId,requested_requirement:rejectedRtw.id,accepted_version:rejectedVersion})).error);
    assert.equal((await (await request(`/api/onboarding/${rejectedId}`,'staff')).json()).case.requirements
      .find((r)=>r.code==='RIGHT_TO_WORK').state,'ACTION_REQUIRED');
    while(Date.now()<=Date.parse(syntheticValidUntil)) await new Promise((resolve)=>setTimeout(resolve,250));
    const expiredCase=(await getCase())[1].case;
    assert.equal(expiredCase.verifiedCount,0);
    assert.equal(expiredCase.requirements.find((r)=>r.code==='RIGHT_TO_WORK').state,'EXPIRED');
    const historicalVerification=await actors.admin.db.from('onboarding_requirement_verifications')
      .select('id,synthetic_valid_until').eq('id',verificationId).single();
    assert.ifError(historicalVerification.error);assert.equal(historicalVerification.data.id,verificationId);
    const audit=await actors.admin.db.from('audit_events').select('id').eq('entity_type','onboarding_verification').eq('entity_id',verificationId);
    assert.ifError(audit.error);assert.equal(audit.data.length,1);
  }finally{server.kill();}
});
