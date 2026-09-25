import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const creds={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
 staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD],
 staffZero:[process.env.KSS_TEST_STAFF_ZERO_EMAIL,process.env.KSS_TEST_STAFF_ZERO_PASSWORD]};
const ids={office:'10000000-0000-4000-8000-000000000002',staffA:'10000000-0000-4000-8000-000000000003',
 staffB:'10000000-0000-4000-8000-000000000004',staffZero:'10000000-0000-4000-8000-000000000008'};
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:creds[name][0],password:creds[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}
const plus=(date,days)=>new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
const monday=(date)=>plus(date,(8-new Date(`${date}T00:00:00Z`).getUTCDay())%7);
const at=(day,time)=>`${day}T${time}:00Z`;

test('08A stable Site shift demand, strict capacity and shared Event clash', {timeout:180000}, async()=>{
 assert.ok(url&&key&&Object.values(creds).every(([email,password])=>email&&password));
 const [office,operations,staffA,staffB,staffZero]=await Promise.all(['office','operations','staffA','staffB','staffZero'].map(signed));
 const staffById=new Map([[ids.staffA,staffA],[ids.staffB,staffB],[ids.staffZero,staffZero]]);
 let day=monday(plus(new Date().toISOString().slice(0,10),35));let next=plus(day,1);const stamp=Date.now();
 const generationEnd=plus(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),56);
 const org=await rpc(office,'crm_create_organisation',{p_name:`08A Synthetic Logistics ${stamp}`});
 const won=await rpc(office,'crm_create_opportunity',{p_organisation:org,p_title:'Synthetic site shift fixture',
  p_type:'DIRECT_ENQUIRY',p_owner:ids.office});
 await rpc(office,'crm_transition_opportunity',{p_id:won,p_stage:'WON'});
 const site=await office.from('sites').insert({site_reference:`DEV-08A-${stamp}`,name:'Synthetic Distribution Centre',
  address_line1:'1 Example Road',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'Gatehouse',
  created_by_person_id:ids.office,site_type:'WAREHOUSE'}).select('id').single();assert.ifError(site.error);
 assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site.data.id)).error);
 await rpc(office,'operational_link_site',{p_site:site.data.id,p_organisation:org});
 const service=await rpc(office,'site_service_create',{p_site:site.data.id,p_name:'24/7 Security Service',
  p_type:'STATIC_GUARDING',p_effective_from:day,p_owner:ids.office});
 assert.ok((await operations.rpc('site_shift_template_publish',{p_service:service,p_line:null,p_effective_from:day,
  p_weekdays:[1,2,3,4,5,6,7],p_role:null,p_quantity:1,p_report:'06:00',p_starts:'06:00',p_ends:'18:00',
  p_area:'Gatehouse',p_reporting:'Gate 1',p_reason:'Denied template edit'})).error);
 await rpc(office,'site_service_transition',{p_service:service,p_state:'ACTIVE',p_effective_on:day,
  p_expected_revision:1,p_reason:'Synthetic ongoing service'});
 const roles=await rpc(office,'staffing_role_choices',{});const role=roles.find((item)=>item.code==='STEWARD');assert.ok(role);
 const line=await rpc(office,'site_shift_template_publish',{p_service:service,p_line:null,p_effective_from:day,
  p_weekdays:[1,2,3,4,5,6,7],p_role:role.id,p_quantity:1,p_report:'06:00',p_starts:'06:00',p_ends:'18:00',
  p_area:'Gatehouse',p_reporting:'Gate 1',p_reason:'Synthetic day duty'});
 assert.ok(line);
 let detail=await rpc(operations,'site_service_detail',{p_site:site.data.id,p_service:service,p_from:day,p_until:generationEnd});
 assert.ok(detail.demands.length>=7&&detail.demands.length<=56,'inspect only the generated forward horizon');
 let selected;
 for(const candidateDemand of detail.demands){
  if(candidateDemand.service_date>plus(generationEnd,-7))continue;
  const result=await rpc(operations,'site_shift_candidates',{p_service:service,p_demand:candidateDemand.id,
   p_search:'',p_offset:0,p_limit:20});
  const free=result.items.filter((item)=>staffById.has(item.id)&&item.check.result!=='BLOCKED');
  if(free.length<2)continue;
  const firstId=free[0].id,secondId=free[1].id;
  const firstClient=staffById.get(firstId),secondClient=staffById.get(secondId);
  const clearWindow=async(client,date)=>{
   const preview=await rpc(client,'availability_preview',{p_starts:at(date,'08:00'),p_ends:at(date,'09:00')});
   return preview.replaced.length===0&&preview.deployments.length===0;
  };
  if(await clearWindow(firstClient,candidateDemand.service_date)&&
   await clearWindow(secondClient,plus(candidateDemand.service_date,3))){
   selected={demand:candidateDemand,personId:firstId,otherPersonId:secondId};break;
  }
 }
 assert.ok(selected,'at least one synthetic staff fixture is available for this test date');
 const demand=selected.demand;day=demand.service_date;next=plus(day,1);assert.equal(demand.required_quantity,1);
 const siteStaffId=selected.personId;
 const otherStaffId=selected.otherPersonId;
 const siteStaff=staffById.get(siteStaffId);
 const otherStaff=staffById.get(otherStaffId);
 detail=await rpc(operations,'site_service_detail',{p_site:site.data.id,p_service:service,p_from:day,p_until:plus(day,7)});
 assert.equal((await rpc(office,'site_shift_generate',{p_service:service,p_from:day,p_until:plus(day,7)})),0);
 const allocation=await rpc(operations,'site_shift_allocate',{p_service:service,p_demand:demand.id,p_person:siteStaffId,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic review acknowledged'});
 assert.ok(allocation);
 assert.ok((await operations.rpc('site_shift_allocate',{p_service:service,p_demand:demand.id,p_person:otherStaffId,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic review acknowledged'})).error);
 await rpc(siteStaff,'site_shift_respond',{p_allocation:allocation,p_expected_revision:1,p_response:'ACCEPTED'});
 assert.ok((await otherStaff.rpc('site_shift_respond',{p_allocation:allocation,p_expected_revision:2,p_response:'DECLINED',
  p_reason_code:'CANNOT_ATTEND'})).error);
 const preview=await rpc(siteStaff,'availability_preview',{p_starts:at(day,'07:00'),p_ends:at(day,'08:00')});
 assert.ok(preview.deployments.some((item)=>item.id===allocation&&item.source==='SITE_SHIFT'));
 const beforeConflict=await rpc(siteStaff,'my_availability',{});
 assert.ok((await siteStaff.rpc('availability_save',{p_state:'UNAVAILABLE',p_starts:at(day,'08:00'),
  p_ends:at(day,'09:00'),p_note:'Private synthetic test note',p_expected_revision:beforeConflict.revision,
  p_confirm_replace:true,p_acknowledge_deployment_conflict:false})).error);
 await rpc(siteStaff,'availability_save',{p_state:'UNAVAILABLE',p_starts:at(day,'08:00'),
  p_ends:at(day,'09:00'),p_note:'Private synthetic test note',p_expected_revision:beforeConflict.revision,
  p_confirm_replace:true,p_acknowledge_deployment_conflict:true});
 const createdAvailability=async(client,state,date)=>{
  const current=await rpc(client,'my_availability',{p_offset:0,p_limit:50});
  const row=current.items.find((item)=>item.lifecycle==='CURRENT'&&item.state===state&&
   Date.parse(item.starts_at)===Date.parse(at(date,'08:00'))&&Date.parse(item.ends_at)===Date.parse(at(date,'09:00')));
  assert.ok(row,'the test-created availability declaration is identifiable for cleanup');
  return row.id;
 };
 const siteAvailabilityId=await createdAvailability(siteStaff,'UNAVAILABLE',day);
 const event=await rpc(office,'operational_create_event',{p_site:site.data.id,p_organisation:org,
  p_name:'Synthetic delivery Event',p_type:'CORPORATE_EVENT',p_starts:at(day,'07:00'),p_ends:at(day,'12:00'),p_owner:ids.office});
 const eventLine=await rpc(office,'staffing_create_confirmed',{p_event:event,p_role:role.id,p_quantity:1,
  p_report:at(day,'07:00'),p_start:at(day,'07:30'),p_end:at(day,'12:00'),p_area:'Gatehouse',
  p_instructions:'Synthetic planning only',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
 assert.ok((await office.rpc('deployment_allocate',{p_event:event,p_requirement:eventLine,p_person:siteStaffId,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic review acknowledged'})).error);
 const eventAllocation=await rpc(office,'deployment_allocate',{p_event:event,p_requirement:eventLine,p_person:otherStaffId,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic review acknowledged'});
 assert.ok((await office.rpc('site_shift_allocate',{p_service:service,p_demand:demand.id,p_person:otherStaffId,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic review acknowledged'})).error);
 assert.ok(eventAllocation);
 assert.ok((await operations.from('site_services').select('id')).error);
 const crmDenied=await operations.from('crm_opportunities').select('id');
 assert.ok(crmDenied.error||!crmDenied.data?.length);
 const profileDenied=await operations.from('person_profiles').select('person_id');
 assert.ok(profileDenied.error||!profileDenied.data?.length);
 assert.ok((await otherStaff.rpc('site_shift_allocation_detail',{p_service:service,p_demand:demand.id})).error);
 assert.ok((await operations.rpc('site_service_detail',{p_site:'00000000-0000-4000-8000-000000000000',
  p_service:service,p_from:day,p_until:next})).error);
 assert.ok((await operations.from('site_shift_demand_events').insert({demand_id:demand.id,service_id:service,
  kind:'CANCELLED',revision:20,snapshot:{},actor_person_id:ids.office})).error);
 assert.ok((await otherStaff.rpc('site_service_detail',{p_site:site.data.id,p_service:service,p_from:day,p_until:plus(day,7)})).error);
 assert.ok((await operations.rpc('site_shift_amend',{p_service:service,p_demand:demand.id,p_expected_revision:1,
  p_kind:'CHANGE_QUANTITY',p_quantity:0,p_reason:'Capacity reduction denied'})).error);
 const gap=detail.demands.find((item)=>item.service_date===next);assert.equal(gap.allocated,0);
 const weekStart=plus(day,-((new Date(`${day}T00:00:00Z`).getUTCDay()+6)%7));
 const mixed=await rpc(office,'workforce_week_08a',{p_week:weekStart,p_client:`08A Synthetic Logistics ${stamp}`});
 assert.equal(mixed.total_lines,8);assert.equal(mixed.totals.services,1);assert.equal(mixed.totals.events,1);
 assert.ok(mixed.items.some((item)=>item.source==='SITE_SHIFT'&&item.requirement_id===demand.id&&item.accepted===1));
 assert.ok(mixed.items.some((item)=>item.source==='EVENT'&&item.requirement_id===eventLine));
 const own=await rpc(siteStaff,'my_schedule_08a',{p_week:weekStart});
 assert.ok(own.work.some((item)=>item.source==='SITE_SHIFT'&&item.id===allocation));
 assert.ok(!own.work.some((item)=>item.id===eventAllocation));
 const deployments=await rpc(siteStaff,'my_deployments_08a',{});
 const allDeployments=[...deployments.items];
 for(let offset=25;offset<deployments.total;offset+=25){
  const page=await rpc(siteStaff,'my_deployments_08a',{p_offset:offset});
  allDeployments.push(...page.items);
 }
 assert.ok(allDeployments.some((item)=>item.source==='SITE_SHIFT'&&item.id===allocation));
 assert.equal((await rpc(siteStaff,'my_deployments_08a',{p_focus:eventAllocation})).total,0);
 const person=await rpc(operations,'workforce_person_week_08a',{p_person:siteStaffId,p_week:weekStart});
 assert.ok(person.items.some((item)=>item.source==='SITE_SHIFT'&&item.id===allocation));
 const choices=await rpc(operations,'workforce_filter_choices_08a',{p_week:weekStart});
 assert.ok(choices.sites.some((item)=>item.id===site.data.id));
 const boundaryDemand=await rpc(operations,'site_shift_extra',{p_service:service,p_service_date:day,p_role:role.id,
  p_quantity:1,p_report_at:at(day,'18:00'),p_shift_starts_at:at(day,'18:00'),p_shift_ends_at:at(day,'22:00'),
  p_area:'Evening gate',p_reporting:'Gate 2',p_reason:'Synthetic equal-boundary cover'});
 const boundaryAllocation=await rpc(operations,'site_shift_allocate',{p_service:service,p_demand:boundaryDemand,p_person:siteStaffId,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic equal boundary'});
 assert.ok(boundaryAllocation);
 await rpc(operations,'site_shift_cancel_allocation',{p_service:service,p_demand:boundaryDemand,p_allocation:boundaryAllocation,
  p_expected_revision:1,p_reason:'Synthetic boundary test complete'});
 const raceEvent=await rpc(office,'operational_create_event',{p_site:site.data.id,p_organisation:org,
  p_name:'Synthetic race Event',p_type:'CORPORATE_EVENT',p_starts:at(next,'07:00'),p_ends:at(next,'12:00'),p_owner:ids.office});
 const raceLine=await rpc(office,'staffing_create_confirmed',{p_event:raceEvent,p_role:role.id,p_quantity:1,
  p_report:at(next,'07:00'),p_start:at(next,'07:30'),p_end:at(next,'12:00'),p_area:'Race fixture',
  p_instructions:'Synthetic planning only',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
 const raceCandidates=await rpc(operations,'site_shift_candidates',{p_service:service,p_demand:gap.id,p_search:'',p_offset:0,p_limit:20});
 const raceStaffId=raceCandidates.items.find((item)=>[ids.staffA,ids.staffB].includes(item.id)&&item.check.result!=='BLOCKED')?.id;
 assert.ok(raceStaffId,'race fixture person must be unallocated and available');
 const [eventRace,siteRace]=await Promise.all([
  office.rpc('deployment_allocate',{p_event:raceEvent,p_requirement:raceLine,p_person:raceStaffId,
   p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic cross-source race'}),
  operations.rpc('site_shift_allocate',{p_service:service,p_demand:gap.id,p_person:raceStaffId,
   p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic cross-source race'})]);
 assert.equal(Number(!eventRace.error)+Number(!siteRace.error),1,'exactly one overlapping allocation commits');
 if(!eventRace.error) await rpc(office,'deployment_cancel',{p_event:raceEvent,p_requirement:raceLine,
  p_allocation:eventRace.data,p_expected_revision:1,p_reason:'Synthetic race complete'});
 if(!siteRace.error) await rpc(office,'site_shift_cancel_allocation',{p_service:service,p_demand:gap.id,
  p_allocation:siteRace.data,p_expected_revision:1,p_reason:'Synthetic race complete'});
 const unavailableDay=plus(day,3);
 const availabilityBefore=await rpc(otherStaff,'my_availability',{});
 await rpc(otherStaff,'availability_save',{p_state:'UNAVAILABLE',p_starts:at(unavailableDay,'08:00'),
  p_ends:at(unavailableDay,'09:00'),p_note:'Private synthetic test note',p_expected_revision:availabilityBefore.revision,
  p_confirm_replace:true,p_acknowledge_deployment_conflict:true});
 const otherAvailabilityId=await createdAvailability(otherStaff,'UNAVAILABLE',unavailableDay);
 const unavailableDemand=detail.demands.find((item)=>item.service_date===unavailableDay);
 assert.ok((await office.rpc('site_shift_allocate',{p_service:service,p_demand:unavailableDemand.id,p_person:otherStaffId,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Must remain blocked'})).error);
 const lineId=detail.templates[0].line_id;
 await rpc(office,'site_shift_template_publish',{p_service:service,p_line:lineId,p_effective_from:next,
  p_weekdays:[1,2,3,4,5,6,7],p_role:role.id,p_quantity:2,p_report:'06:00',p_starts:'06:00',p_ends:'18:00',
  p_area:'Gatehouse',p_reporting:'Gate 1',p_reason:'Synthetic quantity version boundary'});
 const afterVersion=await rpc(office,'site_service_detail',{p_site:site.data.id,p_service:service,p_from:day,p_until:plus(day,7)});
 const sameNext=afterVersion.demands.find((item)=>item.service_date===next);
 assert.equal(sameNext.id,gap.id);assert.equal(sameNext.revision,2);assert.equal(sameNext.required_quantity,2);
 assert.equal(afterVersion.demands[0].required_quantity,1);
 const exceptionTarget=afterVersion.demands.find((item)=>item.service_date===plus(day,2));
 await rpc(operations,'site_shift_amend',{p_service:service,p_demand:exceptionTarget.id,p_expected_revision:2,
  p_kind:'CHANGE_QUANTITY',p_quantity:3,p_report_at:null,p_shift_starts_at:null,p_shift_ends_at:null,
  p_area:null,p_reporting:null,p_reason:'Synthetic dated extra guard'});
 const history=await rpc(office,'site_service_history',{p_site:site.data.id,p_service:service});
 assert.ok(history.items.some((item)=>item.source==='DATED_SHIFT'&&item.record_id===gap.id&&item.kind==='RECONCILED'));
 assert.ok(history.items.some((item)=>item.source==='DATED_SHIFT'&&item.record_id===exceptionTarget.id&&item.kind==='EXCEPTION'));
 assert.ok((await operations.rpc('site_shift_template_publish',{p_service:service,p_line:lineId,p_effective_from:plus(day,3),
  p_weekdays:[1],p_role:role.id,p_quantity:1,p_report:'06:00',p_starts:'06:00',p_ends:'18:00',
  p_area:'Gatehouse',p_reporting:'Gate 1',p_reason:'Denied template edit'})).error);
 await rpc(office,'site_service_transition',{p_service:service,p_state:'PAUSED',p_effective_on:plus(day,4),
  p_resume_on:plus(day,5),p_expected_revision:2,p_reason:'Synthetic one-day pause'});
 const afterPause=await rpc(office,'site_service_detail',{p_site:site.data.id,p_service:service,p_from:day,p_until:plus(day,7)});
 assert.equal(afterPause.demands.find((item)=>item.service_date===plus(day,4)).state,'PLANNED');
 assert.equal(afterPause.demands.find((item)=>item.service_date===plus(day,4)).id,
  detail.demands.find((item)=>item.service_date===plus(day,4)).id);
 assert.equal(afterPause.demands.find((item)=>item.service_date===plus(day,5)).state,'PLANNED');
 await rpc(office,'site_shift_cancel_allocation',{p_service:service,p_demand:demand.id,p_allocation:allocation,
  p_expected_revision:2,p_reason:'Synthetic test completed'});
 await rpc(office,'site_service_transition',{p_service:service,p_state:'ACTIVE',p_effective_on:plus(day,5),
  p_expected_revision:3,p_reason:'Synthetic resume after pause'});
 const afterResume=await rpc(office,'site_service_detail',{p_site:site.data.id,p_service:service,p_from:day,p_until:plus(day,7)});
 assert.equal(afterResume.demands.find((item)=>item.service_date===plus(day,4)).state,'PLANNED');
 assert.equal(afterResume.demands.find((item)=>item.service_date===plus(day,4)).id,
  detail.demands.find((item)=>item.service_date===plus(day,4)).id);
 await rpc(office,'site_service_transition',{p_service:service,p_state:'ENDED',p_effective_on:plus(day,6),
  p_expected_revision:4,p_reason:'Synthetic service end'});
 const afterEnd=await rpc(office,'site_service_detail',{p_site:site.data.id,p_service:service,p_from:day,p_until:plus(day,7)});
 for(const serviceDate of [plus(day,4),plus(day,5),plus(day,6)]){
  const existing=detail.demands.find((item)=>item.service_date===serviceDate);
  const retained=afterEnd.demands.find((item)=>item.service_date===serviceDate);
  assert.equal(retained?.id,existing?.id);
  assert.equal(retained?.state,'PLANNED');
 }
 assert.ok((await office.rpc('deployment_allocate',{p_event:event,p_requirement:eventLine,p_person:ids.staffA,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Unavailable remains blocked'})).error);
 await rpc(office,'deployment_cancel',{p_event:event,p_requirement:eventLine,p_allocation:eventAllocation,
  p_expected_revision:1,p_reason:'Synthetic test completed'});
 for(const [client,declaration] of [[siteStaff,siteAvailabilityId],[otherStaff,otherAvailabilityId]]){
  const latest=await rpc(client,'my_availability',{});
  await rpc(client,'availability_cancel_ack',{p_declaration:declaration,p_expected_revision:latest.revision,
   p_acknowledge_deployment_conflict:true});
 }
 const dstService=await rpc(office,'site_service_create',{p_site:site.data.id,p_name:'Synthetic DST Boundary Service',
  p_type:'STATIC_GUARDING',p_effective_from:'2026-10-19',p_owner:ids.office});
 await rpc(office,'site_shift_template_publish',{p_service:dstService,p_line:null,p_effective_from:'2026-10-19',
  p_weekdays:[7],p_role:role.id,p_quantity:1,p_report:'01:30',p_starts:'02:00',p_ends:'03:00',
  p_area:'DST gate',p_reporting:'Gate 3',p_reason:'Synthetic autumn DST rejection'});
 const ambiguousActivation=await office.rpc('site_service_transition',{p_service:dstService,p_state:'ACTIVE',
  p_effective_on:'2026-10-19',p_expected_revision:1,p_reason:'Synthetic autumn DST proof'});
 assert.match(ambiguousActivation.error?.message??'',/Local shift time does not exist or is ambiguous/,
  'the 08A generator rejects the repeated London 01:30 on 25 October 2026');
 const dstDetail=await rpc(operations,'site_service_detail',{p_site:site.data.id,p_service:dstService,
  p_from:'2026-10-25',p_until:'2026-10-26'});
 assert.equal(dstDetail.service.state,'DRAFT','rejected DST activation leaves the Service unchanged');
 assert.equal(dstDetail.demands.length,0,'rejected DST activation materialises no partial demand');
});
