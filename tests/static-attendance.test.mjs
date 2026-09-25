import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const creds={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
 staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD]};
const person={office:'10000000-0000-4000-8000-000000000002',staffA:'10000000-0000-4000-8000-000000000003',staffB:'10000000-0000-4000-8000-000000000004'};
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:creds[name][0],password:creds[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}
const plus=(date,days)=>new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
const args=(allocation,action,revision,extra={})=>({p_service:extra.service,p_allocation:allocation,p_action:action,
 p_actual_at:extra.actual??null,p_reason_code:extra.code??null,p_reason:extra.reason??null,
 p_target_event:extra.target??null,p_expected_case_revision:revision,p_idempotency_key:extra.key??crypto.randomUUID()});

test('TASK-09B typed static attendance preserves Event source and factual history',{timeout:180000},async()=>{
 assert.ok(url&&key&&Object.values(creds).every(([email,password])=>email&&password));
 const [office,operations,staffA,staffB]=await Promise.all(Object.keys(creds).map(signed));
 const stamp=Date.now(),day=`${2042+Math.floor(Math.random()*8)}-11-09`;
 const org=await rpc(office,'crm_create_organisation',{p_name:`09B Synthetic Client ${stamp}`});
 const opportunity=await rpc(office,'crm_create_opportunity',{p_organisation:org,p_title:'09B synthetic site',p_type:'DIRECT_ENQUIRY',p_owner:person.office});
 await rpc(office,'crm_transition_opportunity',{p_id:opportunity,p_stage:'WON'});
 const site=await office.from('sites').insert({site_reference:`DEV-09B-${stamp}`,name:'09B Synthetic Site',address_line1:'1 Synthetic Road',town_city:'Example',postcode:'EX1 1AA',reporting_point:'Gate 1',created_by_person_id:person.office,site_type:'WAREHOUSE'}).select('id').single();assert.ifError(site.error);
 assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site.data.id)).error);
 await rpc(office,'operational_link_site',{p_site:site.data.id,p_organisation:org});
 const service=await rpc(office,'site_service_create',{p_site:site.data.id,p_name:'09B Static Service',p_type:'STATIC_GUARDING',p_effective_from:day,p_owner:person.office});
 await rpc(office,'site_service_transition',{p_service:service,p_state:'ACTIVE',p_effective_on:day,p_expected_revision:1,p_reason:'Synthetic 09B service'});
 const roles=await rpc(office,'staffing_role_choices',{}),role=roles.find(x=>x.code==='STEWARD').id;
 const created=[];
 async function allocate(staffName,offset){const date=plus(day,offset);
  const demand=await rpc(office,'site_shift_extra',{p_service:service,p_service_date:date,p_role:role,p_quantity:1,
   p_report_at:`${date}T18:00:00Z`,p_shift_starts_at:`${date}T18:00:00Z`,p_shift_ends_at:`${plus(date,1)}T06:00:00Z`,
   p_area:`Night ${offset}`,p_reporting:'Gate 1',p_reason:'Synthetic attendance shift'});
  const allocation=await rpc(operations,'site_shift_allocate',{p_service:service,p_demand:demand,p_person:person[staffName],p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic 09B candidate review'});
  created.push({allocation,demand});return {allocation,demand,client:staffName==='staffA'?staffA:staffB};}
 const first=await allocate('staffA',0);
 const self=(client,allocation,action,revision,extra={})=>client.rpc('attendance_site_self_action',{p_allocation:allocation,p_action:action,p_actual_at:extra.actual??new Date().toISOString(),p_expected_case_revision:revision,p_idempotency_key:extra.key??crypto.randomUUID()});
 assert.ok((await self(staffA,first.allocation,'CHECK_IN',0)).error,'allocated is not accepted');
 await rpc(staffA,'site_shift_respond',{p_allocation:first.allocation,p_expected_revision:1,p_response:'ACCEPTED'});
 assert.ok((await self(staffB,first.allocation,'CHECK_IN',0)).error,'peer Person denied');
 assert.ok((await staffA.rpc('attendance_self_action',{p_allocation:first.allocation,p_action:'CHECK_IN',p_actual_at:new Date().toISOString(),p_expected_case_revision:0,p_idempotency_key:crypto.randomUUID()})).error,'Event action cannot substitute static UUID');
 assert.ok((await staffA.from('attendance_cases').select('id')).error,'direct table read denied');
 assert.ok((await staffA.from('attendance_events').insert({event_type:'CHECK_IN'})).error,'direct table write denied');
 const actual=new Date().toISOString(),key1=crypto.randomUUID();
 const checkin=await rpc(staffA,'attendance_site_self_action',{p_allocation:first.allocation,p_action:'CHECK_IN',p_actual_at:actual,p_expected_case_revision:0,p_idempotency_key:key1});
 const replay=await rpc(staffA,'attendance_site_self_action',{p_allocation:first.allocation,p_action:'CHECK_IN',p_actual_at:actual,p_expected_case_revision:0,p_idempotency_key:key1});
 assert.equal(replay.event_id,checkin.event_id);assert.equal(replay.replayed,true);
 assert.ok((await staffA.rpc('attendance_site_self_action',{p_allocation:first.allocation,p_action:'CHECK_IN',p_actual_at:new Date(Date.parse(actual)+1000).toISOString(),p_expected_case_revision:0,p_idempotency_key:key1})).error,'changed payload cannot reuse idempotency key');
 assert.ok((await self(staffA,first.allocation,'CHECK_IN',1)).error,'duplicate check-in denied');
 await rpc(staffA,'attendance_site_self_action',{p_allocation:first.allocation,p_action:'CHECK_OUT',p_actual_at:new Date().toISOString(),p_expected_case_revision:1,p_idempotency_key:crypto.randomUUID()});
 const focus=await rpc(staffA,'my_attendance_09b',{p_offset:0,p_limit:25,p_allocation_id:first.allocation,p_source:'SITE_SHIFT'});
 assert.equal(focus.total,1);assert.equal(focus.items[0].demand_id,first.demand);assert.equal(focus.items[0].service_id,service);
 assert.equal(focus.items[0].site_name,'09B Synthetic Site');assert.equal(focus.items[0].source,'SITE_SHIFT');
 assert.equal(focus.items[0].attendance.state,'CHECKED_OUT');assert.ok(focus.items[0].attendance.events.every(e=>e.reason===null));
 const wrongSource=await rpc(staffA,'my_attendance_09b',{p_offset:0,p_limit:25,p_allocation_id:first.allocation,p_source:'EVENT'});
 assert.equal(wrongSource.total,0);assert.equal((await rpc(staffB,'my_attendance_09b',{p_offset:0,p_limit:25,p_allocation_id:first.allocation,p_source:'SITE_SHIFT'})).total,0);
 const manager=await rpc(operations,'attendance_site_overview_09b',{p_service:service,p_demand:first.demand,p_offset:0,p_limit:100});
 assert.equal(manager.items[0].attendance.state,'CHECKED_OUT');
 const corrected=await rpc(operations,'attendance_site_manager_action',args(first.allocation,'CORRECT_TIMESTAMP',2,{service,actual,reason:'Synthetic corrected actual instant',target:checkin.event_id}));
 assert.ok(corrected.attendance.events.some(e=>e.type==='CORRECTION'&&e.corrects_event_id===checkin.event_id));
 assert.ok((await operations.rpc('attendance_site_manager_action',args(first.allocation,'CORRECT_TIMESTAMP',3,{service,actual,reason:'Cross-case correction',target:crypto.randomUUID()}))).error);
 const second=await allocate('staffB',1);await rpc(staffB,'site_shift_respond',{p_allocation:second.allocation,p_expected_revision:1,p_response:'ACCEPTED'});
 const noShow=await rpc(operations,'attendance_site_manager_action',args(second.allocation,'NO_SHOW_RECORDED',0,{service,code:'NO_SHOW',reason:'Synthetic no-show observation'}));
 assert.ok((await self(staffB,second.allocation,'CHECK_IN',1)).error,'no-show needs resolution');
 const resolved=await rpc(operations,'attendance_site_manager_action',args(second.allocation,'RESOLVE_NO_SHOW_FOR_CHECK_IN',1,{service,actual:new Date().toISOString(),reason:'Synthetic later observed arrival',target:noShow.event_id}));
 assert.equal(resolved.attendance.state,'CHECKED_IN');assert.equal(resolved.attendance.events.filter(e=>e.type==='NO_SHOW_RECORDED').length,1);
 assert.ok((await operations.rpc('attendance_site_manager_action',args(second.allocation,'CHECK_IN',3,{service:crypto.randomUUID(),actual:new Date().toISOString()}))).error,'wrong Service denied');
 assert.ok((await staffA.rpc('attendance_site_manager_action',args(second.allocation,'CHECK_OUT',3,{service,actual:new Date().toISOString()}))).error,'Staff role is not manager authority');
 const third=await allocate('staffA',2);await rpc(staffA,'site_shift_respond',{p_allocation:third.allocation,p_expected_revision:1,p_response:'ACCEPTED'});
 const raced=await Promise.all([self(staffA,third.allocation,'CHECK_IN',0),operations.rpc('attendance_site_manager_action',args(third.allocation,'CHECK_IN',0,{service,actual:new Date().toISOString()}))]);
 assert.equal(raced.filter(x=>!x.error).length,1,'concurrent self/manager check-in yields one fact');
 const beforeCancel=await rpc(operations,'attendance_site_overview_09b',{p_service:service,p_demand:third.demand,p_offset:0,p_limit:100});
 assert.equal(beforeCancel.items[0].attendance.events.filter(e=>e.type==='CHECK_IN').length,1);
 await rpc(operations,'site_shift_cancel_allocation',{p_service:service,p_demand:third.demand,p_allocation:third.allocation,p_expected_revision:2,p_reason:'Synthetic cancellation after attendance'});
 const afterCancel=await rpc(operations,'attendance_site_overview_09b',{p_service:service,p_demand:third.demand,p_offset:0,p_limit:100});
 assert.equal(afterCancel.items[0].attendance.events.filter(e=>e.type==='REVIEW_REQUIRED').length,1);
 assert.ok((await self(staffA,third.allocation,'CHECK_OUT',2)).error,'cancelled allocation blocks self check-out');
 assert.ok((await operations.rpc('attendance_site_manager_action',args(third.allocation,'CORRECT_TIMESTAMP',2,{service,actual,reason:'Wrong case event',target:checkin.event_id}))).error,'cross-case correction denied');
 const fourth=await allocate('staffB',3);await rpc(staffB,'site_shift_respond',{p_allocation:fourth.allocation,p_expected_revision:1,p_response:'ACCEPTED'});
 const cancelledRace=await Promise.all([
  self(staffB,fourth.allocation,'CHECK_IN',0),
  operations.rpc('site_shift_cancel_allocation',{p_service:service,p_demand:fourth.demand,p_allocation:fourth.allocation,p_expected_revision:2,p_reason:'Synthetic attendance race cancellation'})
 ]);
 assert.ifError(cancelledRace[1].error,'authoritative source cancellation commits');
 const raceView=await rpc(operations,'attendance_site_overview_09b',{p_service:service,p_demand:fourth.demand,p_offset:0,p_limit:100});
 if(!cancelledRace[0].error){assert.equal(raceView.items[0].attendance.events.filter(e=>e.type==='CHECK_IN').length,1);assert.equal(raceView.items[0].attendance.events.filter(e=>e.type==='REVIEW_REQUIRED').length,1,'check-in first is retained and flagged exactly once');}
 else assert.equal(raceView.items.length,0,'cancellation first denies Staff fact and creates no empty case');
 const firstPage=await rpc(staffA,'my_attendance_09b',{p_offset:0,p_limit:25});
 const all=[];for(let offset=0;offset<firstPage.total;offset+=25){const page=await rpc(staffA,'my_attendance_09b',{p_offset:offset,p_limit:25});all.push(...page.items.map(x=>`${x.source}:${x.allocation_id}`));}
 assert.ok(all.some(x=>x.startsWith('SITE_SHIFT:'))&&all.some(x=>x.startsWith('EVENT:')),'one Staff attendance list includes both sources across its bounded pages');
 assert.equal(new Set(all).size,firstPage.total,'bounded pages have no duplicate source identity');
 await rpc(operations,'site_shift_cancel_allocation',{p_service:service,p_demand:first.demand,p_allocation:first.allocation,p_expected_revision:2,p_reason:'Synthetic proof cleanup'});
 await rpc(operations,'site_shift_cancel_allocation',{p_service:service,p_demand:second.demand,p_allocation:second.allocation,p_expected_revision:2,p_reason:'Synthetic proof cleanup'});
});
