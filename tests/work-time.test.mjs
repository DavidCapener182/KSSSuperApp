import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const credentials={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD]};
const person={office:'10000000-0000-4000-8000-000000000002',staffA:'10000000-0000-4000-8000-000000000003',staffB:'10000000-0000-4000-8000-000000000004'};
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await signInWithTestSession(client,{email:credentials[name][0],password:credentials[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}
const instant=(ms)=>new Date(ms).toISOString();

test('TASK-10B Event worked-time proposal, pinned evidence, return/correction, approval and boundaries',{timeout:240000},async()=>{
 assert.ok(url&&key&&Object.values(credentials).every(x=>x[0]&&x[1]));
 const [admin,office,operations,staffA,staffB]=await Promise.all(Object.keys(credentials).map(signed));
 const stamp=Date.now(),day=`${2040+Math.floor(Math.random()*8)}-08-12`;
 const created={allocations:[],roles:[],grants:[]};let event;
 try{
  const organisation=await rpc(office,'crm_create_organisation',{p_name:`10B Synthetic Client ${stamp}`});
  const opportunity=await rpc(office,'crm_create_opportunity',{p_organisation:organisation,p_title:'10B Event worked time',p_type:'DIRECT_ENQUIRY',p_owner:person.office});
  await rpc(office,'crm_transition_opportunity',{p_id:opportunity,p_stage:'WON'});
  const site=await office.from('sites').insert({site_reference:`DEV-10B-${stamp}`,name:'10B Synthetic Site',address_line1:'1 Synthetic Road',town_city:'Example',postcode:'EX1 1AA',reporting_point:'North Gate',created_by_person_id:person.office,site_type:'STADIUM'}).select('id').single();assert.ifError(site.error);
  assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site.data.id)).error);
  await rpc(office,'operational_link_site',{p_site:site.data.id,p_organisation:organisation});
  const end=new Date(Date.parse(`${day}T00:00:00Z`)+6*86400000).toISOString();
  event=await rpc(office,'operational_create_event',{p_site:site.data.id,p_organisation:organisation,p_name:'10B Synthetic Event',p_type:'CONCERT',p_starts:`${day}T00:00:00Z`,p_ends:end,p_owner:person.office});
  const roles=await rpc(office,'staffing_role_choices',{}),role=roles.find(item=>item.code==='STEWARD').id;
  async function allocation(staffPerson,offset){
   const date=new Date(Date.parse(`${day}T00:00:00Z`)+offset*86400000).toISOString().slice(0,10);
   const requirement=await rpc(office,'staffing_create_confirmed',{p_event:event,p_role:role,p_quantity:1,p_report:`${date}T12:00:00Z`,p_start:`${date}T13:00:00Z`,p_end:`${date}T19:00:00Z`,p_area:`10B ${offset}`,p_instructions:'Synthetic test allocation',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
   const id=await rpc(operations,'deployment_allocate',{p_event:event,p_requirement:requirement,p_person:staffPerson,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic TASK-10B proof'});
   await rpc(staffPerson===person.staffA?staffA:staffB,'deployment_respond',{p_allocation:id,p_expected_revision:1,p_response:'ACCEPTED'});
   created.allocations.push({id,requirement,staffPerson});return id;
  }
  const allocationA=await allocation(person.staffA,0),allocationB=await allocation(person.staffB,1);
  const actualIn=instant(Date.now()-2*3600000),actualOut=instant(Date.now()-3600000);
  const checkIn=await rpc(staffA,'attendance_self_action',{p_allocation:allocationA,p_action:'CHECK_IN',p_actual_at:actualIn,p_expected_case_revision:0,p_idempotency_key:crypto.randomUUID()});
  const checkOut=await rpc(staffA,'attendance_self_action',{p_allocation:allocationA,p_action:'CHECK_OUT',p_actual_at:actualOut,p_expected_case_revision:1,p_idempotency_key:crypto.randomUUID()});
  assert.equal(Date.parse(checkIn.attendance.check_in_at),Date.parse(actualIn));assert.equal(Date.parse(checkOut.attendance.check_out_at),Date.parse(actualOut));

  assert.ok((await staffA.from('event_work_time_cases').select('*')).error,'Staff cannot directly read work-time cases');
  assert.ok((await staffA.from('event_work_time_revisions').insert({case_id:crypto.randomUUID(),revision:1,kind:'DRAFT'})).error,'direct revision writes are denied');
  assert.deepEqual((await rpc(staffB,'event_work_time_self_read',{p_allocation:allocationA})).items,[],'peer allocation focus returns no Staff record');
  assert.ok((await staffB.rpc('event_work_time_self_action',{p_allocation:allocationA,p_action:'SAVE_DRAFT',p_expected_revision:0,p_segments:[{kind:'WORK',startAt:`${day}T12:00:00Z`,endAt:`${day}T13:00:00Z`}],p_idempotency_key:crypto.randomUUID()})).error,'peer cannot create a draft by guessed allocation ID');
  for(const client of [admin,office,operations]) assert.ok((await client.rpc('event_work_time_manager_read',{p_event:event})).error,'broad roles alone do not grant work-time review');

  const segments=[
   {kind:'WORK',startAt:`${day}T12:00:00Z`,endAt:`${day}T15:00:00Z`},
   {kind:'BREAK',startAt:`${day}T15:00:00Z`,endAt:`${day}T15:30:00Z`},
   {kind:'WORK',startAt:`${day}T15:30:00Z`,endAt:`${day}T18:30:00Z`},
  ];
  const saveKey=crypto.randomUUID(),saveArgs={p_allocation:allocationA,p_action:'SAVE_DRAFT',p_expected_revision:0,p_segments:segments,p_idempotency_key:saveKey};
  const [draftA,draftReplay]=await Promise.all([rpc(staffA,'event_work_time_self_action',saveArgs),rpc(staffA,'event_work_time_self_action',saveArgs)]);
  assert.equal(draftA.revision,1);assert.equal(draftA.proposed_work_minutes,360,'only explicit WORK intervals count; breaks are not automatically deducted');
  assert.deepEqual(draftReplay,draftA,'concurrent duplicate retries return the original result');
  assert.ok((await staffA.rpc('event_work_time_self_action',{...saveArgs,p_segments:[{kind:'WORK',startAt:`${day}T11:00:00Z`,endAt:`${day}T12:00:00Z`}]})).error,'changed payload reuse of an idempotency key is rejected');
  assert.ok((await staffA.rpc('event_work_time_self_action',{...saveArgs,p_idempotency_key:crypto.randomUUID()})).error,'stale draft revision is rejected');

  const draftRead=(await rpc(staffA,'event_work_time_self_read',{p_allocation:allocationA})).items[0];
  assert.equal(draftRead.status,'DRAFT');assert.equal(draftRead.revisions[0].segments.length,3);
  assert.ok(draftRead.revisions[0].segments.every(segment=>!['CHECK_IN','CHECK_OUT'].includes(segment.type)),'attendance did not create worked intervals');
  const submitKey=crypto.randomUUID(),submitArgs={p_allocation:allocationA,p_action:'SUBMIT',p_expected_revision:1,p_segments:null,p_idempotency_key:submitKey};
  const submitted=await rpc(staffA,'event_work_time_self_action',submitArgs),submittedReplay=await rpc(staffA,'event_work_time_self_action',submitArgs);
  assert.equal(submitted.revision,2);assert.equal(submitted.evidence_status,'COMPLETE');assert.deepEqual(submittedReplay,submitted);
  const pinned=(await rpc(operations,'attendance_event_overview',{p_event:event,p_offset:0,p_limit:100})).items.find(row=>row.allocation_id===allocationA).attendance.events;

  const missingSegments=[{kind:'WORK',startAt:`${day}T12:00:00Z`,endAt:`${day}T14:00:00Z`}];
  const missingDraft=await rpc(staffB,'event_work_time_self_action',{p_allocation:allocationB,p_action:'SAVE_DRAFT',p_expected_revision:0,p_segments:missingSegments,p_idempotency_key:crypto.randomUUID()});
  const missingSubmit=await rpc(staffB,'event_work_time_self_action',{p_allocation:allocationB,p_action:'SUBMIT',p_expected_revision:missingDraft.revision,p_segments:null,p_idempotency_key:crypto.randomUUID()});
  assert.equal(missingSubmit.evidence_status,'MISSING','Staff can submit without attendance, with an explicit warning status');

  const from=instant(Date.now()-60000),until=instant(Date.now()+3600000);
  async function grant(target,capability){const result=await rpc(admin,'event_work_time_grant',{p_event:event,p_person:target,p_capability:capability,p_effective_from:from,p_effective_until:until,p_reason:'Synthetic Event-scoped TASK-10B test grant',p_idempotency_key:crypto.randomUUID()});created.grants.push(result);return result;}
  const reviewGrant=await grant(person.office,'WORK_TIME_REVIEW'),approveGrant=await grant('10000000-0000-4000-8000-000000000007','WORK_TIME_APPROVE');
  assert.ok(reviewGrant&&approveGrant);
  const adminData=await rpc(admin,'event_work_time_grants_admin',{p_event:event});assert.equal(adminData.grants.length,2);
  const officeQueue=await rpc(office,'event_work_time_manager_read',{p_event:event});assert.equal(officeQueue.items.length,2);
  const submittedRow=officeQueue.items.find(row=>row.case_id===submitted.case_id);assert.ok(submittedRow);
  const pinnedRevision=submittedRow.revisions.find(revision=>revision.revision===2);
  assert.deepEqual(pinnedRevision.evidence.map(item=>item.event_id),pinned.map(item=>item.id),'submission pins the exact 09A evidence IDs');
  assert.ok(pinnedRevision.evidence.every(item=>item.observed_case_revision===2),'the exact observed 09A case revision is pinned');
  assert.ok((await office.rpc('event_work_time_manager_action',{p_event:event,p_case:submitted.case_id,p_action:'APPROVE',p_expected_revision:2,p_reason:null,p_idempotency_key:crypto.randomUUID()})).error,'review grant does not imply approval');

  const correctedAttendance=await rpc(operations,'attendance_manager_correct',{p_allocation:allocationA,p_target_event:pinned[0].id,p_correction:'CORRECT_TIMESTAMP',p_corrected_actual_at:instant(Date.parse(actualIn)+60000),p_reason:'Synthetic attendance correction after submission',p_expected_case_revision:2,p_idempotency_key:crypto.randomUUID()});
  assert.ok(correctedAttendance.attendance.events.some(item=>item.type==='CORRECTION'));
  const flagged=await rpc(office,'event_work_time_manager_read',{p_event:event});
  const flaggedCase=flagged.items.find(row=>row.case_id===submitted.case_id);assert.equal(flaggedCase.status,'REVIEW_REQUIRED');
  assert.equal(flaggedCase.revisions.find(revision=>revision.revision===2).proposed_work_minutes,360,'later attendance correction did not rewrite submitted minutes');
  assert.deepEqual(flaggedCase.revisions.find(revision=>revision.revision===2).evidence.map(item=>item.event_id),pinned.map(item=>item.id),'pinned evidence remains the original snapshot');

  const returnKey=crypto.randomUUID(),returnArgs={p_event:event,p_case:submitted.case_id,p_action:'RETURN',p_expected_revision:2,p_reason:'Please check the evidence and confirm the corrected time proposal.',p_idempotency_key:returnKey};
  const returned=await rpc(office,'event_work_time_manager_action',returnArgs);assert.equal(returned.status,'RETURNED');
  const revisedSegments=[{kind:'WORK',startAt:`${day}T12:15:00Z`,endAt:`${day}T15:00:00Z`},{kind:'BREAK',startAt:`${day}T15:00:00Z`,endAt:`${day}T15:30:00Z`},{kind:'WORK',startAt:`${day}T15:30:00Z`,endAt:`${day}T18:15:00Z`}];
  const correctionDraft=await rpc(staffA,'event_work_time_self_action',{p_allocation:allocationA,p_action:'SAVE_DRAFT',p_expected_revision:2,p_segments:revisedSegments,p_idempotency_key:crypto.randomUUID()});
  assert.equal(correctionDraft.revision,3);assert.equal(correctionDraft.proposed_work_minutes,330);
  const resubmitted=await rpc(staffA,'event_work_time_self_action',{p_allocation:allocationA,p_action:'SUBMIT',p_expected_revision:3,p_segments:null,p_idempotency_key:crypto.randomUUID()});
  assert.equal(resubmitted.revision,4);assert.equal(resubmitted.evidence_status,'COMPLETE');
  const latestReviewGrant=await grant(person.staffA,'WORK_TIME_APPROVE');
  const temporaryRole=await admin.from('role_assignments').insert({person_id:person.staffA,role_code:'OFFICE_ADMIN',effective_from:from,effective_until:until,granted_by:person.office}).select('id').single();assert.ifError(temporaryRole.error);created.roles.push(temporaryRole.data.id);
  assert.ok((await staffA.rpc('event_work_time_manager_action',{p_event:event,p_case:submitted.case_id,p_action:'APPROVE',p_expected_revision:4,p_reason:null,p_idempotency_key:crypto.randomUUID()})).error,'dual-role submitter cannot approve their own revision even with an explicit approval grant');
  assert.ok(latestReviewGrant);
  const approved=await rpc(operations,'event_work_time_manager_action',{p_event:event,p_case:submitted.case_id,p_action:'APPROVE',p_expected_revision:4,p_reason:null,p_idempotency_key:crypto.randomUUID()});
  assert.equal(approved.status,'APPROVED');
  await rpc(admin,'event_work_time_grant_revoke',{p_grant:approveGrant,p_reason:'Synthetic grant revocation proof',p_idempotency_key:crypto.randomUUID()});
  assert.ok((await operations.rpc('event_work_time_manager_read',{p_event:event})).error,'revoked Event grant immediately removes manager read');

  const history=await rpc(office,'event_work_time_manager_read',{p_event:event});
  const finalCase=history.items.find(row=>row.case_id===submitted.case_id);assert.equal(finalCase.status,'APPROVED');
  assert.equal(finalCase.revisions.length,4);assert.equal(finalCase.revisions.find(revision=>revision.revision===2).proposed_work_minutes,360,'submitted revision remains immutable after correction');
  assert.ok(finalCase.history.some(row=>row.kind==='RETURNED')&&finalCase.history.some(row=>row.kind==='WORKED_TIME_APPROVED'),'append-only history preserves the return and approval');
  assert.equal(Object.keys(finalCase).some(key=>/pay|charge|money|rate|payroll|invoice/i.test(key)),false,'manager projection contains no finance fields');

  const cancelAllocation=await rpc(operations,'deployment_cancel',{p_event:event,p_requirement:created.allocations.find(row=>row.id===allocationA).requirement,p_allocation:allocationA,p_expected_revision:2,p_reason:'Synthetic source-change review proof'});
  assert.equal(cancelAllocation,3);
  const afterSourceChange=await rpc(office,'event_work_time_manager_read',{p_event:event});
  const reviewRequired=afterSourceChange.items.find(row=>row.case_id===submitted.case_id);assert.equal(reviewRequired.status,'REVIEW_REQUIRED');
  assert.equal(reviewRequired.revisions.find(revision=>revision.revision===4).proposed_work_minutes,330,'allocation cancellation flags but does not rewrite the approved revision');
  assert.ok((await office.rpc('event_work_time_manager_action',{p_event:event,p_case:submitted.case_id,p_action:'RETURN',p_expected_revision:4,p_reason:'Try to reopen',p_idempotency_key:crypto.randomUUID()})).error,'an approved revision is not silently reopened after source change');
  const peerFocus=await rpc(staffB,'event_work_time_self_read',{p_allocation:allocationA});assert.deepEqual(peerFocus.items,[]);
 } finally {
  if(created.roles.length) await admin.from('role_assignments').update({revoked_at:instant(Date.now())}).in('id',created.roles);
  for(const row of created.allocations){
   const actor=row.staffPerson===person.staffA?staffA:staffB;
   try{await rpc(operations,'deployment_cancel',{p_event:event,p_requirement:row.requirement,p_allocation:row.id,p_expected_revision:2,p_reason:'Synthetic TASK-10B test cleanup'});}catch{}
   void actor;
  }
  if(event) try{await rpc(office,'operational_change_event',{p_event:event,p_action:'STATUS',p_status:'CANCELLED',p_reason:'Synthetic TASK-10B test complete'});}catch{}
 }
});
