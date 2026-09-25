import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const people={office:'10000000-0000-4000-8000-000000000002',staffA:'10000000-0000-4000-8000-000000000003',
 staffB:'10000000-0000-4000-8000-000000000004'};
const credentials={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
 staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD]};
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:credentials[name][0],password:credentials[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}
async function allRows(client,name){
 const first=await rpc(client,name,{p_offset:0,p_limit:50});
 const items=[...first.items];
 for(let offset=50;offset<first.total;offset+=50){
  const page=await rpc(client,name,{p_offset:offset,p_limit:50});
  items.push(...page.items);
 }
 return {...first,items};
}

test('07A Staff availability, exact candidate result and accepted-deployment conflict', {timeout:180000}, async()=>{
 assert.ok(url&&key&&Object.values(credentials).every(([email,password])=>email&&password));
 const [office,operations,staffA,staffB]=await Promise.all(Object.keys(credentials).map(signed));
 const before=await rpc(staffA,'my_availability',{});
 const timeAwayBefore=await rpc(staffA,'time_away_list',{});
 let date;
 for(let days=90;days<=330;days+=3){
  const candidate=new Date(Date.now()+days*86400000).toISOString().slice(0,10);
  const preview=await rpc(staffA,'availability_preview',{p_starts:`${candidate}T12:00:00Z`,p_ends:`${candidate}T20:00:00Z`});
  if(preview.replaced.length===0&&preview.deployments.length===0){date=candidate;break;}
 }
 assert.ok(date,'a clear synthetic availability interval is required');
 const instant=(hour,minute='00')=>`${date}T${hour}:${minute}:00Z`;
 assert.ok((await office.rpc('my_availability',{})).error);
 assert.ok((await operations.rpc('availability_save',{p_state:'UNAVAILABLE',p_starts:instant('12'),p_ends:instant('20'),p_expected_revision:0})).error);
 assert.ok((await staffB.from('staff_availability_declarations').select('id')).error);
 assert.ok((await staffA.from('staff_availability_history').insert({person_id:people.staffA,kind:'CREATED'})).error);
 assert.ok((await staffA.rpc('availability_save',{p_state:'AVAILABLE',p_starts:instant('12'),
  p_ends:new Date(new Date(instant('12')).getTime()+32*86400000).toISOString(),p_note:null,
  p_expected_revision:before.revision,p_confirm_replace:false,p_acknowledge_deployment_conflict:false})).error,
  'a single declaration beyond the technical 31-day safeguard is denied');
 const first=await rpc(staffA,'availability_save',{p_state:'AVAILABLE',p_starts:instant('12'),p_ends:instant('20'),
  p_note:'Synthetic availability note',p_expected_revision:before.revision,p_confirm_replace:false,p_acknowledge_deployment_conflict:false});
 assert.equal(first,before.revision+1);
 assert.ok((await staffA.rpc('availability_save',{p_state:'UNAVAILABLE',p_starts:instant('16'),p_ends:instant('17'),
  p_note:null,p_expected_revision:before.revision,p_confirm_replace:true})).error,'stale revision must conflict');
 const org=await rpc(office,'crm_create_organisation',{p_name:`07A Synthetic Client ${Date.now()}`});
 const won=await rpc(office,'crm_create_opportunity',{p_organisation:org,p_title:'Synthetic availability fixture',
  p_type:'DIRECT_ENQUIRY',p_owner:people.office});
 await rpc(office,'crm_transition_opportunity',{p_id:won,p_stage:'WON'});
 const site=await office.from('sites').insert({site_reference:`DEV-07A-${Date.now()}`,name:'Synthetic Availability Ground',
  address_line1:'1 Example Road',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'Main gate',
  created_by_person_id:people.office,site_type:'STADIUM'}).select('id').single();assert.ifError(site.error);
 assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site.data.id)).error);
 await rpc(office,'operational_link_site',{p_site:site.data.id,p_organisation:org});
 const event=await rpc(office,'operational_create_event',{p_site:site.data.id,p_organisation:org,
  p_name:'Synthetic 07A fixture',p_type:'FOOTBALL_MATCH',p_starts:instant('15'),p_ends:instant('17'),p_owner:people.office});
 const roles=await rpc(office,'staffing_role_choices',{});const steward=roles.find((role)=>role.code==='STEWARD');assert.ok(steward);
 const create=(report,start,end,area)=>({p_event:event,p_role:steward.id,p_quantity:2,p_report:instant(report),
  p_start:instant(start),p_end:instant(end),p_area:area,p_instructions:'Synthetic proof only',
  p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
 const main=await rpc(office,'staffing_create_confirmed',create('13','13','18','South Stand'));
 const early=await rpc(office,'staffing_create_confirmed',create('10','10','14','North Stand'));
 const candidate=async(requirement,client=office)=>{
  const response=await rpc(client,'deployment_candidates',{p_event:event,p_requirement:requirement,p_search:'',p_offset:0,p_limit:20});
  return response.items.find((item)=>item.id===people.staffA);};
 assert.equal((await candidate(main)).check.availability,'DECLARED_AVAILABLE');
 assert.equal((await candidate(early)).check.availability,'NOT_FULLY_COVERED');
 const noDeclaration=await rpc(operations,'deployment_candidates',{p_event:event,p_requirement:main,p_search:'',p_offset:0,p_limit:20});
 assert.equal(noDeclaration.items.find((item)=>item.id===people.staffB).check.availability,'NOT_DECLARED');
 const safe=JSON.stringify(noDeclaration);for(const field of ['Synthetic availability note','starts_at','ends_at','home_address','contact_email','mobile','sia_reference','filename'])
  assert.ok(!safe.includes(field));
 const allocation=await rpc(office,'deployment_allocate',{p_event:event,p_requirement:main,p_person:people.staffA,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic role review'});
 await rpc(staffA,'deployment_respond',{p_allocation:allocation,p_expected_revision:1,p_response:'ACCEPTED'});
 const preview=await rpc(staffA,'availability_preview',{p_starts:instant('16'),p_ends:instant('17')});
 assert.ok(preview.replaced.length>=1);assert.ok(preview.deployments.some((item)=>item.id===allocation));
 assert.ok((await staffA.rpc('availability_save',{p_state:'UNAVAILABLE',p_starts:instant('16'),p_ends:instant('17'),
  p_note:null,p_expected_revision:first,p_confirm_replace:true,p_acknowledge_deployment_conflict:false})).error);
 const second=await rpc(staffA,'availability_save',{p_state:'UNAVAILABLE',p_starts:instant('16'),p_ends:instant('17'),
  p_note:null,p_expected_revision:first,p_confirm_replace:true,p_acknowledge_deployment_conflict:true});assert.equal(second,first+1);
 const after=await allRows(staffA,'my_availability');
 const pieces=after.items.filter((item)=>item.lifecycle==='CURRENT'&&
  new Date(item.starts_at)>=new Date(instant('12'))&&new Date(item.ends_at)<=new Date(instant('20')));
 const iso=(value)=>new Date(value).toISOString();
 assert.deepEqual(pieces.map((item)=>[item.state,iso(item.starts_at),iso(item.ends_at)]).sort((a,b)=>a[1].localeCompare(b[1])),[
  ['AVAILABLE',iso(instant('12')),iso(instant('16'))],['UNAVAILABLE',iso(instant('16')),iso(instant('17'))],
  ['AVAILABLE',iso(instant('17')),iso(instant('20'))]]);
 assert.equal((await candidate(main)).check.availability,'DECLARED_UNAVAILABLE');
 assert.equal((await candidate(main)).check.result,'BLOCKED');
 const own=await allRows(staffA,'my_deployments');
 const kept=own.items.find((item)=>item.id===allocation);assert.equal(kept.status,'ACCEPTED');
 assert.equal(kept.availability_conflict,'UNAVAILABLE_CONFLICT');
 const manager=await rpc(operations,'deployment_requirement',{p_event:event,p_requirement:main});
 assert.equal(manager.allocations.find((item)=>item.id===allocation).availability_conflict,'UNAVAILABLE_CONFLICT');
 const history=await allRows(staffA,'my_availability_history');
 assert.ok(history.items.some((item)=>item.kind==='REPLACED'));
 assert.ok(history.items.filter((item)=>item.kind==='FRAGMENT_CREATED').length>=2);
 const left=pieces.find((item)=>item.state==='AVAILABLE'&&new Date(item.starts_at).getTime()===new Date(instant('12')).getTime());
 assert.ok((await staffA.rpc('availability_cancel_ack',{p_declaration:left.id,p_expected_revision:second,
  p_acknowledge_deployment_conflict:false})).error,'removing accepted deployment coverage requires acknowledgement');
 const race=await Promise.all([staffA.rpc('availability_save',{p_state:'AVAILABLE',p_starts:instant('21'),p_ends:instant('22'),
  p_note:null,p_expected_revision:second,p_confirm_replace:false,p_acknowledge_deployment_conflict:false}),
  staffA.rpc('availability_save',{p_state:'AVAILABLE',p_starts:instant('22'),p_ends:instant('23'),
   p_note:null,p_expected_revision:second,p_confirm_replace:false,p_acknowledge_deployment_conflict:false})]);
 assert.equal(race.filter((item)=>!item.error).length,1,'one stale concurrent save is denied');
 assert.equal(race.filter((item)=>Boolean(item.error)).length,1);
 const raceRequirement=await rpc(office,'staffing_create_confirmed',create('19','19','20','Late gate'));
 const beforeRace=await rpc(staffA,'my_availability',{});
 const allocationRace=await Promise.all([
  staffA.rpc('availability_save',{p_state:'UNAVAILABLE',p_starts:instant('19'),p_ends:instant('20'),p_note:null,
   p_expected_revision:beforeRace.revision,p_confirm_replace:true,p_acknowledge_deployment_conflict:true}),
  office.rpc('deployment_allocate',{p_event:event,p_requirement:raceRequirement,p_person:people.staffA,
   p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic concurrent availability review'})]);
 assert.ifError(allocationRace[0].error,'availability save must serialise with an allocation');
 if (!allocationRace[1].error) {
  const current=await allRows(staffA,'my_deployments');
  assert.equal(current.items.find((item)=>item.id===allocationRace[1].data).availability_conflict,'UNAVAILABLE_CONFLICT');
  await rpc(office,'deployment_cancel',{p_event:event,p_requirement:raceRequirement,p_allocation:allocationRace[1].data,
   p_expected_revision:1,p_reason:'Concurrency fixture complete'});
 } else {
  assert.equal((await candidate(raceRequirement)).check.availability,'DECLARED_UNAVAILABLE');
 }
 await rpc(office,'deployment_cancel',{p_event:event,p_requirement:main,p_allocation:allocation,p_expected_revision:2,
  p_reason:'Synthetic availability conflict resolved'});
 const latest=await rpc(staffA,'my_availability',{});
 const joined=await rpc(staffA,'availability_save',{p_state:'AVAILABLE',p_starts:instant('16'),p_ends:instant('17'),
  p_note:null,p_expected_revision:latest.revision,p_confirm_replace:true,p_acknowledge_deployment_conflict:false});
 assert.equal((await candidate(main)).check.availability,'DECLARED_AVAILABLE','adjacent available fragments cover duty');
 assert.equal(await rpc(staffA,'availability_cancel_ack',{p_declaration:left.id,p_expected_revision:joined,
  p_acknowledge_deployment_conflict:false}),joined+1);
 assert.equal((await candidate(main)).check.availability,'NOT_FULLY_COVERED','removed coverage leaves a gap');
 const timeAwayAfter=await rpc(staffA,'time_away_list',{});
 assert.deepEqual(timeAwayAfter,timeAwayBefore,
  'same Staff availability and allocation changes cannot create or change Time Away requests');
 assert.ok((await staffA.rpc('availability_cancel_ack',{p_declaration:preview.replaced[0].id,p_expected_revision:joined+1,
  p_acknowledge_deployment_conflict:false})).error,
  'a superseded declaration cannot be cancelled');
});
