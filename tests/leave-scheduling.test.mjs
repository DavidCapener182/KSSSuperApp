import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const staffId='10000000-0000-4000-8000-000000000003';
const baseEvent='65000e7f-bb20-43b4-979b-a63d3a181633'; // Accepted synthetic 07A fixture.
const baseService='584a0997-c869-432d-9b32-aac3de1c6750'; // Accepted synthetic 08A fixture.
const team='c455d943-0c9d-402e-8c96-8c3c9eeb8fb4'; // Accepted synthetic 17B Team A.
const credentials={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 manager:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD]};
const id=()=>crypto.randomUUID();
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:credentials[name][0],password:credentials[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}
async function freeDays(staff,month,count=1){
 for(let start=1;start<=28-count;start++){
  const dates=Array.from({length:count},(_,index)=>`${month}-${String(start+index).padStart(2,'0')}`);
  const listed=await rpc(staff,'time_away_list',{p_from:dates[0],p_to:dates.at(-1),p_limit:50});
  if(!listed.items.some(item=>['APPROVED','CANCELLATION_REQUESTED'].includes(item.state))) return dates;
 }
 throw new Error(`No free synthetic dates in ${month}`);
}
async function leave(staff,manager,segments){const request=await rpc(staff,'time_away_save_draft',{
 p_request:null,p_category:'OTHER_TIME_AWAY',p_segments:segments,p_expected_revision:0,p_key:id()});
 await rpc(staff,'time_away_submit',{p_request:request,p_team:team,p_expected_revision:1,p_key:id()});
 const decisionKey=id();
 await rpc(manager,'time_away_transition',{p_request:request,p_action:'APPROVED',p_expected_revision:2,
  p_key:decisionKey,p_reason:'APPROVED_AS_REQUESTED'});
 assert.equal(await rpc(manager,'time_away_transition',{p_request:request,p_action:'APPROVED',p_expected_revision:2,
  p_key:decisionKey,p_reason:'APPROVED_AS_REQUESTED'}),3,'idempotent approval retry preserves one revision');
 return request;}

test('17C approved leave blocks new Event/static duty and acceptance while preserving existing allocations',
 {timeout:180000},async()=>{
 assert.equal(new URL(url).hostname.split('.')[0],'dnfhkmmnlbiabqypclqg');
 const [office,manager,staff]=await Promise.all(['office','manager','staff'].map(signed));
 const base=await rpc(office,'operational_event_detail',{p_event:baseEvent});
 const roles=await rpc(office,'staffing_role_choices',{});const role=roles.find(item=>item.code==='STEWARD');assert.ok(role);
 const suffix=Date.now();
 const [day]=await freeDays(staff,'2028-05');
 const instant=(hour)=>`${day}T${hour}:00+01:00`;
 const event=await rpc(office,'operational_create_event',{p_site:base.site_id,p_organisation:base.organisation_id,
  p_name:`17C Synthetic Leave Gate ${suffix}`,p_type:'CORPORATE_EVENT',
  p_starts:instant('09:00'),p_ends:instant('17:00'),p_owner:base.owner_person_id});
 const line=async(area,report,start,end)=>rpc(office,'staffing_create_confirmed',{p_event:event,p_role:role.id,
  p_quantity:3,p_report:report,p_start:start,p_end:end,p_area:area,p_instructions:'Synthetic 17C proof only',
  p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
 const first=await line('17C first allocation',instant('08:00'),instant('09:00'),instant('17:00'));
 const existing=await rpc(office,'deployment_allocate',{p_event:event,p_requirement:first,p_person:staffId,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic 17C warning review'});
 const before=await rpc(office,'deployment_requirement',{p_event:event,p_requirement:first});
 const [availabilityBefore,attendanceBefore,workTimeBefore]=await Promise.all([
  rpc(staff,'my_availability',{p_offset:0,p_limit:50}),
  rpc(office,'attendance_event_overview',{p_event:event,p_offset:0,p_limit:50}),
  rpc(staff,'event_work_time_self_read',{p_allocation:existing})]);
 const request=await leave(staff,manager,[{kind:'WHOLE_DAY',date:day}]);
 const after=await rpc(office,'deployment_requirement',{p_event:event,p_requirement:first});
 const [availabilityAfter,attendanceAfter,workTimeAfter]=await Promise.all([
  rpc(staff,'my_availability',{p_offset:0,p_limit:50}),
  rpc(office,'attendance_event_overview',{p_event:event,p_offset:0,p_limit:50}),
  rpc(staff,'event_work_time_self_read',{p_allocation:existing})]);
 assert.equal(availabilityAfter.revision,availabilityBefore.revision,'approval does not change Availability');
 assert.deepEqual(attendanceAfter,attendanceBefore,'approval does not change Attendance');
 assert.deepEqual(workTimeAfter,workTimeBefore,'approval does not change Worked Time');
 assert.equal(after.revision,before.revision,'approval does not change demand revision');
 assert.deepEqual(after.allocations.find(item=>item.id===existing),before.allocations.find(item=>item.id===existing),
  'leave approval does not mutate an existing allocation');
 const issues=await rpc(manager,'time_away_reconciliation_list',{p_source:'EVENT',p_allocation:existing});
 assert.equal(issues.filter(item=>item.status==='REVIEW_REQUIRED').length,1);
 assert.ok(!JSON.stringify(issues).includes('OTHER_TIME_AWAY')&&!JSON.stringify(issues).includes(request),
  'operational issue projection omits leave category and request identity');
 assert.ok((await manager.rpc('time_away_reconciliation_list',{p_source:'SITE_SHIFT',p_allocation:existing})).error,
  'forged typed source/allocation pair denied');
 assert.ok((await manager.from('time_away_reconciliation_issues').select('id')).error,'direct issue read denied');
 assert.ok((await manager.from('time_away_reconciliation_events').insert({issue_id:id(),revision:2,
  kind:'CLOSED',actor_person_id:staffId})).error,'direct issue history write denied');
 const second=await line('17C new allocation',instant('10:00'),instant('10:00'),instant('15:00'));
 const candidate=await rpc(manager,'deployment_candidates',{p_event:event,p_requirement:second,p_search:'',p_limit:50});
 const check=candidate.items.find(item=>item.id===staffId)?.check;assert.equal(check?.result,'BLOCKED');
 assert.ok(check.reasons.includes('APPROVED_TIME_AWAY_CONFLICT'));
 assert.ok(!JSON.stringify(check).includes('OTHER_TIME_AWAY')&&!JSON.stringify(check).includes(request),
  'candidate exposes only the safe scheduling reason');
 const denied=await office.rpc('deployment_allocate',{p_event:event,p_requirement:second,p_person:staffId,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic 17C warning review'});
 assert.match(denied.error?.message??'',/APPROVED_TIME_AWAY_CONFLICT/);
 const response=await staff.rpc('deployment_respond',{p_allocation:existing,p_expected_revision:1,p_response:'ACCEPTED'});
 assert.match(response.error?.message??'',/APPROVED_TIME_AWAY_CONFLICT/);
 assert.equal((await rpc(office,'deployment_requirement',{p_event:event,p_requirement:first})).allocations
  .find(item=>item.id===existing).status,'ALLOCATED');

 const staticDemand=await rpc(manager,'site_shift_extra',{p_service:baseService,p_service_date:day,
  p_role:role.id,p_quantity:3,p_report_at:instant('09:00'),
  p_shift_starts_at:instant('09:00'),p_shift_ends_at:instant('17:00'),
  p_area:'17C static proof',p_reporting:'Synthetic gate',p_reason:'Synthetic 17C proof'});
 const staticCandidates=await rpc(manager,'site_shift_candidates',{p_service:baseService,p_demand:staticDemand,
  p_search:'',p_limit:50});
 assert.ok(staticCandidates.items.find(item=>item.id===staffId)?.check.reasons.includes('APPROVED_TIME_AWAY_CONFLICT'));
 const staticDenied=await manager.rpc('site_shift_allocate',{p_service:baseService,p_demand:staticDemand,
  p_person:staffId,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic 17C warning review'});
 assert.match(staticDenied.error?.message??'',/APPROVED_TIME_AWAY_CONFLICT/);
 await rpc(staff,'time_away_transition',{p_request:request,p_action:'CANCELLATION_REQUESTED',
  p_expected_revision:3,p_key:id()});
 assert.ok((await rpc(manager,'deployment_candidates',{p_event:event,p_requirement:second,p_search:'',p_limit:50}))
  .items.find(item=>item.id===staffId)?.check.reasons.includes('APPROVED_TIME_AWAY_CONFLICT'));
 await rpc(manager,'time_away_transition',{p_request:request,p_action:'CANCELLATION_REJECTED',
  p_expected_revision:4,p_key:id(),p_reason:'CANCELLATION_NOT_SUPPORTED'});
 assert.ok((await rpc(manager,'deployment_candidates',{p_event:event,p_requirement:second,p_search:'',p_limit:50}))
  .items.find(item=>item.id===staffId)?.check.reasons.includes('APPROVED_TIME_AWAY_CONFLICT'));
 await rpc(staff,'time_away_transition',{p_request:request,p_action:'CANCELLATION_REQUESTED',
  p_expected_revision:5,p_key:id()});
 await rpc(manager,'time_away_transition',{p_request:request,p_action:'CANCELLATION_APPROVED',
  p_expected_revision:6,p_key:id(),p_reason:'CANCELLATION_ACCEPTED'});
 assert.ok(!(await rpc(manager,'deployment_candidates',{p_event:event,p_requirement:second,p_search:'',p_limit:50}))
  .items.find(item=>item.id===staffId)?.check.reasons.includes('APPROVED_TIME_AWAY_CONFLICT'));
 assert.equal((await rpc(manager,'time_away_reconciliation_list',{p_source:'EVENT',p_allocation:existing}))[0].status,
  'REVIEW_REQUIRED','final cancellation does not silently close issue');
 assert.ok((await manager.rpc('time_away_reconciliation_close',{p_issue:id(),p_expected_revision:1,
  p_reason:'Synthetic wrong issue review'})).error,'forged issue denied');
 await rpc(manager,'time_away_reconciliation_close',{p_issue:issues[0].id,p_expected_revision:1,
  p_reason:'Synthetic approved leave was finally cancelled; allocation reviewed'});
 assert.equal((await rpc(manager,'time_away_reconciliation_list',{p_source:'EVENT',p_allocation:existing}))[0].status,'CLOSED');
 assert.ok((await manager.rpc('time_away_reconciliation_close',{p_issue:issues[0].id,p_expected_revision:1,
  p_reason:'Synthetic stale closure retry must fail'})).error,'stale issue revision denied');
 assert.ok((await staff.rpc('time_away_reconciliation_list',{p_source:'EVENT',p_allocation:existing})).error);
 await rpc(office,'deployment_cancel',{p_event:event,p_requirement:first,p_allocation:existing,
  p_expected_revision:1,p_reason:'Synthetic 17C test cleanup'});
 console.log(JSON.stringify({event,first,second,staticDemand,request,issue:issues[0].id}));
});

test('17C static allocated and accepted duties become separate review issues with explicit closure',
 {timeout:180000},async()=>{
 assert.equal(new URL(url).hostname.split('.')[0],'dnfhkmmnlbiabqypclqg');
 const [manager,staff]=await Promise.all(['manager','staff'].map(signed));
 const roles=await rpc(manager,'staffing_role_choices',{});const role=roles.find(item=>item.code==='STEWARD');
 const days=await freeDays(staff,'2028-06',2);
 const demand=async(day,area)=>rpc(manager,'site_shift_extra',{p_service:baseService,p_service_date:day,
  p_role:role.id,p_quantity:2,p_report_at:`${day}T09:00:00+01:00`,
  p_shift_starts_at:`${day}T09:00:00+01:00`,p_shift_ends_at:`${day}T17:00:00+01:00`,
  p_area:area,p_reporting:'Synthetic proof',p_reason:'Synthetic 17C proof'});
 const [first,second]=await Promise.all([demand(days[0],'17C allocated static'),demand(days[1],'17C accepted static')]);
 const allocate=async(demandId)=>rpc(manager,'site_shift_allocate',{p_service:baseService,p_demand:demandId,
  p_person:staffId,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic 17C warning review'});
 const allocated=await allocate(first);
 const accepted=await allocate(second);
 await rpc(staff,'site_shift_respond',{p_allocation:accepted,p_expected_revision:1,p_response:'ACCEPTED'});
 const request=await leave(staff,manager,days.map(date=>({kind:'WHOLE_DAY',date})));
 const [firstIssues,secondIssues]=await Promise.all([
  rpc(manager,'time_away_reconciliation_list',{p_source:'SITE_SHIFT',p_allocation:allocated}),
  rpc(manager,'time_away_reconciliation_list',{p_source:'SITE_SHIFT',p_allocation:accepted})]);
 assert.equal(firstIssues.filter(item=>item.status==='REVIEW_REQUIRED').length,1);
 assert.equal(secondIssues.filter(item=>item.status==='REVIEW_REQUIRED').length,1);
 assert.equal((await rpc(manager,'site_shift_allocation_detail',{p_service:baseService,p_demand:first}))
  .allocations.find(item=>item.id===allocated).status,'ALLOCATED');
 assert.equal((await rpc(manager,'site_shift_allocation_detail',{p_service:baseService,p_demand:second}))
  .allocations.find(item=>item.id===accepted).status,'ACCEPTED');
 const denied=await staff.rpc('site_shift_respond',{p_allocation:allocated,p_expected_revision:1,p_response:'ACCEPTED'});
 assert.match(denied.error?.message??'',/APPROVED_TIME_AWAY_CONFLICT/);
 assert.ok((await manager.rpc('time_away_reconciliation_close',{p_issue:firstIssues[0].id,
  p_expected_revision:1,p_reason:'Synthetic review before operational resolution'})).error,
  'active approved overlap cannot be closed as accepted');
 await rpc(staff,'site_shift_respond',{p_allocation:allocated,p_expected_revision:1,p_response:'DECLINED',
  p_reason_code:'CANNOT_ATTEND'});
 await rpc(manager,'site_shift_cancel_allocation',{p_service:baseService,p_demand:second,
  p_allocation:accepted,p_expected_revision:2,p_reason:'Synthetic approved leave reconciliation'});
 for(const issue of [firstIssues[0],secondIssues[0]]){
  await rpc(manager,'time_away_reconciliation_close',{p_issue:issue.id,p_expected_revision:1,
   p_reason:'Synthetic operational duty resolved and reviewed'});
 }
 assert.equal((await rpc(manager,'time_away_reconciliation_list',{p_source:'SITE_SHIFT',p_allocation:accepted}))[0].status,'CLOSED');
 console.log(JSON.stringify({request,allocated,accepted,issues:[firstIssues[0].id,secondIssues[0].id]}));
});

test('17C partial boundaries, nonblocking states, overnight and London DST intervals',
 {timeout:180000},async()=>{
 assert.equal(new URL(url).hostname.split('.')[0],'dnfhkmmnlbiabqypclqg');
 const [office,manager,staff]=await Promise.all(['office','manager','staff'].map(signed));
 const base=await rpc(office,'operational_event_detail',{p_event:baseEvent});
 const roles=await rpc(office,'staffing_role_choices',{});const role=roles.find(item=>item.code==='STEWARD');
 const [day]=await freeDays(staff,'2028-07');
 const instant=(hour)=>`${day}T${hour}:00+01:00`;
 const event=await rpc(office,'operational_create_event',{p_site:base.site_id,p_organisation:base.organisation_id,
  p_name:`17C Synthetic Partial ${Date.now()}`,p_type:'CORPORATE_EVENT',p_starts:instant('09:00'),
  p_ends:instant('19:00'),p_owner:base.owner_person_id});
 const makeLine=(area,report,start,end)=>rpc(office,'staffing_create_confirmed',{p_event:event,p_role:role.id,
  p_quantity:2,p_report:report,p_start:start,p_end:end,p_area:area,p_instructions:'Synthetic 17C proof',
  p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
 const overlap=await makeLine('17C partial overlap',instant('11:00'),instant('11:00'),instant('13:00'));
 const candidate=async(duty)=>{const data=await rpc(manager,'deployment_candidates',{
  p_event:event,p_requirement:duty,p_search:'',p_limit:50});return data.items.find(item=>item.id===staffId)?.check;};
 const hasLeave=async(duty)=>(await candidate(duty))?.reasons.includes('APPROVED_TIME_AWAY_CONFLICT');
 const segment=[{kind:'PARTIAL_DAY',date:day,startsLocal:'10:00',endsLocal:'12:00'}];
 const draft=await rpc(staff,'time_away_save_draft',{p_request:null,p_category:'OTHER_TIME_AWAY',
  p_segments:segment,p_expected_revision:0,p_key:id()});
 assert.equal(await hasLeave(overlap),false,'draft does not hard-block');
 await rpc(staff,'time_away_submit',{p_request:draft,p_team:team,p_expected_revision:1,p_key:id()});
 assert.equal(await hasLeave(overlap),false,'submitted does not hard-block');
 await rpc(manager,'time_away_transition',{p_request:draft,p_action:'DECLINED',p_expected_revision:2,
  p_key:id(),p_reason:'REQUEST_NOT_SUPPORTED'});
 assert.equal(await hasLeave(overlap),false,'declined does not hard-block');
 const withdrawn=await rpc(staff,'time_away_save_draft',{p_request:null,p_category:'OTHER_TIME_AWAY',
  p_segments:segment,p_expected_revision:0,p_key:id()});
 await rpc(staff,'time_away_submit',{p_request:withdrawn,p_team:team,p_expected_revision:1,p_key:id()});
 await rpc(staff,'time_away_transition',{p_request:withdrawn,p_action:'WITHDRAWN',p_expected_revision:2,p_key:id()});
 assert.equal(await hasLeave(overlap),false,'withdrawn does not hard-block');
 const availabilityBefore=await rpc(staff,'my_availability',{p_offset:0,p_limit:50});
 const approved=await leave(staff,manager,segment);
 assert.equal(await hasLeave(overlap),true,'partial instant overlaps');
 const touching=await makeLine('17C touching partial end',instant('12:00'),instant('12:00'),instant('15:00'));
 assert.equal(await hasLeave(touching),false,'touching end is not overlap');
 const preceding=await makeLine('17C touching partial start',instant('08:00'),instant('08:00'),instant('10:00'));
 assert.equal(await hasLeave(preceding),false,'touching start is not overlap');
 const available=await office.rpc('deployment_allocate',{p_event:event,p_requirement:touching,p_person:staffId,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic partial nonoverlap'});
 assert.ifError(available.error);
 await rpc(office,'deployment_cancel',{p_event:event,p_requirement:touching,p_allocation:available.data,
  p_expected_revision:1,p_reason:'Synthetic boundary proof complete'});
 assert.equal((await rpc(staff,'my_availability',{p_offset:0,p_limit:50})).revision,availabilityBefore.revision,
  'Time Away does not mutate Availability');

 const dstDates=[
  {date:'2027-03-28',report:'2027-03-28T00:30:00+00:00',end:'2027-03-28T02:30:00+01:00'},
  {date:'2027-10-31',report:'2027-10-31T00:30:00+01:00',end:'2027-10-31T02:30:00+00:00'},
 ];
 for(const item of dstDates){
  const dstEvent=await rpc(office,'operational_create_event',{p_site:base.site_id,p_organisation:base.organisation_id,
   p_name:`17C Synthetic DST ${item.date} ${Date.now()}`,p_type:'CORPORATE_EVENT',
   p_starts:item.report,p_ends:item.end,p_owner:base.owner_person_id});
  const duty=await rpc(office,'staffing_create_confirmed',{p_event:dstEvent,p_role:role.id,p_quantity:2,
   p_report:item.report,p_start:item.report,p_end:item.end,p_area:'17C DST proof',
   p_instructions:'Synthetic 17C proof',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
  await leave(staff,manager,[{kind:'WHOLE_DAY',date:item.date}]);
  const check=(await rpc(manager,'deployment_candidates',{p_event:dstEvent,p_requirement:duty,p_search:'',p_limit:50}))
   .items.find(candidate=>candidate.id===staffId)?.check;
  assert.ok(check.reasons.includes('APPROVED_TIME_AWAY_CONFLICT'),`${item.date} whole London day overlaps`);
 }
 const overnightDate='2027-10-30';
 const overnight=await rpc(manager,'site_shift_extra',{p_service:baseService,p_service_date:overnightDate,
  p_role:role.id,p_quantity:2,p_report_at:'2027-10-30T22:00:00+01:00',
  p_shift_starts_at:'2027-10-30T22:00:00+01:00',p_shift_ends_at:'2027-10-31T06:00:00+00:00',
  p_area:'17C overnight DST',p_reporting:'Synthetic proof',p_reason:'Synthetic overnight overlap'});
 const nightCheck=(await rpc(manager,'site_shift_candidates',{p_service:baseService,p_demand:overnight,p_search:'',p_limit:50}))
  .items.find(candidate=>candidate.id===staffId)?.check;
 assert.ok(nightCheck.reasons.includes('APPROVED_TIME_AWAY_CONFLICT'),'overnight duty intersects following whole leave day');
 console.log(JSON.stringify({approved,event,overlap,touching,preceding,overnight}));
});

test('17C parallel approval, allocation, acceptance, cancellation and Event/static races',
 {timeout:180000},async()=>{
 assert.equal(new URL(url).hostname.split('.')[0],'dnfhkmmnlbiabqypclqg');
 const [office,manager,staff]=await Promise.all(['office','manager','staff'].map(signed));
 const base=await rpc(office,'operational_event_detail',{p_event:baseEvent});
 const roles=await rpc(office,'staffing_role_choices',{});const role=roles.find(item=>item.code==='STEWARD');
 const dates=await freeDays(staff,'2028-08',5);
 async function eventDuty(day,label){
  const event=await rpc(office,'operational_create_event',{p_site:base.site_id,p_organisation:base.organisation_id,
   p_name:`17C Synthetic Race ${label} ${Date.now()}`,p_type:'CORPORATE_EVENT',
   p_starts:`${day}T09:00:00+01:00`,p_ends:`${day}T17:00:00+01:00`,p_owner:base.owner_person_id});
  const duty=await rpc(office,'staffing_create_confirmed',{p_event:event,p_role:role.id,p_quantity:2,
   p_report:`${day}T09:00:00+01:00`,p_start:`${day}T09:00:00+01:00`,p_end:`${day}T17:00:00+01:00`,
   p_area:`17C ${label}`,p_instructions:'Synthetic concurrency proof',p_reason:null,
   p_confirm_duplicate:false,p_confirm_exception:false});
  return {event,duty};
 }
 async function staticDuty(day,label){const duty=await rpc(manager,'site_shift_extra',{
  p_service:baseService,p_service_date:day,p_role:role.id,p_quantity:2,
  p_report_at:`${day}T09:00:00+01:00`,p_shift_starts_at:`${day}T09:00:00+01:00`,
  p_shift_ends_at:`${day}T17:00:00+01:00`,p_area:`17C ${label}`,p_reporting:'Synthetic race',
  p_reason:'Synthetic concurrency proof'});return duty;}
 async function submitted(day){const request=await rpc(staff,'time_away_save_draft',{
  p_request:null,p_category:'OTHER_TIME_AWAY',p_segments:[{kind:'WHOLE_DAY',date:day}],
  p_expected_revision:0,p_key:id()});
  await rpc(staff,'time_away_submit',{p_request:request,p_team:team,p_expected_revision:1,p_key:id()});
  return request;}
 const approve=(request)=>manager.rpc('time_away_transition',{p_request:request,p_action:'APPROVED',
  p_expected_revision:2,p_key:id(),p_reason:'APPROVED_AS_REQUESTED'});
 const eventAllocate=(source)=>office.rpc('deployment_allocate',{p_event:source.event,p_requirement:source.duty,
  p_person:staffId,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic race warning review'});
 const staticAllocate=(duty)=>manager.rpc('site_shift_allocate',{p_service:baseService,p_demand:duty,
  p_person:staffId,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic race warning review'});

 const eventSource=await eventDuty(dates[0],'approval versus Event');
 const eventRequest=await submitted(dates[0]);
 const [eventDecision,eventResult]=await Promise.all([approve(eventRequest),eventAllocate(eventSource)]);
 assert.ifError(eventDecision.error);
 if(eventResult.error) assert.match(eventResult.error.message,/APPROVED_TIME_AWAY_CONFLICT/);
 else assert.equal((await rpc(manager,'time_away_reconciliation_list',{p_source:'EVENT',
  p_allocation:eventResult.data})).filter(issue=>issue.status==='REVIEW_REQUIRED').length,1);
 if(!eventResult.error){
  await rpc(office,'deployment_cancel',{p_event:eventSource.event,p_requirement:eventSource.duty,
   p_allocation:eventResult.data,p_expected_revision:1,p_reason:'Synthetic race cleanup'});
  const issue=(await rpc(manager,'time_away_reconciliation_list',{p_source:'EVENT',p_allocation:eventResult.data}))[0];
  await rpc(manager,'time_away_reconciliation_close',{p_issue:issue.id,p_expected_revision:1,
   p_reason:'Synthetic race allocation cancelled and reviewed'});
 }

 const staticSource=await staticDuty(dates[1],'approval versus static');
 const staticRequest=await submitted(dates[1]);
 const [staticDecision,staticResult]=await Promise.all([approve(staticRequest),staticAllocate(staticSource)]);
 assert.ifError(staticDecision.error);
 if(staticResult.error) assert.match(staticResult.error.message,/APPROVED_TIME_AWAY_CONFLICT/);
 else assert.equal((await rpc(manager,'time_away_reconciliation_list',{p_source:'SITE_SHIFT',
  p_allocation:staticResult.data})).filter(issue=>issue.status==='REVIEW_REQUIRED').length,1);
 if(!staticResult.error){
  await rpc(manager,'site_shift_cancel_allocation',{p_service:baseService,p_demand:staticSource,
   p_allocation:staticResult.data,p_expected_revision:1,p_reason:'Synthetic race cleanup'});
  const issue=(await rpc(manager,'time_away_reconciliation_list',{p_source:'SITE_SHIFT',p_allocation:staticResult.data}))[0];
  await rpc(manager,'time_away_reconciliation_close',{p_issue:issue.id,p_expected_revision:1,
   p_reason:'Synthetic static race allocation cancelled and reviewed'});
 }

 const acceptSource=await eventDuty(dates[2],'approval versus Staff acceptance');
 const toAccept=await rpc(office,'deployment_allocate',{p_event:acceptSource.event,p_requirement:acceptSource.duty,
  p_person:staffId,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic acceptance race'});
 const acceptRequest=await submitted(dates[2]);
 const [acceptDecision,acceptResult]=await Promise.all([approve(acceptRequest),staff.rpc('deployment_respond',{
  p_allocation:toAccept,p_expected_revision:1,p_response:'ACCEPTED'})]);
 assert.ifError(acceptDecision.error);
 if(acceptResult.error) assert.match(acceptResult.error.message,/APPROVED_TIME_AWAY_CONFLICT/);
 const current=(await rpc(office,'deployment_requirement',{p_event:acceptSource.event,p_requirement:acceptSource.duty}))
  .allocations.find(allocation=>allocation.id===toAccept);
 assert.equal(current.status,acceptResult.error?'ALLOCATED':'ACCEPTED');
 assert.equal((await rpc(manager,'time_away_reconciliation_list',{p_source:'EVENT',p_allocation:toAccept}))
  .filter(issue=>issue.status==='REVIEW_REQUIRED').length,1);
 await rpc(office,'deployment_cancel',{p_event:acceptSource.event,p_requirement:acceptSource.duty,
  p_allocation:toAccept,p_expected_revision:current.revision,p_reason:'Synthetic acceptance race cleanup'});
 const acceptIssue=(await rpc(manager,'time_away_reconciliation_list',{p_source:'EVENT',p_allocation:toAccept}))[0];
 await rpc(manager,'time_away_reconciliation_close',{p_issue:acceptIssue.id,p_expected_revision:1,
  p_reason:'Synthetic acceptance race allocation cancelled and reviewed'});

 const cancelSource=await eventDuty(dates[3],'cancellation versus Event');
 const cancelRequest=await leave(staff,manager,[{kind:'WHOLE_DAY',date:dates[3]}]);
 await rpc(staff,'time_away_transition',{p_request:cancelRequest,p_action:'CANCELLATION_REQUESTED',
  p_expected_revision:3,p_key:id()});
 const [cancelDecision,cancelResult]=await Promise.all([
  manager.rpc('time_away_transition',{p_request:cancelRequest,p_action:'CANCELLATION_APPROVED',
   p_expected_revision:4,p_key:id(),p_reason:'CANCELLATION_ACCEPTED'}),eventAllocate(cancelSource)]);
 assert.ifError(cancelDecision.error);
 if(cancelResult.error) assert.match(cancelResult.error.message,/APPROVED_TIME_AWAY_CONFLICT/);
 assert.equal((await rpc(staff,'time_away_detail',{p_request:cancelRequest})).state,'CANCELLED');
 const postCancelAllocation=cancelResult.error ? await rpc(office,'deployment_allocate',{
  p_event:cancelSource.event,p_requirement:cancelSource.duty,p_person:staffId,p_expected_revision:1,
  p_acknowledge_warnings:true,p_reason:'Synthetic final cancellation review'}) : cancelResult.data;
 await rpc(office,'deployment_cancel',{p_event:cancelSource.event,
  p_requirement:cancelSource.duty,p_allocation:postCancelAllocation,p_expected_revision:1,
  p_reason:'Synthetic cancellation race cleanup'});

 const sharedEvent=await eventDuty(dates[4],'Event versus static');
 const sharedStatic=await staticDuty(dates[4],'Event versus static');
 const [eventShared,staticShared]=await Promise.all([eventAllocate(sharedEvent),staticAllocate(sharedStatic)]);
 assert.equal([eventShared,staticShared].filter(result=>!result.error).length,1,
  'shared Person lock admits exactly one overlapping Event/static allocation');
 if(eventShared.error) await rpc(manager,'site_shift_cancel_allocation',{p_service:baseService,
  p_demand:sharedStatic,p_allocation:staticShared.data,p_expected_revision:1,p_reason:'Synthetic shared race cleanup'});
 else await rpc(office,'deployment_cancel',{p_event:sharedEvent.event,p_requirement:sharedEvent.duty,
  p_allocation:eventShared.data,p_expected_revision:1,p_reason:'Synthetic shared race cleanup'});
 console.log(JSON.stringify({eventRace:!!eventResult.error,staticRace:!!staticResult.error,
  acceptanceRace:!!acceptResult.error,cancellationRace:!!cancelResult.error,
  sharedWinner:eventShared.error?'SITE_SHIFT':'EVENT'}));
});
