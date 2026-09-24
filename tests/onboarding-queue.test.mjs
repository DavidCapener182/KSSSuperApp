import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const officeId='10000000-0000-4000-8000-000000000002';
const officeBId='10000000-0000-4000-8000-000000000006';
const staffId='10000000-0000-4000-8000-000000000003';
const acceptedCase='3d3f1499-6163-4c9b-9adb-11972cedc985';
const users={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
  office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
  officeB:[process.env.KSS_TEST_OFFICE_B_EMAIL,process.env.KSS_TEST_OFFICE_B_PASSWORD],
  staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
  staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD],
  operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD]};
const post=(value)=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
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

test('03E bounded team triage, cover, reassignment and cancellation', {timeout:360000},async()=>{
  assert.ok(url&&key);const actors={};for(const name of Object.keys(users))actors[name]=await actor(name);
  const appPort=await port(),base=`http://127.0.0.1:${appPort}`;
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(appPort)],
    {cwd:process.cwd(),stdio:'ignore'});
  let membershipId=null;
  try{
    for(let i=0;i<100;i++){try{await fetch(base);break;}catch{await new Promise((resolve)=>setTimeout(resolve,200));}}
    const request=(path,as,options={})=>fetch(base+path,{redirect:'manual',...options,
      headers:{...(as?{cookie:actors[as].cookie}:{}),...(options.headers??{})}});
    const json=async(path,as,options={})=>{const response=await request(path,as,options);
      return [response.status,await response.json().catch(()=>null)];};
    const queue=async(as,view='TEAM_QUEUE',search='')=>json(`/api/onboarding/queue?view=${view}&search=${encodeURIComponent(search)}&limit=50`,as);
    const caseAt=async(id,as)=>(await json(`/api/onboarding/${id}`,as))[1]?.case;
    const [initialStatus,initial]=await queue('office');assert.equal(initialStatus,200);
    const [acceptedStatus,acceptedRecord]=await json(`/api/onboarding/${acceptedCase}`,'office');
    assert.equal(acceptedStatus,200,JSON.stringify(acceptedRecord));
    const acceptedBefore=acceptedRecord.case?.verifiedCount;
    assert.ok(Number.isInteger(acceptedBefore) && acceptedBefore>=0 && acceptedBefore<=6);
    let acceptedQueueRow=initial.rows.find((row)=>row.id===acceptedCase);
    for(let offset=50;!acceptedQueueRow && offset<10000 && initial.rows.length===50;offset+=50){
      const [pageStatus,page]=await json(`/api/onboarding/queue?view=TEAM_QUEUE&limit=50&offset=${offset}`,'office');
      assert.equal(pageStatus,200);
      acceptedQueueRow=page.rows.find((row)=>row.id===acceptedCase);
      if(page.rows.length<50)break;
    }
    const teamId=acceptedQueueRow?.teamId;assert.ok(teamId);
    const site=(await actors.office.db.from('sites').select('id').eq('name','Synthetic Static Security Site')
      .eq('created_by_person_id',officeId).single());assert.ifError(site.error);
    const createCase=async()=>{const [status,body]=await json('/api/onboarding','office',post({
      targetPersonId:staffId,siteId:site.data.id,requestKey:randomUUID()}));
      assert.equal(status,201,JSON.stringify(body));
      assert.equal((await request(`/api/onboarding/${body.id}/start`,'office',{method:'POST'})).status,200);
      return body.id;};
    const issueAndSubmit=async(id)=>{
      const [issueStatus,issued]=await json(`/api/onboarding/${id}/rtw-request`,'office',{method:'POST'});
      assert.equal(issueStatus,200,JSON.stringify(issued));
      const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
      const upload=new FormData();upload.set('file',new File([pdf],`synthetic-03e-${randomUUID()}.pdf`,{type:'application/pdf'}));
      const submitted=await request(`/api/documents/${issued.requestId}/upload`,'staff',{method:'POST',body:upload});
      assert.equal(submitted.status,201,await submitted.text());
      const document=(await json(`/api/documents/${issued.requestId}`,'office'))[1].request;
      const task=(await actors.admin.db.from('tasks').select('id,state,assignee_person_id,created_at')
        .eq('source_id',document.version.id).single());assert.ifError(task.error);
      return {requestId:issued.requestId,versionId:document.version.id,task:task.data};
    };
    const coveredCase=await createCase();
    assert.equal((await queue('officeB'))[1].total,0,'outside-team Office has no queue count');
    assert.ok([403,404].includes((await json(`/api/onboarding/${coveredCase}`,'officeB'))[0]));
    assert.ok((await actors.officeB.db.from('onboarding_cases').select('id').eq('id',coveredCase)).data.length===0);
    assert.ok((await actors.officeB.db.rpc('grant_onboarding_team_member',{requested_team:teamId,
      target_person:officeBId,starts_at:new Date().toISOString(),ends_at:null,can_coordinate_reassign:false})).error);
    const grant=await actors.admin.db.rpc('grant_onboarding_team_member',{requested_team:teamId,
      target_person:officeBId,starts_at:new Date().toISOString(),ends_at:null,can_coordinate_reassign:false});
    assert.ifError(grant.error);membershipId=grant.data;
    const [teamStatus,teamQueue]=await queue('officeB');assert.equal(teamStatus,200);
    const triage=teamQueue.rows.find((row)=>row.id===coveredCase);assert.ok(triage);
    assert.equal(triage.canOpen,false);assert.equal(triage.canReassign,false);
    for(const forbiddenField of ['contactEmail','addressLine1','mobile','filename','documentRequestId','versionId','reviewerComment'])
      assert.ok(!JSON.stringify(triage).includes(forbiddenField),forbiddenField);
    assert.ok([403,404].includes((await json(`/api/onboarding/${coveredCase}`,'officeB'))[0]));
    const coveredWork=await issueAndSubmit(coveredCase);
    assert.ok([403,404].includes((await json(`/api/documents/${coveredWork.requestId}`,'officeB'))[0]));
    assert.ok((await actors.officeB.db.from('tasks').select('id').eq('id',coveredWork.task.id)).data.length===0);
    const tooLong=await actors.office.db.rpc('grant_onboarding_case_cover',{requested_case:coveredCase,
      covering_person:officeBId,starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+15*86400000).toISOString(),
      reason_text:'Synthetic 03E overlong cover denied'});assert.ok(tooLong.error);
    const [coverStatus,cover]=await json(`/api/onboarding/${coveredCase}/cover`,'office',post({
      coveringPersonId:officeBId,startsAt:new Date().toISOString(),endsAt:new Date(Date.now()+86400000).toISOString(),
      reason:'Synthetic named case cover while Office A is unavailable.'}));
    assert.equal(coverStatus,200,JSON.stringify(cover));
    assert.equal((await json(`/api/onboarding/${coveredCase}`,'officeB'))[0],200);
    assert.equal((await json(`/api/documents/${coveredWork.requestId}`,'officeB'))[0],200);
    const coveringTasks=(await json('/api/tasks','officeB'))[1].tasks;
    assert.ok(coveringTasks.some((task)=>task.id===coveredWork.task.id&&task.covering));
    assert.equal((await actors.admin.db.from('tasks').select('assignee_person_id').eq('id',coveredWork.task.id).single()).data.assignee_person_id,officeId);
    const [reviewStatus]=await json(`/api/documents/${coveredWork.requestId}/reviews`,'officeB',post({
      versionId:coveredWork.versionId,decision:'ACCEPTED_AS_EVIDENCE'}));assert.equal(reviewStatus,201);
    const reviewedTask=(await actors.admin.db.from('tasks').select('state,assignee_person_id,completion_event_id')
      .eq('id',coveredWork.task.id).single()).data;
    assert.equal(reviewedTask.state,'DONE');assert.equal(reviewedTask.assignee_person_id,officeId);
    assert.equal((await actors.admin.db.from('document_reviews').select('reviewer_person_id')
      .eq('id',reviewedTask.completion_event_id).single()).data.reviewer_person_id,officeBId);
    const coveredRequirement=(await caseAt(coveredCase,'officeB')).requirements.find((item)=>item.code==='RIGHT_TO_WORK');
    assert.equal((await json(`/api/onboarding/${coveredCase}/verify`,'officeB',post({
      requirementId:coveredRequirement.id,versionId:coveredWork.versionId})))[0],200);
    assert.equal((await caseAt(coveredCase,'officeB')).requirements.find((item)=>item.code==='RIGHT_TO_WORK').state,'VERIFIED');
    assert.ok([403,404].includes((await json(`/api/documents/${coveredWork.requestId}`,'officeB'))[0]),
      'cover cannot browse completed historical evidence');
    assert.equal((await request(`/api/onboarding/${coveredCase}/cover/${cover.grantId}`,'office',{method:'DELETE'})).status,200);
    assert.ok([403,404].includes((await json(`/api/onboarding/${coveredCase}`,'officeB'))[0]));
    assert.ok([403,404].includes((await json(`/api/documents/${coveredWork.requestId}`,'officeB'))[0]));
    const permanentCase=await createCase();const openWork=await issueAndSubmit(permanentCase);
    assert.ok((await actors.staff.db.rpc('reassign_onboarding_case',{requested_case:permanentCase,
      new_owner:officeBId,reason_text:'Synthetic Staff self reassignment denied'})).error);
    assert.ok((await actors.officeB.db.rpc('reassign_onboarding_case',{requested_case:permanentCase,
      new_owner:officeBId,reason_text:'Synthetic self granted case denied'})).error);
    const [moveStatus,move]=await json(`/api/onboarding/${permanentCase}/reassign`,'office',post({
      newOwnerPersonId:officeBId,reason:'Synthetic workload handover to Office B for 03E proof.'}));
    assert.equal(moveStatus,200,JSON.stringify(move));
    const owner=(await actors.admin.db.from('onboarding_cases').select('owner_person_id').eq('id',permanentCase).single());
    assert.equal(owner.data.owner_person_id,officeBId);
    const movedTask=(await actors.admin.db.from('tasks').select('state,assignee_person_id,source_id,created_at')
      .eq('id',openWork.task.id).single()).data;
    assert.equal(movedTask.state,'OPEN');assert.equal(movedTask.assignee_person_id,officeBId);
    assert.equal(movedTask.source_id,openWork.versionId);assert.equal(movedTask.created_at,openWork.task.created_at);
    const changes=await actors.admin.db.from('onboarding_case_owner_changes').select('*').eq('case_id',permanentCase);
    assert.ifError(changes.error);assert.equal(changes.data.length,1);
    assert.equal(changes.data[0].old_owner_person_id,officeId);assert.equal(changes.data[0].new_owner_person_id,officeBId);
    const taskChanges=await actors.admin.db.from('task_assignment_changes').select('*').eq('task_id',openWork.task.id);
    assert.ifError(taskChanges.error);assert.equal(taskChanges.data.length,1);
    assert.ok([403,404].includes((await json(`/api/onboarding/${permanentCase}`,'office'))[0]));
    assert.equal((await json(`/api/onboarding/${permanentCase}`,'officeB'))[0],200);
    assert.ok([403,404].includes((await json(`/api/documents/${openWork.requestId}`,'office'))[0]));
    assert.equal((await json(`/api/documents/${openWork.requestId}`,'officeB'))[0],200);
    const [reviewBStatus]=await json(`/api/documents/${openWork.requestId}/reviews`,'officeB',post({
      versionId:openWork.versionId,decision:'ACCEPTED_AS_EVIDENCE'}));assert.equal(reviewBStatus,201);
    const rtw=(await caseAt(permanentCase,'officeB')).requirements.find((item)=>item.code==='RIGHT_TO_WORK');
    assert.equal(rtw.state,'UNDER_REVIEW');
    assert.equal((await json(`/api/onboarding/${permanentCase}/verify`,'officeB',post({
      requirementId:rtw.id,versionId:openWork.versionId})))[0],200);
    assert.equal((await caseAt(permanentCase,'officeB')).requirements.find((item)=>item.code==='RIGHT_TO_WORK').state,'VERIFIED');
    const cancelledCase=await createCase();const cancelledWork=await issueAndSubmit(cancelledCase);
    assert.equal((await request(`/api/onboarding/${cancelledCase}/cancel`,'office',{method:'POST'})).status,200);
    const cancelled=(await actors.admin.db.from('tasks').select('state,cancellation_case_id,cancellation_reason,completion_event_id')
      .eq('id',cancelledWork.task.id).single());assert.ifError(cancelled.error);
    assert.equal(cancelled.data.state,'CANCELLED');assert.equal(cancelled.data.cancellation_case_id,cancelledCase);
    assert.equal(cancelled.data.cancellation_reason,'ONBOARDING_CASE_CANCELLED');assert.equal(cancelled.data.completion_event_id,null);
    assert.ok(!(await json('/api/tasks','office'))[1].tasks.some((task)=>task.id===cancelledWork.task.id&&task.state==='OPEN'));
    assert.ok((await queue('office','CANCELLED'))[1].rows.some((row)=>row.id===cancelledCase));
    assert.ok(!(await queue('office','TEAM_QUEUE'))[1].rows.some((row)=>row.id===cancelledCase));
    assert.ok((await actors.office.db.from('tasks').update({state:'DONE'}).eq('id',cancelledWork.task.id)).error);
    assert.ok((await actors.office.db.from('onboarding_case_owner_changes').delete().eq('case_id',permanentCase)).error);
    assert.ok((await actors.office.db.from('audit_events').insert({entity_type:'onboarding_owner_change',
      entity_id:move.changeId,affected_person_id:staffId,action:'INSERT'})).error);
    assert.equal((await caseAt(acceptedCase,'office'))?.verifiedCount,acceptedBefore);
    assert.equal((await caseAt(acceptedCase,'staff'))?.verifiedCount,acceptedBefore);
    for(const as of ['staffB','operations']){
      assert.ok([403,404].includes((await json(`/api/onboarding/${permanentCase}`,as))[0]));
      assert.ok([403,404].includes((await json(`/api/documents/${openWork.requestId}`,as))[0]));
    }
  }finally{
    if(membershipId) await actors.admin.db.rpc('revoke_onboarding_team_member',{requested_membership:membershipId});
    server.kill();await once(server,'exit').catch(()=>{});
  }
});
