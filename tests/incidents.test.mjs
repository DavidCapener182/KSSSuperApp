import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const credentials={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD]};
const people={operations:'10000000-0000-4000-8000-000000000007',staffA:'10000000-0000-4000-8000-000000000003',staffB:'10000000-0000-4000-8000-000000000004'};
async function signed(name){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await signInWithTestSession(c,{email:credentials[name][0],password:credentials[name][1]});assert.ifError(error);return c;}
async function rpc(c,n,a={}){const {data,error}=await c.rpc(n,a);assert.ifError(error,`${n} failed`);return data;}
const report=(key,narrative,extra={})=>({p_idempotency_key:key,p_occurred_at:new Date(Date.now()-60000).toISOString(),p_category:'SAFETY_HAZARD',p_narrative:narrative,...extra});

test('TASK-12A Incident grants, ownership, lifecycle, immutable corrections and idempotency',{timeout:180000},async()=>{
 assert.ok(url&&key&&Object.values(credentials).every(x=>x[0]&&x[1]));
 const [admin,office,ops,staffA,staffB]=await Promise.all(Object.keys(credentials).map(signed));
 const adminRows=await rpc(admin,'incident_reviewer_grants_list');
 const opsRow=adminRows.find(x=>x.personId===people.operations);assert.ok(opsRow,'Operations test fixture is listed for grant management');
 const hadGrant=Boolean(opsRow.grant&&!opsRow.grant.revokedAt&&opsRow.grant.active);let grantId=null;
 if(!hadGrant){assert.equal(await rpc(ops,'incident_current_access'),false,'Operations role alone has no Incident authority');assert.ok((await ops.rpc('incident_review_queue',{p_offset:0,p_limit:25,p_include_closed:false})).error,'ungranted Operations cannot access queue');grantId=await rpc(admin,'incident_reviewer_grant',{p_reviewer:people.operations,p_last_active_date:new Date(Date.now()+14*86400000).toISOString().slice(0,10),p_reason:'Synthetic TASK-12A authority test'});}
 try{
  if(!hadGrant) assert.equal(await rpc(ops,'incident_current_access'),true,'reviewer sees authority after explicit grant');
  assert.ok((await office.rpc('incident_review_queue',{p_offset:0,p_limit:25,p_include_closed:false})).error,'Office role alone cannot list queue');
  assert.ok((await staffA.rpc('incident_review_queue',{p_offset:0,p_limit:25,p_include_closed:false})).error,'Staff cannot list the operational queue');
  assert.ok((await office.rpc('incident_reviewer_grant',{p_reviewer:people.operations,p_last_active_date:new Date(Date.now()+7*86400000).toISOString().slice(0,10),p_reason:'Unauthorised grant attempt'})).error,'Office cannot manage reviewer grants');
  assert.ok((await ops.from('incidents').select('*')).error,'direct incident table reads are denied');
  assert.ok((await staffA.from('incident_events').insert({incident_id:crypto.randomUUID(),revision:2,kind:'ACKNOWLEDGED',new_status:'ACKNOWLEDGED',actor_person_id:people.staffA})).error,'direct event writes are denied');
  const keyA=crypto.randomUUID(),original='Synthetic report: damaged entrance barrier at north gate.',submitPayload=report(keyA,original);
  const created=await rpc(staffA,'incident_submit',submitPayload);assert.equal(created.replayed,false);
  const retry=await rpc(staffA,'incident_submit',submitPayload);assert.equal(retry.incidentId,created.incidentId);assert.equal(retry.replayed,true);
  assert.equal((await rpc(staffA,'incident_submit_result',{p_idempotency_key:keyA})).incidentId,created.incidentId,'reporter can resolve an ambiguous submission response');
  assert.ok((await staffA.rpc('incident_submit',report(keyA,original+' altered'))).error,'changed payload cannot reuse a key');
  const concurrentKey=crypto.randomUUID(),concurrentPayload=report(concurrentKey,'Synthetic concurrent retry: one report should be created.');
  const concurrentSubmits=await Promise.all([staffA.rpc('incident_submit',concurrentPayload),staffA.rpc('incident_submit',concurrentPayload)]);assert.ok(concurrentSubmits.every(x=>!x.error));assert.equal(concurrentSubmits[0].data.incidentId,concurrentSubmits[1].data.incidentId,'concurrent idempotent submissions resolve to one Incident');
  assert.equal((await rpc(staffA,'incident_detail',{p_incident:concurrentSubmits[0].data.incidentId})).events.length,1,'concurrent retry creates only one report event');
  const other=await rpc(staffA,'incident_submit',report(crypto.randomUUID(),'Synthetic second report: loose cable beside service desk.'));
  const choices=await rpc(staffA,'incident_context_choices');
  const link=choices.find(x=>x.kind==='EVENT_ALLOCATION')??choices.find(x=>x.kind==='SITE_SHIFT_ALLOCATION')??choices.find(x=>x.kind==='EVENT')??choices.find(x=>x.kind==='SITE_SERVICE')??choices.find(x=>x.kind==='SITE');
  assert.ok(link,'synthetic Staff fixture has a source-linked context for exact relationship validation');
  if(link){const context={};context[{EVENT:'eventId',EVENT_ALLOCATION:'eventAllocationId',SITE_SHIFT_ALLOCATION:'siteShiftAllocationId',SITE_SERVICE:'siteServiceId',SITE:'siteId'}[link.kind]]=link.id;
    const linked=await rpc(staffA,'incident_submit',report(crypto.randomUUID(),'Synthetic report: linked to an authorised staff context.',{p_event:context.eventId??null,p_site:context.siteId??null,p_site_service:context.siteServiceId??null,p_event_allocation:context.eventAllocationId??null,p_site_shift_allocation:context.siteShiftAllocationId??null}));
    assert.ok((await rpc(ops,'incident_detail',{p_incident:linked.incidentId})).reports[0].contextLabel!=='No linked context','exact staff-authorised context is recorded');
    const staticAllocation=choices.find(x=>x.kind==='SITE_SHIFT_ALLOCATION');if(staticAllocation)assert.ok((await staffA.rpc('incident_submit',report(crypto.randomUUID(),'Synthetic report: wrong typed context must fail.',{p_event:staticAllocation.id}))).error,'allocation IDs cannot be supplied as Event IDs');
  }
  assert.ok((await staffA.rpc('incident_submit',report(crypto.randomUUID(),'Synthetic report: invalid context link must fail.',{p_site:'00000000-0000-4000-8000-000000000000'}))).error,'unknown context IDs are rejected');
  const own=await rpc(staffA,'incident_self_list',{p_offset:0,p_limit:25});assert.ok(own.items.some(x=>x.id===created.incidentId));
  assert.ok((await staffB.rpc('incident_detail',{p_incident:created.incidentId})).error,'another Staff Person cannot read guessed report id');
  assert.ok((await staffB.rpc('incident_correct',{p_incident:created.incidentId,p_expected_revision:1,p_idempotency_key:crypto.randomUUID(),p_occurred_at:new Date().toISOString(),p_category:'SAFETY_HAZARD',p_narrative:'Cross person altered report narrative.',p_reason:'Attempted wrong-person correction'})).error,'another Staff Person cannot correct report');
  const q=await rpc(ops,'incident_review_queue',{p_offset:0,p_limit:50,p_include_closed:false});assert.ok(q.items.some(x=>x.id===created.incidentId&&x.contextLabel==='No linked context'),'reviewer queue includes context-free report');
  const correction=await rpc(staffA,'incident_correct',{p_incident:created.incidentId,p_expected_revision:1,p_idempotency_key:crypto.randomUUID(),p_occurred_at:new Date(Date.now()-60000).toISOString(),p_category:'SAFETY_HAZARD',p_narrative:'Synthetic report corrected: damaged barrier at north entrance.',p_reason:'Corrected gate location after checking the shift log'});
  assert.equal(correction.reportVersion,2);
  const afterCorrection=await rpc(staffA,'incident_detail',{p_incident:created.incidentId});assert.equal(afterCorrection.reports.length,2);assert.equal(afterCorrection.reports[0].narrative,original,'original report remains unchanged');assert.equal(afterCorrection.reports[1].correctionReason,'Corrected gate location after checking the shift log');
  const actionKey=crypto.randomUUID(),ackPayload={p_incident:created.incidentId,p_expected_revision:correction.revision,p_idempotency_key:actionKey,p_action:'ACKNOWLEDGE'};const ack=await rpc(ops,'incident_review_action',ackPayload);assert.equal(ack.status,'ACKNOWLEDGED');assert.equal((await rpc(ops,'incident_review_action',ackPayload)).eventId,ack.eventId,'action retry returns the existing event');
  const [race1,race2]=await Promise.all([ops.rpc('incident_review_action',{p_incident:created.incidentId,p_expected_revision:ack.revision,p_idempotency_key:crypto.randomUUID(),p_action:'ACTION_RECORDED',p_action_code:'AREA_MADE_SAFE'}),ops.rpc('incident_review_action',{p_incident:created.incidentId,p_expected_revision:ack.revision,p_idempotency_key:crypto.randomUUID(),p_action:'ACTION_RECORDED',p_action_code:'SERVICE_PAUSED'})]);assert.equal(Number(!race1.error)+Number(!race2.error),1,'optimistic concurrency permits one action at the current revision');
  const state=await rpc(ops,'incident_detail',{p_incident:created.incidentId});assert.ok(['AREA_MADE_SAFE','SERVICE_PAUSED'].includes(state.events.at(-1).actionCode));
  const currentRevision=state.revision;await rpc(ops,'incident_review_action',{p_incident:created.incidentId,p_expected_revision:currentRevision,p_idempotency_key:crypto.randomUUID(),p_action:'CLOSE'});
  const closed=await rpc(ops,'incident_detail',{p_incident:created.incidentId});assert.equal(closed.status,'CLOSED');
  assert.ok((await ops.rpc('incident_review_action',{p_incident:created.incidentId,p_expected_revision:closed.revision,p_idempotency_key:crypto.randomUUID(),p_action:'REOPEN'})).error,'reopen requires a reason');
  await rpc(ops,'incident_review_action',{p_incident:created.incidentId,p_expected_revision:closed.revision,p_idempotency_key:crypto.randomUUID(),p_action:'REOPEN',p_reason:'New information means further operational review is needed'});
  const reopened=await rpc(staffA,'incident_detail',{p_incident:created.incidentId});assert.equal(reopened.status,'REOPENED');assert.ok(reopened.events.some(e=>e.status==='REOPENED'),'Staff sees current status and lifecycle history without manager reason');
  assert.equal(reopened.events.some(e=>e.reason),false,'Staff projection hides management action reasons');
  const privacy=await rpc(admin,'incident_detail',{p_incident:created.incidentId});assert.ok(privacy.reports.some(v=>v.narrative===original));
  const externalKey=crypto.randomUUID();assert.ok((await staffA.rpc('incident_submit',report(externalKey,'Synthetic report: public member observed at entrance.',{p_external_parties:[{relationship:'MEMBER_OF_PUBLIC',descriptor:'male wearing blue jacket'}]}))).data);
  const contactLike=await staffA.rpc('incident_submit',report(crypto.randomUUID(),'Synthetic report: public person details prohibited.',{p_external_parties:[{relationship:'MEMBER_OF_PUBLIC',descriptor:'07000 123456'}]}));assert.ok(contactLike.error,'contact-like descriptor is rejected');
  for(const descriptor of ['John Smith','10 Downing Street','SW1A 2AA','12/12/1980']){const rejected=await staffA.rpc('incident_submit',report(crypto.randomUUID(),'Synthetic report: identifying data rejected.',{p_external_parties:[{relationship:'MEMBER_OF_PUBLIC',descriptor}]}));assert.ok(rejected.error,`sensitive descriptor ${descriptor} is rejected`);}
  assert.ok(other.incidentId);
 }finally{if(grantId)assert.equal(await rpc(admin,'incident_reviewer_revoke',{p_grant:grantId,p_reason:'Synthetic TASK-12A authority test complete'}),true);}
 if(grantId){assert.equal(await rpc(ops,'incident_current_access'),false,'reviewer authority ends immediately after revocation');assert.ok((await ops.rpc('incident_review_queue',{p_offset:0,p_limit:25,p_include_closed:false})).error,'revoked reviewer cannot use queue');}
});
