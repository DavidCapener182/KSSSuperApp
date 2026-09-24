import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const creds={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
 staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD]};
const ids={office:'10000000-0000-4000-8000-000000000002',staffA:'10000000-0000-4000-8000-000000000003',
 staffB:'10000000-0000-4000-8000-000000000004'};
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:creds[name][0],password:creds[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}
const plus=(date,days)=>new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
const monday=(date)=>plus(date,-((new Date(`${date}T00:00:00Z`).getUTCDay()+6)%7));

test('07B authorised week, gaps, explicit conflicts and own schedule', {timeout:180000}, async()=>{
 assert.ok(url&&key&&Object.values(creds).every(([email,password])=>email&&password));
 const [office,operations,staffA]=await Promise.all(['office','operations','staffA'].map(signed));
 const week=monday(plus(new Date().toISOString().slice(0,10),170+Math.floor(Math.random()*100)));
 const stamp=Date.now();
 const org=await rpc(office,'crm_create_organisation',{p_name:`07B Synthetic Client ${stamp}`});
 const won=await rpc(office,'crm_create_opportunity',{p_organisation:org,p_title:'Synthetic workforce fixture',
  p_type:'DIRECT_ENQUIRY',p_owner:ids.office});
 await rpc(office,'crm_transition_opportunity',{p_id:won,p_stage:'WON'});
 const site=(await office.from('sites').insert({site_reference:`DEV-07B-${stamp}`,name:'Synthetic Workforce Venue',
  address_line1:'1 Example Road',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'Main gate',
  created_by_person_id:ids.office,site_type:'VENUE'}).select('id').single());assert.ifError(site.error);
 assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site.data.id)).error);
 await rpc(office,'operational_link_site',{p_site:site.data.id,p_organisation:org});
 const at=(day,time)=>`${plus(week,day)}T${time}:00Z`;
 const festival=await rpc(office,'operational_create_event',{p_site:site.data.id,p_organisation:org,
  p_name:'07B Synthetic Festival',p_type:'FESTIVAL',p_starts:at(0,'10:00'),p_ends:at(2,'23:00'),p_owner:ids.office});
 const football=await rpc(office,'operational_create_event',{p_site:site.data.id,p_organisation:org,
  p_name:'07B Synthetic Fixture',p_type:'FOOTBALL_MATCH',p_starts:at(5,'15:00'),p_ends:at(5,'17:00'),p_owner:ids.office});
 const roles=await rpc(office,'staffing_role_choices',{});const steward=roles.find((item)=>item.code==='STEWARD');assert.ok(steward);
 const create=(event,quantity,day,report,start,end,area)=>rpc(office,'staffing_create_confirmed',{
  p_event:event,p_role:steward.id,p_quantity:quantity,p_report:at(day,report),p_start:at(day,start),
  p_end:end.includes('+')?at(day+1,end.replace('+','')):at(day,end),p_area:area,
  p_instructions:'Synthetic planning only',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
 await create(festival,3,0,'10:00','10:30','18:00','Main Gate');
 await create(festival,4,1,'10:00','10:30','18:00','Campsite');
 const overnight=await create(festival,2,1,'22:00','22:30','+03:00','Night Gate');
 const footballLine=await create(football,2,5,'12:30','13:00','18:00','South Stand');
 const a=await rpc(office,'deployment_allocate',{p_event:football,p_requirement:footballLine,p_person:ids.staffA,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic schedule test'});
 await rpc(staffA,'deployment_respond',{p_allocation:a,p_expected_revision:1,p_response:'ACCEPTED'});
 await rpc(operations,'deployment_allocate',{p_event:football,p_requirement:footballLine,p_person:ids.staffB,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic schedule test'});
 const preview=await rpc(staffA,'availability_preview',{p_starts:at(5,'14:00'),p_ends:at(5,'15:00')});
 const ownBefore=await rpc(staffA,'my_availability',{});
 await rpc(staffA,'availability_save',{p_state:'UNAVAILABLE',p_starts:at(5,'14:00'),p_ends:at(5,'15:00'),
  p_note:'Private synthetic availability note',p_expected_revision:ownBefore.revision,
  p_confirm_replace:preview.replaced.length>0,p_acknowledge_deployment_conflict:true});
 const args={p_week:week,p_client:`07B Synthetic Client ${stamp}`,p_offset:0,p_limit:40};
 const schedule=await rpc(office,'workforce_week',args);
 assert.equal(schedule.total_lines,4);assert.equal(schedule.totals.events,2);
 assert.equal(schedule.totals.required,11);assert.equal(schedule.totals.allocated,2);
 assert.equal(schedule.totals.accepted,1);assert.equal(schedule.totals.remaining,9);
 assert.equal(schedule.totals.gap_lines,3);assert.equal(schedule.totals.availability_conflicts,1);
 const footballRow=schedule.items.find((item)=>item.requirement_id===footballLine);
 assert.equal(footballRow.remaining,0);assert.equal(footballRow.accepted,1);
 assert.equal(footballRow.unavailable_conflicts,1);
 assert.equal(footballRow.allocations.find((item)=>item.person_id===ids.staffA).status,'ACCEPTED');
 assert.equal(schedule.items.find((item)=>item.requirement_id===overnight).service_date,plus(week,1));
 const safe=JSON.stringify(schedule);for(const privateField of ['Private synthetic availability note','sia_reference','home_address','contact_email','filename','instructions'])
  assert.ok(!safe.includes(privateField),`${privateField} omitted from manager projection`);
 const gaps=await rpc(operations,'workforce_week',{...args,p_gaps:true});assert.equal(gaps.total_lines,3);
 assert.equal(gaps.totals.remaining,9);assert.equal(gaps.totals.availability_conflicts,0);
 const conflicts=await rpc(operations,'workforce_week',{...args,p_conflicts:true});assert.equal(conflicts.total_lines,1);
 assert.equal(conflicts.totals.required,2);assert.equal(conflicts.totals.availability_conflicts,1);
 const choices=await rpc(operations,'workforce_filter_choices',{p_week:week});
 assert.ok(choices.events.some((item)=>item.id===festival));assert.ok(choices.roles.some((item)=>item.id===steward.id));
 const staffChoices=await rpc(operations,'workforce_staff_choices',{p_search:'Synthetic Security Staff A',p_offset:0,p_limit:20});
 assert.ok(staffChoices.items.some((item)=>item.id===ids.staffA));
 const person=await rpc(operations,'workforce_person_week',{p_person:ids.staffA,p_week:week});
 assert.ok(person.items.some((item)=>item.id===a&&item.availability_conflict==='UNAVAILABLE_CONFLICT'));
 const self=await rpc(staffA,'my_schedule',{p_week:week});
 assert.ok(self.work.some((item)=>item.id===a&&item.status==='ACCEPTED'));
 assert.ok(self.availability.some((item)=>item.state==='UNAVAILABLE'));
 assert.ok(!JSON.stringify(self).includes('Synthetic Security Staff B'));
 assert.ok((await staffA.rpc('workforce_week',{p_week:week})).error);
 assert.ok((await staffA.rpc('workforce_person_week',{p_person:ids.staffB,p_week:week})).error);
 assert.ok((await operations.rpc('my_schedule',{p_week:week})).error);
 assert.ok((await operations.from('staff_availability_declarations').select('note')).error);
 assert.equal((await rpc(office,'workforce_week',{p_week:week,p_event:'00000000-0000-4000-8000-000000000000'})).total_lines,0);
 assert.equal((await rpc(office,'workforce_person_week',{p_week:week,p_person:'00000000-0000-4000-8000-000000000000'})).total,0);
 assert.ok((await office.rpc('workforce_week',{p_week:plus(week,1)})).error,'non-Monday input denied');
});
