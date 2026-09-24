import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const identities={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
 staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD]};
const person={office:'10000000-0000-4000-8000-000000000002',staffA:'10000000-0000-4000-8000-000000000003',staffB:'10000000-0000-4000-8000-000000000004'};
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await client.auth.signInWithPassword({email:identities[name][0],password:identities[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}

test('06C guarded allocation, Staff response and Event reconciliation', {timeout:180000}, async()=>{
 assert.ok(url&&key&&Object.values(identities).every((entry)=>entry[0]&&entry[1]));
 const [office,operations,staffA,staffB]=await Promise.all(Object.keys(identities).map(signed));
 const serviceDate=new Date(Date.UTC(2030+Math.floor(Math.random()*20),6,1+Math.floor(Math.random()*27))).toISOString().slice(0,10);
 const org=await rpc(office,'crm_create_organisation',{p_name:`06C Synthetic Client ${Date.now()}`});
 const won=await rpc(office,'crm_create_opportunity',{p_organisation:org,p_title:'Synthetic fixture work',p_type:'DIRECT_ENQUIRY',p_owner:person.office});
 await rpc(office,'crm_transition_opportunity',{p_id:won,p_stage:'WON'});
 const site=(await office.from('sites').insert({site_reference:`DEV-06C-${Date.now()}`,name:'Synthetic Football Ground',
  address_line1:'1 Example Street',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'Main gate',
  created_by_person_id:person.office,site_type:'STADIUM'}).select('id').single());assert.ifError(site.error);
 assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site.data.id)).error);
 await rpc(office,'operational_link_site',{p_site:site.data.id,p_organisation:org});
 const event=await rpc(office,'operational_create_event',{p_site:site.data.id,p_organisation:org,p_name:'Synthetic Football Fixture 06C',
  p_type:'FOOTBALL_MATCH',p_starts:`${serviceDate}T15:00:00+01:00`,p_ends:`${serviceDate}T17:00:00+01:00`,p_owner:person.office});
 const roles=await rpc(office,'staffing_role_choices',{});const role=Object.fromEntries(roles.map((item)=>[item.code,item.id]));
 const create=(code,qty,area,report=`${serviceDate}T12:30:00+01:00`,start=`${serviceDate}T13:00:00+01:00`,end=`${serviceDate}T18:00:00+01:00`)=>
  ({p_event:event,p_role:role[code],p_quantity:qty,p_report:report,p_start:start,p_end:end,p_area:area,
   p_instructions:'Synthetic planning only',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
 const manager=await rpc(office,'staffing_create_confirmed',create('STAND_MANAGER',1,'South Stand'));
 const supervisor=await rpc(office,'staffing_create_confirmed',create('STAND_SUPERVISOR',1,'South Stand'));
 const sia=await rpc(office,'staffing_create_confirmed',create('SIA',2,'Turnstiles'));
 const steward=await rpc(office,'staffing_create_confirmed',create('STEWARD',18,'South Stand'));
 assert.ok(manager&&supervisor&&sia&&steward);
 const siaCandidates=await rpc(office,'deployment_candidates',{p_event:event,p_requirement:sia,p_search:'',p_offset:0,p_limit:20});
 assert.equal(siaCandidates.items.find((item)=>item.id===person.staffA).check.policy_version,1);
 const syntheticSiaCandidate=siaCandidates.items.find((item)=>item.check.reasons.includes('SYNTHETIC_SIA_CHECK_SATISFIED'));
 assert.ok(syntheticSiaCandidate,'development-only exact synthetic SIA chain has a passing fixture');
 assert.equal(syntheticSiaCandidate.check.result,'REVIEW_REQUIRED','undeclared availability remains a separate review warning');
 assert.ok(siaCandidates.items.some((item)=>item.check.result==='BLOCKED'));
 assert.ok((await office.from('event_staff_allocations').select('id')).error);
 assert.ok((await office.from('event_staff_allocation_events').insert({allocation_id:crypto.randomUUID()})).error);
 assert.ok((await staffA.rpc('deployment_candidates',{p_event:event,p_requirement:steward})).error);
 assert.ok((await staffA.rpc('deployment_allocate',{p_event:event,p_requirement:steward,p_person:person.staffA,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Forged'})).error);
 const candidates=await rpc(operations,'deployment_candidates',{p_event:event,p_requirement:steward,p_search:'',p_offset:0,p_limit:20});
 assert.ok(candidates.items.some((item)=>item.id===person.staffA));
 const safe=JSON.stringify(candidates);for(const field of ['home_address','contact_email','mobile','sia_reference','document_version_id','filename'])assert.ok(!safe.includes(field));
 assert.equal(candidates.items.find((item)=>item.id===person.staffA).check.result,'REVIEW_REQUIRED');
 const allocationArgs={p_event:event,p_requirement:steward,p_person:person.staffA,p_expected_revision:1};
 assert.ok((await office.rpc('deployment_allocate',{...allocationArgs,p_acknowledge_warnings:false,p_reason:null})).error);
 assert.ok((await office.rpc('deployment_allocate',{...allocationArgs,p_event:'00000000-0000-4000-8000-000000000000',p_acknowledge_warnings:true,p_reason:'Forged Event'})).error);
 assert.ok((await office.rpc('deployment_allocate',{...allocationArgs,p_person:person.office,p_acknowledge_warnings:true,p_reason:'Self assignment'})).error);
 const allocation=await rpc(operations,'deployment_allocate',{...allocationArgs,p_acknowledge_warnings:true,p_reason:'Synthetic warning review'});
 assert.ok((await office.rpc('deployment_allocate',{...allocationArgs,p_acknowledge_warnings:true,p_reason:'Second person over capacity'})).error,
  'same Person cannot be allocated twice to an overlapping duty');
 const own=await rpc(staffA,'my_deployments',{});assert.ok(own.items.some((item)=>item.id===allocation));
 assert.equal((await rpc(staffB,'my_deployments',{})).items.some((item)=>item.id===allocation),false);
 assert.ok((await staffB.rpc('deployment_respond',{p_allocation:allocation,p_expected_revision:1,p_response:'ACCEPTED'})).error);
 assert.equal(await rpc(staffA,'deployment_respond',{p_allocation:allocation,p_expected_revision:1,p_response:'ACCEPTED'}),2);
 assert.ok((await staffA.rpc('deployment_respond',{p_allocation:allocation,p_expected_revision:1,p_response:'DECLINED',p_reason_code:'OTHER'})).error);
 let summary=await rpc(office,'deployment_event_summary',{p_event:event});assert.equal(summary.required,22);assert.equal(summary.allocated,1);assert.equal(summary.accepted,1);
 const secondActive=await rpc(office,'deployment_allocate',{...allocationArgs,p_person:person.staffB,p_acknowledge_warnings:true,p_reason:'Synthetic staffing review'});
 assert.ok((await office.rpc('staffing_amend_confirmed',{...create('STEWARD',18,'North Stand'),p_requirement:steward,p_expected_revision:1})).error,
  'active allocation freezes area/context until reconciliation');
 assert.ok((await office.rpc('operational_change_event',{p_event:event,p_action:'DATES',p_starts:`${serviceDate}T14:00:00+01:00`,
  p_ends:`${serviceDate}T18:00:00+01:00`})).error,'active allocations prevent Event date changes');
 assert.ok((await office.rpc('staffing_amend_confirmed',{...create('STEWARD',1,'South Stand'),p_requirement:steward,p_expected_revision:1})).error,
  'quantity below active allocation must be denied');
 assert.ok((await office.rpc('staffing_cancel',{p_event:event,p_requirement:steward,p_expected_revision:1,p_reason:'Need reconciliation'})).error);
 assert.equal(await rpc(staffB,'deployment_respond',{p_allocation:secondActive,p_expected_revision:1,p_response:'DECLINED',
  p_reason_code:'TIMING_CONFLICT',p_note:'Synthetic schedule conflict'}),2);
 assert.equal((await rpc(office,'deployment_event_summary',{p_event:event})).allocated,1,'decline releases capacity');
 assert.equal(await rpc(office,'deployment_cancel',{p_event:event,p_requirement:steward,p_allocation:allocation,p_expected_revision:2,p_reason:'Synthetic plan changed'}),3);
 summary=await rpc(operations,'deployment_event_summary',{p_event:event});assert.equal(summary.allocated,0);
 assert.equal(await rpc(staffA,'deployment_respond',{p_allocation:allocation,p_expected_revision:3,p_response:'ACCEPTED'}).catch(()=>null),null);
 const siaAllocation=await rpc(operations,'deployment_allocate',{p_event:event,p_requirement:sia,p_person:syntheticSiaCandidate.id,
  p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic rule v1 test only'});
 assert.ok(siaAllocation);
 await rpc(operations,'deployment_cancel',{p_event:event,p_requirement:sia,p_allocation:siaAllocation,p_expected_revision:1,p_reason:'Synthetic rule proof complete'});
 const late=(code,area)=>create(code,1,area,`${serviceDate}T19:00:00+01:00`,`${serviceDate}T19:30:00+01:00`,`${serviceDate}T22:00:00+01:00`);
 const capacityLine=await rpc(office,'staffing_create_confirmed',late('RESPONSE','Late response'));
 const capArgs=(target)=>({p_event:event,p_requirement:capacityLine,p_person:target,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic concurrency proof'});
 const capRace=await Promise.all([office.rpc('deployment_allocate',capArgs(person.staffA)),operations.rpc('deployment_allocate',capArgs(person.staffB))]);
 assert.equal(capRace.filter((result)=>!result.error).length,1,'capacity race admits exactly one');
 assert.equal(capRace.filter((result)=>Boolean(result.error)).length,1);
 const capacityWinner=capRace.find((result)=>!result.error).data;
 await rpc(office,'deployment_cancel',{p_event:event,p_requirement:capacityLine,p_allocation:capacityWinner,p_expected_revision:1,p_reason:'Concurrency proof complete'});
 const clashA=await rpc(office,'staffing_create_confirmed',late('SEARCH','Late search'));
 const clashB=await rpc(office,'staffing_create_confirmed',late('GATE_SECURITY','Late gate'));
 const clashArgs=(line)=>({p_event:event,p_requirement:line,p_person:person.staffA,p_expected_revision:1,p_acknowledge_warnings:true,p_reason:'Synthetic overlap proof'});
 const clashRace=await Promise.all([office.rpc('deployment_allocate',clashArgs(clashA)),operations.rpc('deployment_allocate',clashArgs(clashB))]);
 assert.equal(clashRace.filter((result)=>!result.error).length,1,'Person clash race admits exactly one');
 assert.equal(clashRace.filter((result)=>Boolean(result.error)).length,1);
 const clashWinner=clashRace.find((result)=>!result.error).data;
 const clashLine=clashRace[0].data ? clashA : clashB;
 await rpc(operations,'deployment_cancel',{p_event:event,p_requirement:clashLine,p_allocation:clashWinner,p_expected_revision:1,p_reason:'Concurrency proof complete'});
 const second=await rpc(office,'deployment_allocate',{...allocationArgs,p_acknowledge_warnings:true,p_reason:'New synthetic allocation'});
 assert.notEqual(second,allocation);
 await rpc(office,'operational_change_event',{p_event:event,p_action:'STATUS',p_status:'CANCELLED',p_reason:'Synthetic Event cancelled'});
 summary=await rpc(operations,'deployment_event_summary',{p_event:event});assert.equal(summary.allocated,0);
 let cancelledRow;
 for(let offset=0;offset<=10000;offset+=50){const page=await rpc(staffA,'my_deployments',{p_offset:offset,p_limit:50});
  cancelledRow=page.items.find((item)=>item.id===second);if(cancelledRow||offset+50>=page.total)break;}
 assert.equal(cancelledRow?.status,'CANCELLED','cancelled work remains in paginated Staff history');
 assert.ok((await office.rpc('deployment_allocate',{...allocationArgs,p_acknowledge_warnings:true,p_reason:'Terminal Event'})).error);
 assert.ok((await staffA.rpc('operational_event_detail',{p_event:event})).error);
});
