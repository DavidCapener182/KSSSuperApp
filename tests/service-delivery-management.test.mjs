import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const credentials={
 admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 officeB:[process.env.KSS_TEST_OFFICE_B_EMAIL,process.env.KSS_TEST_OFFICE_B_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
};
const people={office:'10000000-0000-4000-8000-000000000002',officeB:'10000000-0000-4000-8000-000000000006'};
const uuid=()=>crypto.randomUUID();
const plus=(date,days)=>new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
async function signed(role){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await signInWithTestSession(c,{email:credentials[role][0],password:credentials[role][1]});assert.ifError(error);return c;}
async function rpc(c,name,args){const {data,error}=await c.rpc(name,args);assert.ifError(error);return data;}
const command=(client,delivery,entity,kind,data={},subject=null,expected=null,key=uuid())=>client.rpc('service_management_command',{p_delivery:delivery,p_entity:entity,p_kind:kind,p_subject:subject,p_data:data,p_expected:expected,p_key:key});

test('TASK-21D synthetic management commitments and exact Site Service change control', {timeout:240000}, async()=>{
 assert.ok(url?.includes('dnfhkmmnlbiabqypclqg')&&key&&Object.values(credentials).every(([a,b])=>a&&b),'literal synthetic Dev only');
 const [admin,office,officeB,ops,staff]=await Promise.all(Object.keys(credentials).map(signed));
 const choices=await rpc(office,'service_delivery_choices',{});
 const seed=choices.services.find(s=>s.state==='ACTIVE' || s.state==='PAUSED');assert.ok(seed,'an active synthetic Client/Site source is needed');
 const foreign=choices.services.find(s=>s.organisationId!==seed.organisationId);assert.ok(foreign,'a distinct synthetic Client source is needed for substitution proof');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const future=plus(today,60),next=plus(future,2),until=new Date(Date.now()+90*86400000).toISOString();
 const service=await rpc(office,'site_service_create',{p_site:seed.siteId,p_name:`21D synthetic change source ${Date.now()}`,p_type:'STATIC_GUARDING',p_effective_from:today,p_owner:people.office});
 await rpc(office,'site_service_transition',{p_service:service,p_state:'ACTIVE',p_effective_on:today,p_expected_revision:1,p_reason:'Synthetic initial Site Service activation'});
 const refreshed=(await rpc(office,'service_delivery_choices',{})).services.find(s=>s.id===service);assert.ok(refreshed);
 const delivery=(await rpc(office,'service_delivery_start',{p_service:service,p_link:refreshed.linkId,p_source:'LEGACY_EXISTING',p_mobilisation:null,p_decision:null,p_owner:people.office,p_super_oversight:false,p_reason_code:'LEGACY_EXISTING_SERVICE',p_explanation:'Synthetic 21D existing Site Service start with exact source.',p_key:uuid()})).id;
 const deliveryRevision=(await rpc(office,'service_delivery_detail',{p_id:delivery})).revision;
 const start=await rpc(office,'service_management_detail',{p_delivery:delivery});assert.equal(start.sourceRevision,2);assert.equal(start.operationalDocumentTargetAvailable,false);
 assert.ok((await office.from('service_commitments').select('id')).error,'direct table read denied');
 assert.ok((await office.from('service_change_requests').insert({id:uuid()})).error,'direct table write denied');
 assert.ok((await ops.rpc('service_management_detail',{p_delivery:delivery})).error,'Operations management denied');
 assert.ok((await staff.rpc('service_management_detail',{p_delivery:delivery})).error,'Staff management denied');
 assert.ok((await office.rpc('service_change_grants_admin',{p_delivery:delivery})).error,'Office cannot administer grants');
 assert.ok((await admin.rpc('service_management_detail',{p_delivery:uuid()})).error,'guessed ID denied');

 const makeCommitment=async(description)=>rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'COMMITMENT',p_kind:'CREATE',p_subject:null,p_data:{category:'REPORTING',description,ownerId:people.office,appliesFrom:today},p_expected:deliveryRevision,p_key:uuid()});
 const first=await makeCommitment('Synthetic monthly management reporting proposal');
 assert.equal(first.state,'PROPOSED_UNVERIFIED');
 assert.ok((await command(office,delivery,'COMMITMENT','CREATE',{category:'REPORTING',description:'Stale synthetic proposal',ownerId:people.office,appliesFrom:today},null,deliveryRevision+1)).error,'stale parent creation revision denied');
 assert.ok((await command(office,delivery,'COMMITMENT','CONFIRMED_SOURCE_BOUND',{},first.id,first.revision)).error,'no confirmation operation');
 const moved=await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'COMMITMENT',p_kind:'OWNER_REASSIGNED',p_subject:first.id,p_data:{ownerId:people.officeB,reason:'Synthetic accountability transfer'},p_expected:first.revision,p_key:uuid()});
 assert.equal(moved.revision,2);
 const ended=await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'COMMITMENT',p_kind:'ENDED',p_subject:first.id,p_data:{endedOn:today,reason:'Synthetic proposal has ended'},p_expected:moved.revision,p_key:uuid()});
 assert.equal(ended.state,'ENDED');
 const second=await makeCommitment('Synthetic equipment commitment for withdrawal');
 assert.equal((await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'COMMITMENT',p_kind:'WITHDRAWN',p_subject:second.id,p_data:{reason:'Synthetic proposal withdrawn'},p_expected:second.revision,p_key:uuid()})).state,'WITHDRAWN');

 const proposalGrant=await rpc(admin,'service_change_grant_command',{p_delivery:delivery,p_grant:null,p_person:people.office,p_capability:'SERVICE_CHANGE_PROPOSER',p_until:until,p_reason:'Synthetic proposal authority',p_key:uuid()});
 const approvalGrant=await rpc(admin,'service_change_grant_command',{p_delivery:delivery,p_grant:null,p_person:people.officeB,p_capability:'SERVICE_CHANGE_APPROVER',p_until:until,p_reason:'Synthetic independent approval authority',p_key:uuid()});
 const selfApprovalGrant=await rpc(admin,'service_change_grant_command',{p_delivery:delivery,p_grant:null,p_person:people.office,p_capability:'SERVICE_CHANGE_APPROVER',p_until:until,p_reason:'Synthetic dual role authority',p_key:uuid()});
 const recorderGrant=await rpc(admin,'service_change_grant_command',{p_delivery:delivery,p_grant:null,p_person:people.office,p_capability:'SERVICE_CHANGE_RECORDER',p_until:until,p_reason:'Synthetic application recorder authority',p_key:uuid()});
 assert.ok(proposalGrant.id&&approvalGrant.id&&selfApprovalGrant.id&&recorderGrant.id);
 const base=await rpc(office,'service_management_detail',{p_delivery:delivery});
 const proposal={targetDomain:'SITE_SERVICE',targetId:service,baselineRevision:base.sourceRevision,baselineEventId:base.sourceEventId,summary:'Pause the synthetic Site Service on the requested date',reason:'Synthetic management change request',ownerId:people.office,requestedEffectiveLocal:`${future}T12:00`};
 assert.ok((await command(admin,delivery,'CHANGE','PROPOSE',proposal,null,base.sourceRevision)).error,'Super role alone cannot propose');
 assert.ok((await command(ops,delivery,'CHANGE','PROPOSE',proposal,null,base.sourceRevision)).error,'Operations cannot propose');
 assert.ok((await command(office,delivery,'CHANGE','PROPOSE',{...proposal,targetId:uuid()},null,base.sourceRevision)).error,'cross-source substitution denied');
 assert.ok((await command(office,delivery,'CHANGE','PROPOSE',{...proposal,targetId:foreign.id},null,base.sourceRevision)).error,'existing cross-Client source substitution denied');
 assert.ok((await command(office,delivery,'CHANGE','PROPOSE',{...proposal,targetDomain:'EVENT'},null,base.sourceRevision)).error,'Event target deferred');
 assert.ok((await command(office,delivery,'CHANGE','PROPOSE',{...proposal,targetDomain:'OPERATIONAL_DOCUMENT'},null,base.sourceRevision)).error,'19A target disabled');
 assert.ok((await command(office,delivery,'CHANGE','PROPOSE',proposal,null,base.sourceRevision+1)).error,'stale creation revision denied');
 const proposeKey=uuid();const proposed=await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'PROPOSE',p_subject:null,p_data:proposal,p_expected:base.sourceRevision,p_key:proposeKey});
 assert.deepEqual(await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'PROPOSE',p_subject:null,p_data:proposal,p_expected:base.sourceRevision,p_key:proposeKey}),proposed,'identical lost response retry');
 assert.ok((await command(office,delivery,'CHANGE','PROPOSE',{...proposal,summary:'Changed replay'},null,base.sourceRevision,proposeKey)).error,'changed payload replay rejected');
 assert.ok((await command(office,delivery,'CHANGE','APPROVED',{reason:'Self approval attempt'},proposed.id,proposed.revision)).error,'dual-granted proposer cannot self-approve');
 assert.ok((await command(admin,delivery,'CHANGE','APPROVED',{reason:'Role-only approval attempt'},proposed.id,proposed.revision)).error,'Super role-only approval denied');
 const inReview=await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'UNDER_REVIEW',p_subject:proposed.id,p_data:{reason:'Synthetic independent review requested'},p_expected:proposed.revision,p_key:uuid()});
 const decisions=await Promise.all([command(officeB,delivery,'CHANGE','APPROVED',{reason:'Independent synthetic management approval'},proposed.id,inReview.revision),command(officeB,delivery,'CHANGE','REJECTED',{reason:'Conflicting decision must lose'},proposed.id,inReview.revision)]);
 assert.equal(decisions.filter(x=>!x.error).length,1,'one decision wins transactionally');
 const decided=await rpc(office,'service_management_detail',{p_delivery:delivery});
 const decision=decided.changes.find(c=>c.id===proposed.id);assert.ok(decision);
 const toReject=await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'PROPOSE',p_subject:null,p_data:{...proposal,summary:'Reject separate synthetic proposed reporting-point change'},p_expected:base.sourceRevision,p_key:uuid()});
 assert.equal((await rpc(officeB,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'REJECTED',p_subject:toReject.id,p_data:{reason:'Independent synthetic rejection'},p_expected:toReject.revision,p_key:uuid()})).state,'REJECTED');
 const toWithdraw=await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'PROPOSE',p_subject:null,p_data:{...proposal,summary:'Withdraw separate synthetic proposed service configuration'},p_expected:base.sourceRevision,p_key:uuid()});
 assert.equal((await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'WITHDRAWN',p_subject:toWithdraw.id,p_data:{reason:'Synthetic proposal withdrawn'},p_expected:toWithdraw.revision,p_key:uuid()})).state,'WITHDRAWN');
 const notApplied=await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'PROPOSE',p_subject:null,p_data:{...proposal,summary:'Approve but do not apply a separate synthetic change'},p_expected:base.sourceRevision,p_key:uuid()});
 const notAppliedApproval=await rpc(officeB,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'APPROVED',p_subject:notApplied.id,p_data:{reason:'Independent synthetic approval without application'},p_expected:notApplied.revision,p_key:uuid()});
 assert.equal((await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'NOT_APPLIED',p_subject:notApplied.id,p_data:{reason:'Synthetic source work did not take place'},p_expected:notAppliedApproval.revision,p_key:uuid()})).applicationOutcome,'NOT_APPLIED');
 if(decision.state==='REJECTED') {
  // A separate proposal supplies the approved journey when the rejection wins the race.
  const alternate=await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'PROPOSE',p_subject:null,p_data:{...proposal,summary:'Pause the synthetic Site Service after separate approval'},p_expected:base.sourceRevision,p_key:uuid()});
  const approved=await rpc(officeB,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'APPROVED',p_subject:alternate.id,p_data:{reason:'Independent synthetic management approval'},p_expected:alternate.revision,p_key:uuid()});
  await applicationJourney(approved.id,approved.revision);
 } else await applicationJourney(decision.id,decision.revision);

 async function applicationJourney(changeId,revision){
  const pending=await rpc(office,'service_management_detail',{p_delivery:delivery});
  assert.equal(pending.changes.find(c=>c.id===changeId).applicationOutcome,null,'approved remains awaiting source application');
  assert.equal(pending.sourceRevision,2,'approval did not mutate source');
  assert.ok((await command(office,delivery,'CHANGE','APPLIED',{sourceEventId:uuid(),reason:'Forged application'},changeId,revision)).error,'unverified event denied');
  await rpc(office,'site_service_transition',{p_service:service,p_state:'PAUSED',p_effective_on:future,p_expected_revision:2,p_reason:'Independently guarded synthetic source transition',p_resume_on:plus(future,2)});
  const source=await rpc(office,'service_management_detail',{p_delivery:delivery});
  assert.equal(source.sourceRevision,3);
  assert.ok((await command(officeB,delivery,'CHANGE','APPLIED',{sourceEventId:source.sourceEventId,reason:'Recorder grant absent'},changeId,revision)).error);
  await rpc(admin,'service_change_grant_command',{p_delivery:delivery,p_grant:recorderGrant.id,p_person:null,p_capability:null,p_until:null,p_reason:'Synthetic recorder revocation proof',p_key:uuid()});
  assert.ok((await command(office,delivery,'CHANGE','APPLIED',{sourceEventId:source.sourceEventId,reason:'Revoked recorder denied'},changeId,revision)).error);
  await rpc(admin,'service_change_grant_command',{p_delivery:delivery,p_grant:null,p_person:people.office,p_capability:'SERVICE_CHANGE_RECORDER',p_until:until,p_reason:'Synthetic recorder regrant',p_key:uuid()});
  const applied=await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'APPLIED',p_subject:changeId,p_data:{sourceEventId:source.sourceEventId,reason:'Verified exact source event and revision'},p_expected:revision,p_key:uuid()});
  assert.equal(applied.applicationOutcome,'APPLIED');
  const stale=await rpc(office,'service_management_command',{p_delivery:delivery,p_entity:'CHANGE',p_kind:'PROPOSE',p_subject:null,p_data:{...proposal,baselineRevision:3,baselineEventId:source.sourceEventId,summary:'Synthetic stale baseline decision must fail'},p_expected:3,p_key:uuid()});
  await rpc(office,'site_service_transition',{p_service:service,p_state:'ACTIVE',p_effective_on:next,p_expected_revision:3,p_reason:'Later independent synthetic source transition'});
  const later=await rpc(office,'service_management_detail',{p_delivery:delivery});
  assert.equal(later.changes.find(c=>c.id===changeId).sourceChangedSinceApplication,true);
  assert.equal(later.changes.find(c=>c.id===changeId).applicationRevision,3,'old exact application link preserved');
  assert.ok((await command(officeB,delivery,'CHANGE','APPROVED',{reason:'Stale source decision denied'},stale.id,stale.revision)).error,'source drift blocks decision');
 }
 const end=await rpc(office,'service_management_detail',{p_delivery:delivery});
 assert.equal(end.commitments.find(c=>c.id===first.id).history.length,3);
 assert.equal(end.changes.find(c=>c.id===proposed.id).history[0].kind,'PROPOSED');
 assert.ok((await office.from('service_change_history').update({kind:'REJECTED'}).eq('change_id',proposed.id)).error,'history cannot be rewritten');
 assert.ok((await ops.rpc('service_management_detail',{p_delivery:delivery})).error);
 assert.ok((await staff.rpc('service_management_detail',{p_delivery:delivery})).error);
});
