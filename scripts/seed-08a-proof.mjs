// Synthetic Dev-only product proof. Run with the existing in-process test Auth sessions.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from '../tests/helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(url?.includes('dnfhkmmnlbiabqypclqg.supabase.co'),'Dev project only');
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ids={office:'10000000-0000-4000-8000-000000000002',staffA:'10000000-0000-4000-8000-000000000003',
 staffB:'10000000-0000-4000-8000-000000000004'};
async function signed(email,password){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email,password});assert.ifError(error);return client;}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}
const office=await signed(process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD);
const operations=await signed(process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD);
const staffA=await signed(process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD);
const staffB=await signed(process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD);
const week='2026-11-09';
const plus=(day,delta)=>new Date(Date.parse(`${day}T00:00:00Z`)+delta*86400000).toISOString().slice(0,10);
const stamp=(day,time)=>`${day}T${time}:00Z`;
const maybeOrg=await office.from('crm_organisations').select('id,relationship_status').eq('name','Synthetic Logistics Ltd').maybeSingle();
assert.ifError(maybeOrg.error);
let organisation=maybeOrg.data?.id;
if(!organisation){
 organisation=await rpc(office,'crm_create_organisation',{p_name:'Synthetic Logistics Ltd'});
 const opportunity=await rpc(office,'crm_create_opportunity',{p_organisation:organisation,p_title:'Synthetic static service proof',
  p_type:'DIRECT_ENQUIRY',p_owner:ids.office});
 await rpc(office,'crm_transition_opportunity',{p_id:opportunity,p_stage:'WON'});
}
assert.equal((await office.from('crm_organisations').select('relationship_status').eq('id',organisation).single()).data.relationship_status,'CLIENT');
const maybeSite=await office.from('sites').select('id,status').eq('site_reference','DEV-08A-LOGISTICS').maybeSingle();
assert.ifError(maybeSite.error);
let site=maybeSite.data?.id;
if(!site){
 const created=await office.from('sites').insert({site_reference:'DEV-08A-LOGISTICS',name:'Synthetic Distribution Centre',
  address_line1:'1 Example Road',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'Main gate',
  created_by_person_id:ids.office,site_type:'WAREHOUSE'}).select('id').single();assert.ifError(created.error);site=created.data.id;
 assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site)).error);
 await rpc(office,'operational_link_site',{p_site:site,p_organisation:organisation});
}
const existing=await rpc(office,'site_services_list',{p_site:site});
let service=existing.find((item)=>item.name==='24/7 Security Service')?.id;
const roles=await rpc(office,'staffing_role_choices',{});
const guard=roles.find((item)=>item.code==='SECURITY_GUARD');assert.ok(guard,'Security Guard role exists');
if(!service){
 service=await rpc(office,'site_service_create',{p_site:site,p_name:'24/7 Security Service',
  p_type:'STATIC_GUARDING',p_effective_from:'2026-10-26',p_owner:ids.office});
 await rpc(office,'site_service_transition',{p_service:service,p_state:'ACTIVE',p_effective_on:'2026-10-26',
  p_expected_revision:1,p_reason:'Synthetic ongoing guarding proof'});
 await rpc(office,'site_shift_template_publish',{p_service:service,p_line:null,p_effective_from:'2026-10-26',
  p_weekdays:[1,2,3,4,5,6,7],p_role:guard.id,p_quantity:1,p_report:'06:00',p_starts:'06:00',p_ends:'18:00',
  p_area:'Day guarding',p_reporting:'Main gate',p_reason:'Synthetic seven-day day cover'});
 const nightVersion=await rpc(office,'site_shift_template_publish',{p_service:service,p_line:null,p_effective_from:'2026-10-26',
  p_weekdays:[1,2,3,4,5,6,7],p_role:guard.id,p_quantity:1,p_report:'18:00',p_starts:'18:00',p_ends:'06:00',
  p_area:'Night guarding',p_reporting:'Main gate',p_reason:'Synthetic initial night cover'});
 const first=await rpc(office,'site_service_detail',{p_site:site,p_service:service,p_from:'2026-10-26',p_until:'2026-11-02'});
 const nightLine=first.templates.find((item)=>item.id===nightVersion)?.line_id;assert.ok(nightLine);
 await rpc(office,'site_shift_template_publish',{p_service:service,p_line:nightLine,p_effective_from:'2026-11-01',
  p_weekdays:[1,2,3,4,5,6,7],p_role:guard.id,p_quantity:2,p_report:'18:00',p_starts:'18:00',p_ends:'06:00',
  p_area:'Night guarding',p_reporting:'Main gate',p_reason:'Synthetic night guard increase from 1 November'});
}
const detail=await rpc(office,'site_service_detail',{p_site:site,p_service:service,p_from:week,p_until:plus(week,7)});
assert.equal(detail.demands.length,14);
const day=detail.demands.find((item)=>item.service_date===week&&item.area_label==='Day guarding');
const night=detail.demands.find((item)=>item.service_date===week&&item.area_label==='Night guarding');
assert.equal(day.required_quantity,1);assert.equal(night.required_quantity,2);
assert.equal(new Date(night.shift_ends_at).getTime()-new Date(night.shift_starts_at).getTime(),12*3600000);
if(day.allocated===0){
 const current=await rpc(staffA,'my_availability',{});
 await rpc(staffA,'availability_save',{p_state:'AVAILABLE',p_starts:stamp(week,'06:00'),p_ends:stamp(week,'18:00'),
  p_note:null,p_expected_revision:current.revision,p_confirm_replace:true,p_acknowledge_deployment_conflict:true});
 const allocation=await rpc(office,'site_shift_allocate',{p_service:service,p_demand:day.id,p_person:ids.staffA,
  p_expected_revision:day.revision,p_acknowledge_warnings:true,p_reason:'Synthetic Security Guard review'});
 await rpc(staffA,'site_shift_respond',{p_allocation:allocation,p_expected_revision:1,p_response:'ACCEPTED'});
}
if(night.allocated===0){
 const allocation=await rpc(operations,'site_shift_allocate',{p_service:service,p_demand:night.id,p_person:ids.staffB,
  p_expected_revision:night.revision,p_acknowledge_warnings:true,p_reason:'Synthetic Security Guard review'});
 await rpc(staffB,'site_shift_respond',{p_allocation:allocation,p_expected_revision:1,p_response:'ACCEPTED'});
 const current=await rpc(staffB,'my_availability',{});
 await rpc(staffB,'availability_save',{p_state:'UNAVAILABLE',p_starts:stamp(week,'19:00'),p_ends:stamp(week,'20:00'),
  p_note:'Synthetic availability conflict',p_expected_revision:current.revision,p_confirm_replace:true,
  p_acknowledge_deployment_conflict:true});
}
const extraDate=plus(week,1);
const extra=detail.demands.find((item)=>item.service_date===extraDate&&item.area_label==='Day guarding');
if(extra.required_quantity===1) await rpc(operations,'site_shift_amend',{p_service:service,p_demand:extra.id,
 p_expected_revision:extra.revision,p_kind:'CHANGE_QUANTITY',p_quantity:2,p_report_at:null,p_shift_starts_at:null,
 p_shift_ends_at:null,p_area:null,p_reporting:null,p_reason:'Synthetic dated extra guard'});
const eventName='Synthetic Logistics Open Day';
const eventList=await rpc(office,'operational_events_list',{p_search:eventName,p_site:site,p_offset:0,p_limit:25});
if(!eventList.items?.some((item)=>item.name===eventName)){
 const event=await rpc(office,'operational_create_event',{p_site:site,p_organisation:organisation,p_name:eventName,
  p_type:'CORPORATE_EVENT',p_starts:stamp(plus(week,2),'13:00'),p_ends:stamp(plus(week,2),'17:00'),p_owner:ids.office});
 await rpc(office,'staffing_create_confirmed',{p_event:event,p_role:guard.id,p_quantity:1,
  p_report:stamp(plus(week,2),'13:00'),p_start:stamp(plus(week,2),'13:00'),p_end:stamp(plus(week,2),'17:00'),
  p_area:'Open Day entrance',p_instructions:'Synthetic discrete Event proof',p_reason:null,
  p_confirm_duplicate:false,p_confirm_exception:false});
}
const workforce=await rpc(office,'workforce_week_08a',{p_week:week,p_client:'Synthetic Logistics Ltd',p_limit:40});
assert.equal(workforce.total_lines,15);assert.equal(workforce.totals.required,23);
assert.equal(workforce.totals.allocated,2);assert.equal(workforce.totals.accepted,2);
assert.equal(workforce.totals.availability_conflicts,1);
const schedule=await rpc(staffA,'my_schedule_08a',{p_week:week});
assert.ok(schedule.work.some((item)=>item.source==='SITE_SHIFT'&&item.event_name==='24/7 Security Service'));
const history=await rpc(office,'site_service_history',{p_site:site,p_service:service});
assert.ok(history.items.some((item)=>item.kind==='RECONCILED'));
console.log(JSON.stringify({client:'Synthetic Logistics Ltd',site:'Synthetic Distribution Centre',service:'24/7 Security Service',
 serviceId:service,week,datedShifts:detail.demands.length,workforceLines:workforce.total_lines,
 required:workforce.totals.required,allocated:workforce.totals.allocated,accepted:workforce.totals.accepted,
 availabilityConflicts:workforce.totals.availability_conflicts,nightEndsNextDay:night.shift_ends_at.slice(0,10)!==week}));
