import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const creds={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 officeB:[process.env.KSS_TEST_OFFICE_B_EMAIL,process.env.KSS_TEST_OFFICE_B_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD]};
async function session(role){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(c,{email:creds[role][0],password:creds[role][1]});assert.ifError(error);return c;}
async function rpc(c,name,args){const {data,error}=await c.rpc(name,args);assert.ifError(error);return data;}
const uuid=()=>crypto.randomUUID();

test('TASK-18A synthetic static and Event mobilisation authority, history and source seams', {timeout:180000}, async()=>{
 assert.ok(url&&key&&Object.values(creds).every(v=>v[0]&&v[1]));
 const [office,admin,officeB,operations,staff]=await Promise.all(['office','admin','officeB','operations','staff'].map(session));
 assert.ok((await office.from('mobilisations').select('id')).error,'base table remains RPC only');
 assert.ok((await operations.rpc('mobilisation_list',{})).error,'Operations cannot read');
 assert.ok((await staff.rpc('mobilisation_list',{})).error,'Staff cannot read');
 assert.ok((await operations.rpc('mobilisation_authorise',{p_organisation:uuid(),p_template:'EVENT',p_title:'Denied Event',p_owner:uuid(),p_key:uuid()})).error);
 const authUser=(await office.auth.getUser()).data.user;assert.ok(authUser);
 const {data:identity,error:identityErr}=await office.from('auth_identities').select('person_id').eq('provider_subject',authUser.id).single();assert.ifError(identityErr);
 const owner=identity.person_id;
 const secondAuth=(await officeB.auth.getUser()).data.user;assert.ok(secondAuth);
 const {data:secondIdentity,error:secondIdentityErr}=await officeB.from('auth_identities').select('person_id').eq('provider_subject',secondAuth.id).single();assert.ifError(secondIdentityErr);
 const secondOwner=secondIdentity.person_id;assert.notEqual(owner,secondOwner);
 // Existing synthetic Dev source fixtures are read through guarded source RPCs, not raw operational tables.
 const staticSource={organisation_id:'25676db1-382a-4bbd-8ca1-b75666daf6a2',site_id:'7c97fcba-7f5b-4fe1-ad6c-190955dd51c8',id:'cd2ffd1f-305b-490f-a49c-0d2c84ad3672'};
 const services=await rpc(office,'site_services_list',{p_site:staticSource.site_id});assert.ok(services.some(s=>s.id===staticSource.id));
 const eventSource=await rpc(office,'operational_event_detail',{p_event:'6790f69e-1f3c-4503-b179-bbd29f053a9a'});assert.ok(eventSource?.source_opportunity_id);
 const {data:wonOpp,error:oppErr}=await office.from('crm_opportunities').select('id,stage,organisation_id').eq('id',eventSource.source_opportunity_id).single();assert.ifError(oppErr);assert.equal(wonOpp.stage,'WON');
 const base=`18A synthetic ${Date.now()}`;
 const create=(org,opp,template,title,requestKey=uuid(),duplicateReason=null)=>office.rpc('mobilisation_authorise',{p_organisation:org,p_opportunity:opp,p_template:template,p_title:title,p_owner:owner,p_target:'2026-11-01',p_duplicate_reason:duplicateReason,p_key:requestKey});
 const staticKey=uuid();const staticCreated=await create(staticSource.organisation_id,null,'STATIC_SITE',`${base} static`,staticKey);assert.ifError(staticCreated.error);
 const same=await create(staticSource.organisation_id,null,'STATIC_SITE',`${base} static`,staticKey);assert.ifError(same.error);assert.equal(same.data.id,staticCreated.data.id);
 assert.ok((await create(staticSource.organisation_id,null,'EVENT',`${base} changed`,staticKey)).error,'changed payload with same key conflicts');
 const eventCreated=await create(eventSource.organisation_id,eventSource.source_opportunity_id,'EVENT',`${base} event`,uuid(),'Separate synthetic Event scope from earlier 18A test');assert.ifError(eventCreated.error);
 const staticId=staticCreated.data.id,eventId=eventCreated.data.id;
 let detail=await rpc(office,'mobilisation_detail',{p_id:staticId});assert.equal(detail.actions.length,13);assert.equal(detail.mobilisation.templateCode,'STATIC_SITE');
 let eventDetail=await rpc(office,'mobilisation_detail',{p_id:eventId});assert.equal(eventDetail.actions.length,12);assert.equal(eventDetail.mobilisation.source_opportunity_id,wonOpp.id);
 const change=async(id,action,data,expected)=>rpc(office,'mobilisation_command',{p_id:id,p_action:action,p_data:data,p_expected:expected,p_key:uuid()});
 let revision=detail.mobilisation.revision;
 const siteLink=await change(staticId,'LINK_ADD',{sourceType:'SITE',sourceId:staticSource.site_id},revision++);assert.ok(siteLink.subjectId);
 await change(staticId,'LINK_ADD',{sourceType:'SITE_SERVICE',sourceId:staticSource.id},revision++);
 assert.ok((await office.rpc('mobilisation_command',{p_id:staticId,p_action:'LINK_ADD',p_data:{sourceType:'EVENT',sourceId:eventSource.id},p_expected:revision,p_key:uuid()})).error,'cross-client Event denied');
 await change(staticId,'BLOCKER_OPEN',{actionId:detail.actions[6].id,reason:'Awaiting approved synthetic emergency procedure',ownerId:owner},revision++);
 const blockerDetail=await rpc(office,'mobilisation_detail',{p_id:staticId});assert.equal(blockerDetail.blockers.filter(b=>!b.resolved_at).length,1);
 await change(staticId,'TARGET_DATE',{targetDate:'2026-11-02',note:'Synthetic target moved'},revision++);
 await change(staticId,'OWNER',{ownerId:secondOwner,note:'Synthetic Office handover'},revision++);
 await change(staticId,'DEPENDENCY_ADD',{actionId:detail.actions[7].id,dependsOnId:detail.actions[6].id},revision++);
 assert.ok((await office.rpc('mobilisation_command',{p_id:staticId,p_action:'DEPENDENCY_ADD',p_data:{actionId:detail.actions[6].id,dependsOnId:detail.actions[7].id},p_expected:revision,p_key:uuid()})).error,'cycle denied');
 await change(staticId,'STATUS',{state:'IN_PROGRESS'},revision++);
 await change(staticId,'STATUS',{state:'GO_LIVE_REVIEW'},revision++);
 await change(staticId,'STATUS',{state:'HANDED_OVER',note:'Synthetic operational handover with outstanding actions and blocker visible'},revision++);
 detail=await rpc(office,'mobilisation_detail',{p_id:staticId});assert.equal(detail.mobilisation.status,'HANDED_OVER');assert.equal(detail.mobilisation.owner_person_id,secondOwner);assert.equal(detail.decisions.find(d=>d.kind==='HANDOVER').facts.unresolvedBlockers,1);assert.equal(detail.decisions.find(d=>d.kind==='HANDOVER').facts.sourceStates.length,2);assert.equal(detail.history.length,revision);
 assert.ok((await office.rpc('mobilisation_command',{p_id:staticId,p_action:'STATUS',p_data:{state:'CANCELLED',note:'Too late'},p_expected:revision,p_key:uuid()})).error,'terminal state holds');
 const raced=await Promise.all([
  office.rpc('mobilisation_command',{p_id:eventId,p_action:'TARGET_DATE',p_data:{targetDate:'2026-11-03',note:'Concurrent synthetic target review'},p_expected:eventDetail.mobilisation.revision,p_key:uuid()}),
  office.rpc('mobilisation_command',{p_id:eventId,p_action:'DECISION',p_data:{outcome:'DEFERRED',note:'Concurrent synthetic decision review'},p_expected:eventDetail.mobilisation.revision,p_key:uuid()})
 ]);
 assert.equal(raced.filter(result=>!result.error).length,1,'expected revision permits one concurrent winner');
 eventDetail=await rpc(office,'mobilisation_detail',{p_id:eventId});
 const eventRevision=eventDetail.mobilisation.revision;
 await change(eventId,'LINK_ADD',{sourceType:'EVENT',sourceId:eventSource.id},eventRevision);
 eventDetail=await rpc(office,'mobilisation_detail',{p_id:eventId});assert.equal(eventDetail.links[0].sourceState,eventSource.status);
 const removed=await rpc(office,'mobilisation_unlink',{p_id:eventId,p_link:eventDetail.links[0].id,p_expected:eventDetail.mobilisation.revision,p_reason:'Correct synthetic Event link history',p_key:uuid()});
 assert.ok(removed.revision>eventRevision);assert.equal((await rpc(office,'mobilisation_detail',{p_id:eventId})).links.length,0);
 assert.equal((await rpc(office,'operational_event_detail',{p_event:eventSource.id})).id,eventSource.id,'unlink cannot delete source Event');
 await change(eventId,'LINK_ADD',{sourceType:'EVENT',sourceId:eventSource.id},removed.revision);
 eventDetail=await rpc(office,'mobilisation_detail',{p_id:eventId});assert.equal(eventDetail.links[0].sourceState,eventSource.status);
 const {data:versions,error:versionsErr}=await office.from('document_versions').select('id,upload_state').eq('upload_state','SUBMITTED').limit(1);assert.ifError(versionsErr);assert.ok(versions.length,'Office needs an authorised synthetic DocumentVersion fixture');
 await change(eventId,'LINK_ADD',{sourceType:'DOCUMENT_VERSION',sourceId:versions[0].id},eventDetail.mobilisation.revision);
 eventDetail=await rpc(office,'mobilisation_detail',{p_id:eventId});assert.equal(eventDetail.links.find(l=>l.sourceType==='DOCUMENT_VERSION').sourceState,'SUBMITTED');
 const otherOfficeDetail=await rpc(officeB,'mobilisation_detail',{p_id:eventId});assert.equal(otherOfficeDetail.links.find(l=>l.sourceType==='DOCUMENT_VERSION').sourceState,'RESTRICTED_OR_CHANGED');
 assert.equal(otherOfficeDetail.links.find(l=>l.sourceType==='DOCUMENT_VERSION').sourceId,null);
 assert.equal(JSON.stringify(otherOfficeDetail.history).includes(versions[0].id),false,'history must also mask private version ID');
 await change(eventId,'STATUS',{state:'IN_PROGRESS'},eventDetail.mobilisation.revision);
 await change(eventId,'STATUS',{state:'GO_LIVE_REVIEW'},eventDetail.mobilisation.revision+1);
 await change(eventId,'STATUS',{state:'HANDED_OVER',note:'Synthetic Event handover with open actions and exact version visible to authorised decider'},eventDetail.mobilisation.revision+2);
 const historicalPrivate=await rpc(officeB,'mobilisation_detail',{p_id:eventId});
 assert.equal(JSON.stringify(historicalPrivate).includes(versions[0].id),false,'handover decision and status history must mask private version ID');
 const authorisedPrivate=await rpc(office,'mobilisation_detail',{p_id:eventId});
 assert.equal(authorisedPrivate.decisions.find(d=>d.kind==='HANDOVER').facts.sourceStates.some(s=>s.id===versions[0].id),true);
 assert.ok((await staff.rpc('mobilisation_detail',{p_id:eventId})).error);assert.ok((await operations.rpc('mobilisation_detail',{p_id:eventId})).error);
 assert.ok((await office.from('mobilisation_history').insert({mobilisation_id:eventId,kind:'STATUS',actor_person_id:owner,revision:999})).error);
 assert.equal((await rpc(admin,'mobilisation_list',{p_organisation:eventSource.organisation_id})).items.some(row=>row.id===eventId),true);
});
