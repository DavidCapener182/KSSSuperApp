import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const creds={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],ops:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD],staffZero:[process.env.KSS_TEST_STAFF_ZERO_EMAIL,process.env.KSS_TEST_STAFF_ZERO_PASSWORD]};
const ids={office:'10000000-0000-4000-8000-000000000002',ops:'10000000-0000-4000-8000-000000000007',staffA:'10000000-0000-4000-8000-000000000003',staffB:'10000000-0000-4000-8000-000000000004',staffZero:'10000000-0000-4000-8000-000000000008'};
async function signed(name){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await signInWithTestSession(c,{email:creds[name][0],password:creds[name][1]});assert.ifError(error);return c;}
async function rpc(c,name,args={}){const {data,error}=await c.rpc(name,args);assert.ifError(error,`${name}: ${error?.message}`);return data;}
const day=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const plus=(d,n)=>new Date(Date.parse(`${d}T00:00:00Z`)+n*86400000).toISOString().slice(0,10);
const local=(d)=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`};
const time=(d=new Date(Date.now()-120000))=>({p_occurred:d.toISOString(),p_local:local(d),p_offset:(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',timeZoneName:'shortOffset'}).formatToParts(d).find(x=>x.type==='timeZoneName')?.value.includes('+1')?'+01:00':'+00:00')});
const submit=(service,type,body,key=crypto.randomUUID(),context={})=>({p_service:service,p_demand:context.demand??null,p_allocation:context.allocation??null,p_type:type,p_source:'OBSERVED',...time(),p_body:body,p_key:key});

test('TASK-14A synthetic Site Book, next shift, individual acknowledgement and denied scopes',{timeout:180000},async()=>{
 assert.ok(url&&key&&Object.values(creds).every(x=>x[0]&&x[1]));
 const [office,ops,staffA,staffB,staffZero]=await Promise.all(Object.keys(creds).map(signed));
 let service,allocation,demand,grantA,grantB,grantManager,grantOther;const stamp=Date.now(),today=day();
 try{
  const org=await rpc(office,'crm_create_organisation',{p_name:`14A Synthetic Warehouse ${stamp}`});
  const won=await rpc(office,'crm_create_opportunity',{p_organisation:org,p_title:'Synthetic 24/7 Site Book proof',p_type:'DIRECT_ENQUIRY',p_owner:ids.office});
  await rpc(office,'crm_transition_opportunity',{p_id:won,p_stage:'WON'});
  const created=await office.from('sites').insert({site_reference:`DEV-14A-${stamp}`,name:'Music Warehouse Security',address_line1:'1 Synthetic Road',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'Gatehouse',created_by_person_id:ids.office,site_type:'WAREHOUSE'}).select('id').single();assert.ifError(created.error);
  const site=created.data.id;assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site)).error);
  await rpc(office,'operational_link_site',{p_site:site,p_organisation:org});
  service=await rpc(office,'site_service_create',{p_site:site,p_name:'Music Warehouse Security',p_type:'STATIC_GUARDING',p_effective_from:today,p_owner:ids.office});
  await rpc(office,'site_service_transition',{p_service:service,p_state:'ACTIVE',p_effective_on:today,p_expected_revision:1,p_reason:'Synthetic 24/7 book proof'});
  const roles=await rpc(office,'staffing_role_choices');const role=roles.find(x=>x.code==='STEWARD');assert.ok(role);
  for(const [report,start,end] of [['06:00','06:00','18:00'],['18:00','18:00','06:00']])await rpc(office,'site_shift_template_publish',{p_service:service,p_line:null,p_effective_from:today,p_weekdays:[1,2,3,4,5,6,7],p_role:role.id,p_quantity:2,p_report:report,p_starts:start,p_ends:end,p_area:'Warehouse',p_reporting:'Gatehouse',p_reason:'Synthetic day and night cover'});
  const detail=await rpc(ops,'site_service_detail',{p_site:site,p_service:service,p_from:today,p_until:plus(today,2)});
  assert.ok(detail.demands.some(x=>x.service_date===today&&new Date(x.report_at).getUTCHours()===5),'day demand 06:00–18:00 materialised');
  const night=detail.demands.find(x=>x.service_date===today&&new Date(x.report_at).getUTCHours()===17);assert.ok(night,'night demand 18:00–06:00 materialised');demand=night.id;
  assert.ok((await ops.rpc('site_book_next_shift_14a',{p_service:service,p_offset:0})).error,'Operations role alone has no manager grant');
  assert.ok((await office.rpc('site_book_next_shift_14a',{p_service:service,p_offset:0})).error,'Office has no blanket book read');
  assert.ok((await staffB.rpc('site_book_next_shift_14a',{p_service:service,p_offset:0})).error,'unallocated Staff has no book access');
  const grantChoices=await rpc(office,'site_book_grant_choices_14a');const otherService=grantChoices.services.find(x=>x.siteName!=='Music Warehouse Security');assert.ok(otherService,'a different synthetic Site exists for scope proof');
  const now=new Date(),from=new Date(now.getTime()-3600000).toISOString(),until=new Date(now.getTime()+3*3600000).toISOString();
  grantA=await rpc(office,'site_book_grant_issue',{p_service:service,p_person:ids.staffA,p_kind:'CONTRIBUTOR',p_from:from,p_until:until,p_reason:'Synthetic outgoing cover proof'});
  grantB=await rpc(office,'site_book_grant_issue',{p_service:service,p_person:ids.staffB,p_kind:'CONTRIBUTOR',p_from:from,p_until:until,p_reason:'Synthetic relief guard proof'});
  grantOther=await rpc(office,'site_book_grant_issue',{p_service:otherService.id,p_person:ids.staffZero,p_kind:'CONTRIBUTOR',p_from:from,p_until:until,p_reason:'Synthetic other Site scope proof'});
  assert.ok((await rpc(staffZero,'site_book_services_14a')).some(x=>x.id===otherService.id));
  assert.ok((await staffZero.rpc('site_book_next_shift_14a',{p_service:service,p_offset:0})).error,'Staff at another Site cannot discover this book');
  grantManager=await rpc(office,'site_book_grant_issue',{p_service:service,p_person:ids.ops,p_kind:'MANAGER',p_from:from,p_until:until,p_reason:'Synthetic site book manager proof'});
  assert.ok((await staffB.rpc('site_book_services_14a')).data.some(x=>x.id===service));
  const note=await rpc(staffA,'site_book_submit_14a',submit(service,'ROUTINE_OBSERVATION','Rear gate checked and secure at shift change.'));
  const item=await rpc(staffA,'site_book_submit_14a',submit(service,'OUTSTANDING_ITEM','Loading Bay 7 light reported faulty.'));
  const contractor=await rpc(staffA,'site_book_submit_14a',submit(service,'VISITOR_CONTRACTOR_DELIVERY','Contractor attended fire-alarm panel at 14:20.'));
  const equipment=await rpc(staffA,'site_book_submit_14a',submit(service,'KEYS_EQUIPMENT','Key 4 reported sticking in rear lock.'));
  assert.ok(note.entryId&&item.itemId&&contractor.entryId&&equipment.entryId);
  const h=await rpc(staffA,'site_book_handover_start_14a',{p_service:service,p_from:new Date(Date.now()-12*3600000).toISOString(),p_until:new Date().toISOString(),p_body:'Day shift: rear gate remains closed. Open items carry forward.',p_key:crypto.randomUUID()});
  const h2=await rpc(staffB,'site_book_handover_contribute_14a',{p_handover:h.handoverId,p_expected:1,p_body:'Contractor attendance and key note recorded for night team.',p_key:crypto.randomUUID()});assert.equal(h2.revision,2);
  const first=await rpc(staffA,'site_book_handover_ack_14a',{p_handover:h.handoverId,p_revision:2,p_key:crypto.randomUUID()});assert.equal(first.revision,2);
  let b=await rpc(staffB,'site_book_next_shift_14a',{p_service:service,p_offset:0});assert.equal(b.handover.acknowledgedByYouAt,null,'other night guard remains unacknowledged');assert.equal(b.handover.acknowledgements.length,1);assert.equal(b.openTotal,1);
  await rpc(staffB,'site_book_handover_ack_14a',{p_handover:h.handoverId,p_revision:2,p_key:crypto.randomUUID()});b=await rpc(staffB,'site_book_next_shift_14a',{p_service:service,p_offset:0});assert.ok(b.handover.acknowledgedByYouAt);assert.equal(b.handover.acknowledgements.length,2);
  const updated=await rpc(ops,'site_book_item_action_14a',{p_item:item.itemId,p_expected:1,p_action:'UPDATED',p_note:'Engineer booked for next shift.',p_reason:null,p_key:crypto.randomUUID()});assert.equal(updated.status,'OPEN');
  const carried=await rpc(staffB,'site_book_next_shift_14a',{p_service:service,p_offset:0});assert.ok(carried.openItems.some(x=>x.id===item.itemId&&x.history.length===2));
  const resolved=await rpc(ops,'site_book_item_action_14a',{p_item:item.itemId,p_expected:2,p_action:'RESOLVED',p_note:'Engineer attended; light repair completed.',p_reason:'Repair observed by Operations',p_key:crypto.randomUUID()});assert.equal(resolved.status,'RESOLVED');
  const corrected=await rpc(staffA,'site_book_correct_14a',{p_entry:note.entryId,p_expected:1,...time(),p_body:'Rear gate checked and kept closed for night shift.',p_reason:'Clarified closing instruction',p_key:crypto.randomUUID()});assert.equal(corrected.version,2);
  const itemLineage=await rpc(staffA,'site_book_item_history_14a',{p_item:item.itemId});assert.equal(itemLineage.status,'RESOLVED');assert.equal(itemLineage.events.length,3,'resolved history remains reachable');
  const searched=await rpc(ops,'site_book_search_14a',{p_service:service,p_search:'Loading Bay 7',p_type:null,p_from:null,p_until:null,p_offset:0});assert.ok(searched.items.some(x=>x.itemId===item.itemId&&x.itemStatus==='RESOLVED'));
  const read=await rpc(staffA,'site_book_next_shift_14a',{p_service:service,p_offset:0});const original=read.recentNotes.find(x=>x.id===note.entryId);assert.equal(original.history.length,2);assert.equal(original.history[0].body,'Rear gate checked and secure at shift change.');assert.equal(read.openTotal,0);
  assert.ok((await staffA.from('site_book_entries').select('id')).error,'direct base table read denied');
  assert.ok((await staffB.from('site_book_entry_versions').insert({entry_id:note.entryId,version:3,body:'Forged history',actor_person_id:ids.staffB})).error,'direct history write denied');
  assert.ok((await staffB.rpc('site_book_correct_14a',{p_entry:note.entryId,p_expected:2,...time(),p_body:'Other person correction.',p_reason:'Cross-person attempt',p_key:crypto.randomUUID()})).error,'other Staff cannot correct');
  const duplicateKey=crypto.randomUUID(),payload=submit(service,'ROUTINE_OBSERVATION','Synthetic idempotent routine note.',duplicateKey);const once=await rpc(staffA,'site_book_submit_14a',payload);assert.equal((await rpc(staffA,'site_book_submit_14a',payload)).entryId,once.entryId);assert.ok((await staffA.rpc('site_book_submit_14a',{...payload,p_body:'Changed payload with same key.'})).error);
  const raceKey=crypto.randomUUID(),racePayload=submit(service,'ROUTINE_OBSERVATION','Concurrent identical retry creates one record.',raceKey);const raced=await Promise.all([staffA.rpc('site_book_submit_14a',racePayload),staffA.rpc('site_book_submit_14a',racePayload)]);assert.ok(raced.every(x=>!x.error));assert.equal(raced[0].data.entryId,raced[1].data.entryId);
  assert.ok((await staffB.rpc('site_book_submit_14a',submit(crypto.randomUUID(),'ROUTINE_OBSERVATION','Cross-site attempt denied.'))).error);
  await rpc(office,'site_book_grant_revoke',{p_grant:grantB,p_reason:'Synthetic relief access end'});grantB=null;
  assert.ok((await staffB.rpc('site_book_next_shift_14a',{p_service:service,p_offset:0})).error,'relief access disappears after grant revocation');
  assert.ok((await staffB.rpc('site_book_submit_14a',submit(service,'ROUTINE_OBSERVATION','Expired relief attempt denied.'))).error);
  const candidates=await rpc(ops,'site_shift_candidates',{p_service:service,p_demand:demand,p_search:'',p_offset:0,p_limit:20});
  if(candidates.items.some(x=>x.id===ids.staffA&&x.check.result!=='BLOCKED')){
   allocation=await rpc(ops,'site_shift_allocate',{p_service:service,p_demand:demand,p_person:ids.staffA,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic allocated Site Book proof'});
   await rpc(office,'site_book_grant_revoke',{p_grant:grantA,p_reason:'Verify allocation-only book access'});grantA=null;
   const allocatedRead=await rpc(staffA,'site_book_next_shift_14a',{p_service:service,p_offset:0});assert.equal(allocatedRead.service.id,service);
   await rpc(staffA,'site_book_submit_14a',submit(service,'ROUTINE_OBSERVATION','Allocated guard added a factual night note.',crypto.randomUUID(),{demand,allocation}));
  } else assert.fail('Staff A unavailable for current night demand; allocated path unverified');
 }finally{
  if(grantA)await office.rpc('site_book_grant_revoke',{p_grant:grantA,p_reason:'Synthetic TASK-14A cleanup'});
  if(grantB)await office.rpc('site_book_grant_revoke',{p_grant:grantB,p_reason:'Synthetic TASK-14A cleanup'});
  if(grantOther)await office.rpc('site_book_grant_revoke',{p_grant:grantOther,p_reason:'Synthetic other Site scope proof complete'});
  if(grantManager)await office.rpc('site_book_grant_revoke',{p_grant:grantManager,p_reason:'Synthetic TASK-14A cleanup'});
  if(allocation)await ops.rpc('site_shift_cancel_allocation',{p_service:service,p_demand:demand,p_allocation:allocation,p_expected_revision:1,p_reason:'Synthetic TASK-14A cleanup'});
 }
});
