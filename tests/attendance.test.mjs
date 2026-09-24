import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const credentials={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD]};
const person={office:'10000000-0000-4000-8000-000000000002',staffA:'10000000-0000-4000-8000-000000000003',staffB:'10000000-0000-4000-8000-000000000004'};
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await signInWithTestSession(client,{email:credentials[name][0],password:credentials[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}

test('TASK-09A Event attendance authority, immutability, retry and cancellation review',{timeout:180000},async()=>{
 assert.ok(url&&key&&Object.values(credentials).every(x=>x[0]&&x[1]));
 const [admin,office,operations,staffA,staffB]=await Promise.all(Object.keys(credentials).map(signed));
 const day=`${2035+Math.floor(Math.random()*12)}-07-${String(1+Math.floor(Math.random()*20)).padStart(2,'0')}`;const stamp=Date.now();
 const org=await rpc(office,'crm_create_organisation',{p_name:`09A Synthetic Client ${stamp}`});
 const won=await rpc(office,'crm_create_opportunity',{p_organisation:org,p_title:'09A synthetic event',p_type:'DIRECT_ENQUIRY',p_owner:person.office});
 await rpc(office,'crm_transition_opportunity',{p_id:won,p_stage:'WON'});
 const site=await office.from('sites').insert({site_reference:`DEV-09A-${stamp}`,name:'09A Synthetic Site',address_line1:'1 Synthetic Road',town_city:'Example',postcode:'EX1 1AA',reporting_point:'North Gate',created_by_person_id:person.office,site_type:'STADIUM'}).select('id').single();assert.ifError(site.error);
 assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site.data.id)).error);await rpc(office,'operational_link_site',{p_site:site.data.id,p_organisation:org});
 const eventEnd=new Date(Date.parse(`${day}T00:00:00Z`)+6*86400000).toISOString();
 const event=await rpc(office,'operational_create_event',{p_site:site.data.id,p_organisation:org,p_name:'09A Synthetic Event',p_type:'FOOTBALL_MATCH',p_starts:`${day}T00:00:00Z`,p_ends:eventEnd,p_owner:person.office});
 const roles=await rpc(office,'staffing_role_choices',{});const role=roles.find(x=>x.code==='STEWARD').id;
 const requirements=new Map();
 async function allocation(personId,offset){const date=new Date(Date.parse(`${day}T00:00:00Z`)+offset*86400000).toISOString().slice(0,10);const req=await rpc(office,'staffing_create_confirmed',{p_event:event,p_role:role,p_quantity:1,p_report:`${date}T12:00:00Z`,p_start:`${date}T13:00:00Z`,p_end:`${date}T18:00:00Z`,p_area:`09A ${offset}`,p_instructions:'Synthetic test',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});const id=await rpc(operations,'deployment_allocate',{p_event:event,p_requirement:req,p_person:personId,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic 09A test allocation'});requirements.set(id,req);return id;}
 const first=await allocation(person.staffA,0);
 assert.ok((await staffA.rpc('attendance_self_action',{p_allocation:first,p_action:'CHECK_IN',p_actual_at:new Date().toISOString(),p_expected_case_revision:0,p_idempotency_key:crypto.randomUUID()})).error,'ALLOCATED cannot self check in');
 await rpc(staffA,'deployment_respond',{p_allocation:first,p_expected_revision:1,p_response:'ACCEPTED'});
 assert.ok((await staffB.rpc('attendance_self_action',{p_allocation:first,p_action:'CHECK_IN',p_actual_at:new Date().toISOString(),p_expected_case_revision:0,p_idempotency_key:crypto.randomUUID()})).error,'another Person cannot self check in');
 assert.ok((await staffA.from('attendance_events').select('*')).error,'direct attendance table read is denied');
 assert.ok((await staffA.from('attendance_events').insert({event_type:'CHECK_IN'})).error,'direct attendance table write is denied');
 assert.ok((await staffA.rpc('attendance_manager_record',{p_allocation:first,p_action:'CHECK_IN',p_actual_at:new Date().toISOString(),p_reason_code:null,p_reason:null,p_expected_case_revision:0,p_idempotency_key:crypto.randomUUID()})).error,'Staff cannot invoke manager observed attendance');
 const key1=crypto.randomUUID(),actual=new Date().toISOString();
 const checkin=await rpc(staffA,'attendance_self_action',{p_allocation:first,p_action:'CHECK_IN',p_actual_at:actual,p_expected_case_revision:0,p_idempotency_key:key1});
 const replay=await rpc(staffA,'attendance_self_action',{p_allocation:first,p_action:'CHECK_IN',p_actual_at:actual,p_expected_case_revision:0,p_idempotency_key:key1});assert.equal(replay.replayed,true);assert.equal(replay.event_id,checkin.event_id,'lost response retry returns same fact');
 assert.ok((await staffA.rpc('attendance_self_action',{p_allocation:first,p_action:'CHECK_IN',p_actual_at:actual,p_expected_case_revision:1,p_idempotency_key:crypto.randomUUID()})).error,'duplicate check-in fails safely');
 await rpc(staffA,'attendance_self_action',{p_allocation:first,p_action:'CHECK_OUT',p_actual_at:new Date().toISOString(),p_expected_case_revision:1,p_idempotency_key:crypto.randomUUID()});
 let ownItem,state;for(let offset=0;offset<=10000;offset+=50){state=await rpc(staffA,'my_event_attendance',{p_offset:offset,p_limit:50});ownItem=state.items.find(i=>i.allocation_id===first);if(ownItem||offset+50>=state.total)break;}assert.ok(ownItem,'own attendance pages include the new allocation');assert.ok(ownItem.attendance.check_out_at);
 assert.ok(ownItem.attendance.events.every(e=>!Object.hasOwn(e,'reason')),'Staff projection does not expose manager free-text operational notes');
 const second=await allocation(person.staffB,1);await rpc(staffB,'deployment_respond',{p_allocation:second,p_expected_revision:1,p_response:'ACCEPTED'});
 const noShow=await rpc(operations,'attendance_manager_record',{p_allocation:second,p_action:'NO_SHOW_RECORDED',p_actual_at:null,p_reason_code:'NO_SHOW',p_reason:'Synthetic human no-show decision',p_expected_case_revision:0,p_idempotency_key:crypto.randomUUID()});
 assert.ok((await staffB.rpc('attendance_self_action',{p_allocation:second,p_action:'CHECK_IN',p_actual_at:new Date().toISOString(),p_expected_case_revision:1,p_idempotency_key:crypto.randomUUID()})).error,'no-show is not silently reversed');
 const resolutionKey=crypto.randomUUID(),arrival=new Date().toISOString();
 const resolved=await rpc(operations,'attendance_manager_resolve_no_show',{p_allocation:second,p_no_show_event:noShow.event_id,p_actual_at:arrival,p_reason:'Synthetic observed arrival after no-show',p_expected_case_revision:1,p_idempotency_key:resolutionKey});
 assert.equal(resolved.attendance.state,'CHECKED_IN');assert.equal(resolved.attendance.events.filter(e=>e.type==='NO_SHOW_RECORDED').length,1,'original no-show remains in history');
 assert.ok((await operations.rpc('attendance_manager_resolve_no_show',{p_allocation:second,p_no_show_event:noShow.event_id,p_actual_at:new Date(Date.parse(arrival)+5000).toISOString(),p_reason:'Synthetic observed arrival after no-show',p_expected_case_revision:1,p_idempotency_key:resolutionKey})).error,'manager resolution retry with altered timestamp is rejected');
 const race=await allocation(person.staffB,2);await rpc(staffB,'deployment_respond',{p_allocation:race,p_expected_revision:1,p_response:'ACCEPTED'});
 const racing=await Promise.all([staffB.rpc('attendance_self_action',{p_allocation:race,p_action:'CHECK_IN',p_actual_at:new Date().toISOString(),p_expected_case_revision:0,p_idempotency_key:crypto.randomUUID()}),
  operations.rpc('attendance_manager_record',{p_allocation:race,p_action:'CHECK_IN',p_actual_at:new Date().toISOString(),p_reason_code:null,p_reason:null,p_expected_case_revision:0,p_idempotency_key:crypto.randomUUID()})]);
 assert.equal(racing.filter(x=>!x.error).length,1,'concurrent Staff and manager action creates only one check-in');
 const observed=await rpc(operations,'attendance_event_overview',{p_event:event,p_offset:0,p_limit:100});assert.equal(observed.items.find(i=>i.allocation_id===race).attendance.events.filter(e=>e.type==='CHECK_IN').length,1);
 const third=await allocation(person.staffA,3);await rpc(staffA,'deployment_respond',{p_allocation:third,p_expected_revision:1,p_response:'ACCEPTED'});
 const thirdCheck=await rpc(staffA,'attendance_self_action',{p_allocation:third,p_action:'CHECK_IN',p_actual_at:new Date().toISOString(),p_expected_case_revision:0,p_idempotency_key:crypto.randomUUID()});
 assert.equal(await rpc(operations,'deployment_cancel',{p_event:event,p_requirement:requirements.get(third),p_allocation:third,p_expected_revision:2,p_reason:'Synthetic cancellation after check-in'}),3);
 const manager=await rpc(operations,'attendance_event_overview',{p_event:event,p_offset:0,p_limit:100});const cancelled=manager.items.find(i=>i.allocation_id===third);
 assert.equal(cancelled.attendance.check_in_at!==null,true);assert.equal(cancelled.attendance.review_required,true,'cancellation preserves check-in and raises review');
 assert.ok(thirdCheck.event_id);
 assert.ok((await staffA.rpc('attendance_self_action',{p_allocation:first,p_action:'CHECK_IN',p_actual_at:new Date(Date.now()+120000).toISOString(),p_expected_case_revision:2,p_idempotency_key:crypto.randomUUID()})).error,'materially future client time is rejected');
 const correction=await rpc(operations,'attendance_manager_correct',{p_allocation:first,p_target_event:checkin.event_id,p_correction:'CORRECT_TIMESTAMP',p_corrected_actual_at:actual,p_reason:'Synthetic observed-time correction',p_expected_case_revision:2,p_idempotency_key:crypto.randomUUID()});
 assert.ok(correction.attendance.events.some(e=>e.type==='CORRECTION'&&e.corrects_event_id===checkin.event_id),'timestamp correction appends lineage without rewriting the original fact');
 assert.ok((await operations.rpc('attendance_manager_correct',{p_allocation:first,p_target_event:checkin.event_id,p_correction:'CORRECT_TIMESTAMP',p_corrected_actual_at:actual,p_reason:'Synthetic correction',p_expected_case_revision:1,p_idempotency_key:crypto.randomUUID()})).error,'stale correction fails');
 assert.ok((await operations.rpc('attendance_manager_correct',{p_allocation:third,p_target_event:checkin.event_id,p_correction:'CORRECT_TIMESTAMP',p_corrected_actual_at:actual,p_reason:'Wrong allocation target',p_expected_case_revision:2,p_idempotency_key:crypto.randomUUID()})).error,'correction cannot retarget a different allocation/Person');
 const fifth=await allocation(person.staffA,4);await rpc(staffA,'deployment_respond',{p_allocation:fifth,p_expected_revision:1,p_response:'ACCEPTED'});
 assert.ok((await staffA.rpc('attendance_self_action',{p_allocation:fifth,p_action:'CHECK_OUT',p_actual_at:new Date().toISOString(),p_expected_case_revision:0,p_idempotency_key:crypto.randomUUID()})).error,'check-out without check-in fails safely');
 const cancelRace=await allocation(person.staffA,5);await rpc(staffA,'deployment_respond',{p_allocation:cancelRace,p_expected_revision:1,p_response:'ACCEPTED'});
 const cancelResults=await Promise.all([staffA.rpc('attendance_self_action',{p_allocation:cancelRace,p_action:'CHECK_IN',p_actual_at:new Date().toISOString(),p_expected_case_revision:0,p_idempotency_key:crypto.randomUUID()}),
  operations.rpc('deployment_cancel',{p_event:event,p_requirement:requirements.get(cancelRace),p_allocation:cancelRace,p_expected_revision:2,p_reason:'Synthetic concurrent cancellation'})]);
 assert.ifError(cancelResults[1].error,'allocation cancellation commits through its authoritative lifecycle');
 if(!cancelResults[0].error){const cancellationView=await rpc(operations,'attendance_event_overview',{p_event:event,p_offset:0,p_limit:100});const cancelRow=cancellationView.items.find(i=>i.allocation_id===cancelRace);assert.ok(cancelRow.attendance.check_in_at);assert.equal(cancelRow.attendance.review_required,true,'check-in committed first, then cancellation raised review');}
 else {const own=await rpc(staffA,'my_event_attendance',{p_offset:0,p_limit:50,p_allocation_id:cancelRace});const cancelRow=own.items.find(i=>i.allocation_id===cancelRace);assert.equal(cancelRow?.attendance.check_in_at,null,'cancellation committed first, so no check-in fact was accepted');}
 const paginationEvent=await rpc(office,'operational_create_event',{p_site:site.data.id,p_organisation:org,p_name:'09A Synthetic Attendance Paging',p_type:'FOOTBALL_MATCH',p_starts:'2050-07-01T00:00:00Z',p_ends:'2050-07-08T00:00:00Z',p_owner:person.office});
 const pagingAllocations=[];
 for(let index=0;index<26;index++){
  const dayOffset=Math.floor(index/5),slot=index%5,date=new Date(Date.parse('2050-07-01T00:00:00Z')+dayOffset*86400000).toISOString().slice(0,10),hour=6+slot;
  const req=await rpc(office,'staffing_create_confirmed',{p_event:paginationEvent,p_role:role,p_quantity:1,p_report:`${date}T${String(hour-1).padStart(2,'0')}:30:00Z`,p_start:`${date}T${String(hour).padStart(2,'0')}:00:00Z`,p_end:`${date}T${String(hour).padStart(2,'0')}:30:00Z`,p_area:`Paging ${index}`,p_instructions:'Synthetic pagination proof',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
  const id=await rpc(operations,'deployment_allocate',{p_event:paginationEvent,p_requirement:req,p_person:person.staffA,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic pagination proof allocation'});
  await rpc(staffA,'deployment_respond',{p_allocation:id,p_expected_revision:1,p_response:'ACCEPTED'});pagingAllocations.push({id,req});
 }
 const target=pagingAllocations[0].id,firstPage=await rpc(staffA,'my_event_attendance',{p_offset:0,p_limit:25});
 assert.equal(firstPage.items.length,25);assert.ok(firstPage.items.every(item=>pagingAllocations.some(allocation=>allocation.id===item.allocation_id)),'accepted actionable work is prominent ahead of older history');
 assert.ok(!firstPage.items.some(item=>item.allocation_id===target),'the test allocation is beyond the first page');
 const focused=await rpc(staffA,'my_event_attendance',{p_offset:0,p_limit:25,p_allocation_id:target});
 assert.equal(focused.total,1);assert.deepEqual(focused.items.map(item=>item.allocation_id),[target],'the exact accepted own allocation is directly reachable');
 const pageTwo=await rpc(staffA,'my_event_attendance',{p_offset:25,p_limit:25});assert.ok(pageTwo.items.some(item=>item.allocation_id===target),'next page reaches the same exact allocation');
 const peerFocus=await rpc(staffB,'my_event_attendance',{p_offset:0,p_limit:25,p_allocation_id:target});assert.equal(peerFocus.total,0);assert.deepEqual(peerFocus.items,[],'peer allocation focus reveals no record');
 const guessedFocus=await rpc(staffA,'my_event_attendance',{p_offset:0,p_limit:25,p_allocation_id:crypto.randomUUID()});assert.equal(guessedFocus.total,0);assert.deepEqual(guessedFocus.items,[],'unknown allocation focus reveals no record');
 const stableTotal=firstPage.total,allIds=[];for(let offset=0;offset<stableTotal;offset+=25){const page=await rpc(staffA,'my_event_attendance',{p_offset:offset,p_limit:25});allIds.push(...page.items.map(item=>item.allocation_id));}
 assert.equal(allIds.length,stableTotal,'bounded pages cover the complete projection');assert.equal(new Set(allIds).size,stableTotal,'bounded pages contain no duplicate or missing allocation identities');assert.ok(allIds.includes(target));
 const staffRoles=await admin.from('role_assignments').select('id,effective_until').eq('person_id',person.staffA).eq('role_code','SECURITY_STAFF').is('revoked_at',null);assert.ifError(staffRoles.error);assert.ok(staffRoles.data.length);
 const roleRow=staffRoles.data[0],expired=await admin.from('role_assignments').update({effective_until:new Date(Date.now()-1000).toISOString()}).eq('id',roleRow.id);assert.ifError(expired.error);
 try{const denied=await staffA.rpc('my_event_attendance',{p_offset:0,p_limit:25,p_allocation_id:target});assert.ok(denied.error,'an expired Staff role cannot use exact allocation focus');}
 finally{const restored=await admin.from('role_assignments').update({effective_until:roleRow.effective_until}).eq('id',roleRow.id);assert.ifError(restored.error);}
 await rpc(office,'operational_change_event',{p_event:paginationEvent,p_action:'STATUS',p_status:'CANCELLED',p_reason:'Synthetic attendance pagination proof complete'});
 for(const id of [first,second,race,fifth]) await rpc(operations,'deployment_cancel',{p_event:event,p_requirement:requirements.get(id),p_allocation:id,p_expected_revision:2,p_reason:'Synthetic TASK-09A proof complete'});
 await rpc(office,'operational_change_event',{p_event:event,p_action:'STATUS',p_status:'CANCELLED',p_reason:'Synthetic TASK-09A proof complete'});
});
