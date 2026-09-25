import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { londonDueToIso } from '../src/lib/crm/due-time.ts';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const creds={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD]};
const officePerson='10000000-0000-4000-8000-000000000002';
async function signed(role){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(c,{email:creds[role][0],password:creds[role][1]});assert.ifError(error);return c;}
async function rpc(c,name,args){const {data,error}=await c.rpc(name,args);assert.ifError(error);return data;}

test('06B exact staffing demand, history, time and Operations authority', {timeout:180000}, async()=>{
 assert.ok(url&&key&&Object.values(creds).every((v)=>v[0]&&v[1]));
 const [office,operations,staff]=await Promise.all(Object.keys(creds).map(signed));
 const roles=await rpc(office,'staffing_role_choices',{});const role=Object.fromEntries(roles.map((r)=>[r.code,r.id]));
 assert.equal(roles.length,9);assert.ok(role.SIA&&role.STEWARD);assert.ok((await staff.rpc('staffing_role_choices',{})).error);
 assert.ok((await office.from('event_staffing_requirements').select('id')).error);
 assert.ok((await operations.from('event_staffing_requirement_revisions').select('id')).error);
 assert.ok((await staff.rpc('staffing_plan',{p_event:'b2fef3a7-68ae-4241-a1ce-2a9cb36c8490'})).error);
 const org=await rpc(office,'crm_create_organisation',{p_name:`06B Festival ${Date.now()}`});
 const opportunity=await rpc(office,'crm_create_opportunity',{p_organisation:org,p_title:'Synthetic staffing work',p_type:'DIRECT_ENQUIRY',p_owner:officePerson});
 await rpc(office,'crm_transition_opportunity',{p_id:opportunity,p_stage:'WON'});
 const site=(await office.from('sites').insert({site_reference:`DEV-06B-${Date.now()}`,name:'Synthetic Festival Field',
  address_line1:'1 Example Lane',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'North gate',
  created_by_person_id:officePerson,site_type:'FESTIVAL_SITE'}).select('id').single());assert.ifError(site.error);
 assert.ifError((await office.from('sites').update({status:'ACTIVE'}).eq('id',site.data.id)).error);
 await rpc(office,'operational_link_site',{p_site:site.data.id,p_organisation:org});
 const event=await rpc(office,'operational_create_event',{p_site:site.data.id,p_organisation:org,p_name:'Synthetic Three Day Festival',
  p_type:'FESTIVAL',p_starts:'2027-07-02T09:00:00+01:00',p_ends:'2027-07-04T23:00:00+01:00',p_owner:officePerson});
 const create=(roleId,qty,report,start,end,area,extra={})=>({p_event:event,p_role:roleId,p_quantity:qty,p_report:report,
  p_start:start,p_end:end,p_area:area,p_instructions:'Synthetic planning only',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false,...extra});
 const friday=create(role.STEWARD,20,'2027-07-02T08:00:00+01:00','2027-07-02T09:00:00+01:00','2027-07-02T22:00:00+01:00','Main gate');
 assert.ok((await office.rpc('staffing_create',friday)).error,'internal helper has no authenticated EXECUTE');
 const first=await rpc(operations,'staffing_create_confirmed',friday);
 assert.ok((await office.rpc('staffing_create_confirmed',friday)).error,'duplicate requires deliberate confirmation');
 const duplicate=await rpc(office,'staffing_create_confirmed',{...friday,p_confirm_duplicate:true});assert.notEqual(duplicate,first);
 const second=await rpc(office,'staffing_create_confirmed',create(role.STEWARD,35,'2027-07-03T08:00:00+01:00',
  '2027-07-03T09:00:00+01:00','2027-07-03T23:00:00+01:00','Main gate'));
 const third=await rpc(office,'staffing_create_confirmed',create(role.STEWARD,30,'2027-07-04T08:00:00+01:00',
  '2027-07-04T09:00:00+01:00','2027-07-04T23:30:00+01:00','Main gate'));
 assert.ok(first&&second&&third);
 const cross=await rpc(operations,'staffing_create_confirmed',create(role.SIA,4,'2027-07-03T20:00:00+01:00',
  '2027-07-03T21:00:00+01:00','2027-07-04T06:00:00+01:00','Campsite A'));
 assert.ok(cross);
 assert.ok((await office.rpc('staffing_create_confirmed',create(role.SIA,1,'2027-07-01T21:00:00+01:00',
  '2027-07-02T00:00:00+01:00','2027-07-02T06:00:00+01:00','Outside date'))).error);
 assert.ok((await office.rpc('staffing_create_confirmed',create(role.SIA,1,'2027-07-02T08:00:00+01:00',
  '2027-07-02T09:00:00+01:00','2027-07-03T12:00:00+01:00','Long shift'))).error);
 const long=await rpc(office,'staffing_create_confirmed',create(role.SIA,1,'2027-07-02T08:00:00+01:00',
  '2027-07-02T09:00:00+01:00','2027-07-03T12:00:00+01:00','Long shift',
  {p_reason:'Deliberate synthetic long cover',p_confirm_exception:true}));assert.ok(long);
 assert.ok((await office.rpc('staffing_create_confirmed',create(role.SIA,1,'2027-07-02T08:00:00+01:00',
  '2027-07-02T09:00:00+01:00','2027-07-17T12:00:00+01:00','Impossible length',
  {p_reason:'Synthetic test exception',p_confirm_exception:true}))).error);
 assert.ok((await office.rpc('staffing_create_confirmed',create(role.SIA,150,'2027-07-02T08:00:00+01:00',
  '2027-07-02T09:00:00+01:00','2027-07-02T12:00:00+01:00','Large demand'))).error);
 const large=await rpc(office,'staffing_create_confirmed',create(role.SIA,150,'2027-07-02T08:00:00+01:00',
  '2027-07-02T09:00:00+01:00','2027-07-02T12:00:00+01:00','Large demand',{p_confirm_exception:true}));
 assert.ok((await office.rpc('staffing_create_confirmed',create(role.RESPONSE,1,'2027-07-02T00:00:00+01:00',
  '2027-07-02T13:00:00+01:00','2027-07-02T18:00:00+01:00','Early report'))).error);
 const early=await rpc(office,'staffing_create_confirmed',create(role.RESPONSE,1,'2027-07-02T00:00:00+01:00',
  '2027-07-02T13:00:00+01:00','2027-07-02T18:00:00+01:00','Early report',
  {p_reason:'Synthetic early reporting exception',p_confirm_exception:true}));assert.ok(early);
 assert.ok((await office.rpc('staffing_create_confirmed',create(role.SIA,1,'2027-03-28T01:30:00+00:00',
  '2027-07-02T09:00:00+01:00','2027-07-02T12:00:00+01:00','Invalid date'))).error);
 let plan=await rpc(office,'staffing_plan',{p_event:event});assert.equal(plan.required_total,20+20+35+30+4+1+150+1);
 assert.equal(plan.items.filter((r)=>r.service_date==='2027-07-03').length,2);
 assert.ok((await office.rpc('staffing_amend_confirmed',{...friday,p_requirement:first,p_expected_revision:9,p_quantity:22})).error);
 assert.equal(await rpc(operations,'staffing_amend_confirmed',{...friday,p_requirement:first,p_expected_revision:1,p_quantity:22}),2);
 assert.ok((await office.rpc('staffing_amend_confirmed',{...friday,p_requirement:first,p_expected_revision:1,p_quantity:23})).error);
 assert.ok((await office.rpc('staffing_cancel',{p_event:event,p_requirement:second,p_expected_revision:1,p_reason:null})).error);
 assert.equal(await rpc(office,'staffing_cancel',{p_event:event,p_requirement:second,p_expected_revision:1,p_reason:'Synthetic plan reduced'}),2);
 plan=await rpc(operations,'staffing_plan',{p_event:event});assert.equal(plan.required_total,22+20+30+4+1+150+1);
 assert.equal(plan.items.find((r)=>r.id===second).state,'CANCELLED');
 const history=await rpc(office,'staffing_history',{p_event:event,p_requirement:first});assert.deepEqual(history.map((r)=>r.revision),[2,1]);
 assert.ok((await office.from('event_staffing_requirement_revisions').update({reason:'forged'}).eq('requirement_id',first)).error);
 assert.ok((await operations.rpc('staffing_history',{p_event:event,p_requirement:'00000000-0000-4000-8000-000000000000'})).error);
 assert.ok((await staff.rpc('staffing_create_confirmed',friday)).error);
 assert.ok((await office.rpc('staffing_cancel',{p_event:'00000000-0000-4000-8000-000000000000',
  p_requirement:first,p_expected_revision:2,p_reason:'Wrong Event'})).error);
 assert.ok((await office.rpc('operational_change_event',{p_event:event,p_action:'DATES',p_starts:'2027-07-03T09:00:00+01:00',
  p_ends:'2027-07-04T23:00:00+01:00'})).error,'date change cannot orphan Friday planned staffing');
 await rpc(office,'operational_change_event',{p_event:event,p_action:'STATUS',p_status:'CONFIRMED'});
 assert.ok((await office.rpc('staffing_amend_confirmed',{...friday,p_requirement:first,p_expected_revision:2,p_quantity:23})).error,
  'confirmed Event amendment requires reason');
 assert.equal(await rpc(operations,'staffing_amend_confirmed',{...friday,p_requirement:first,p_expected_revision:2,p_quantity:23,
  p_reason:'Synthetic demand adjusted'}),3);
 await rpc(office,'operational_change_event',{p_event:event,p_action:'STATUS',p_status:'LIVE'});
 await rpc(office,'operational_change_event',{p_event:event,p_action:'STATUS',p_status:'COMPLETED'});
 assert.ok((await office.rpc('staffing_cancel',{p_event:event,p_requirement:first,p_expected_revision:3,p_reason:'Too late'})).error);
 assert.ok((await office.rpc('staffing_create_confirmed',create(role.STEWARD,1,'2027-07-02T10:00:00+01:00',
  '2027-07-02T11:00:00+01:00','2027-07-02T15:00:00+01:00','Terminal Event'))).error);
 assert.ok(large);
});

test('06B London input rejects DST gap and overlap',()=>{
 assert.equal(londonDueToIso('2027-03-28T01:30'),undefined);
 assert.equal(londonDueToIso('2027-10-31T01:30'),undefined);
 assert.equal(londonDueToIso('2027-08-14T12:30'),'2027-08-14T11:30:00.000Z');
});
