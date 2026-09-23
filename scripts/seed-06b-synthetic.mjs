import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.match(url??'',/^https:\/\/dnfhkmmnlbiabqypclqg\.supabase\.co$/,'06B seed is Dev-only');
assert.ok(key&&process.env.KSS_TEST_OFFICE_EMAIL&&process.env.KSS_TEST_OFFICE_PASSWORD);
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
assert.ifError((await db.auth.signInWithPassword({email:process.env.KSS_TEST_OFFICE_EMAIL,password:process.env.KSS_TEST_OFFICE_PASSWORD})).error);
async function rpc(name,args){const {data,error}=await db.rpc(name,args);assert.ifError(error);return data;}
async function existing(name){const result=await rpc('operational_events_list',{p_search:name,p_limit:50});return result.items.find((row)=>row.name===name)?.id;}
const roles=Object.fromEntries((await rpc('staffing_role_choices',{})).map((role)=>[role.code,role.id]));
const office='10000000-0000-4000-8000-000000000002';
const northshoreOrg='be7baa96-6986-4c95-8561-908c75dca7f7';
const riverside='1a82f538-d7b3-4f6e-9323-8f9cf00a4b96';
let festival=await existing('Northshore Weekend 2027');
if(!festival){
 festival=await rpc('operational_create_event',{p_site:riverside,p_organisation:northshoreOrg,p_name:'Northshore Weekend 2027',
  p_type:'FESTIVAL',p_starts:'2027-07-02T09:00:00+01:00',p_ends:'2027-07-04T23:00:00+01:00',p_owner:office});
 const create=async(code,qty,day,report,start,end,area)=>rpc('staffing_create_confirmed',{p_event:festival,p_role:roles[code],p_quantity:qty,
   p_report:`${day}T${report}:00+01:00`,p_start:`${day}T${start}:00+01:00`,p_end:end,
   p_area:area,p_instructions:'Synthetic development staffing demand only',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
 for(const [day,sia,stewards] of [['2027-07-02',4,20],['2027-07-03',8,35],['2027-07-04',6,30]]){
  await create('DEPLOYMENT_MANAGER',1,day,'08:00','09:00',`${day}T22:00:00+01:00`,'Event control');
  await create('SIA',sia,day,'08:30','09:00',`${day}T22:00:00+01:00`,'Main gate');
  await create('STEWARD',stewards,day,'08:30','09:00',`${day}T22:00:00+01:00`,'Arena');
 }
 await create('SIA',2,'2027-07-03','20:00','21:00','2027-07-04T06:00:00+01:00','Campsite A');
 const temporary=await create('SEARCH',2,'2027-07-02','08:30','09:00','2027-07-02T16:00:00+01:00','Search area');
 await rpc('staffing_amend_confirmed',{p_event:festival,p_requirement:temporary,p_expected_revision:1,p_role:roles.SEARCH,p_quantity:3,
  p_report:'2027-07-02T08:30:00+01:00',p_start:'2027-07-02T09:00:00+01:00',p_end:'2027-07-02T16:00:00+01:00',
  p_area:'Search area',p_instructions:'Synthetic development staffing demand only',p_reason:'Synthetic quantity correction',
  p_confirm_duplicate:false,p_confirm_exception:false});
 await rpc('staffing_cancel',{p_event:festival,p_requirement:temporary,p_expected_revision:2,p_reason:'Synthetic plan changed'});
 await rpc('operational_change_event',{p_event:festival,p_action:'STATUS',p_status:'CONFIRMED'});
}
let football=await existing('Example FC Fixture 2027');
if(!football){
 const org=await rpc('crm_create_organisation',{p_name:'Example Football Club 06B'});
 const won=await rpc('crm_create_opportunity',{p_organisation:org,p_title:'Synthetic fixture staffing',p_type:'DIRECT_ENQUIRY',p_owner:office});
 await rpc('crm_transition_opportunity',{p_id:won,p_stage:'WON'});
 const site=await db.from('sites').insert({site_reference:'DEV-06B-FOOTBALL',name:'Example Stadium 06B',
  address_line1:'1 Synthetic Stadium Road',town_city:'Exampletown',postcode:'EX1 1AA',reporting_point:'South gate',
  created_by_person_id:office,site_type:'STADIUM'}).select('id').single();assert.ifError(site.error);
 assert.ifError((await db.from('sites').update({status:'ACTIVE'}).eq('id',site.data.id)).error);
 await rpc('operational_link_site',{p_site:site.data.id,p_organisation:org});
 football=await rpc('operational_create_event',{p_site:site.data.id,p_organisation:org,p_name:'Example FC Fixture 2027',
  p_type:'FOOTBALL_MATCH',p_starts:'2027-08-14T15:00:00+01:00',p_ends:'2027-08-14T17:00:00+01:00',p_owner:office,p_opportunity:won});
 for(const [code,qty,area,report] of [['STAND_MANAGER',1,'South Stand','12:30'],['STAND_SUPERVISOR',1,'South Stand','12:30'],
  ['SIA',2,'Turnstiles','12:45'],['STEWARD',18,'South Stand','12:45'],['STEWARD',4,'North Stand','12:45']]){
  await rpc('staffing_create_confirmed',{p_event:football,p_role:roles[code],p_quantity:qty,p_report:`2027-08-14T${report}:00+01:00`,
   p_start:'2027-08-14T13:00:00+01:00',p_end:'2027-08-14T18:00:00+01:00',p_area:area,
   p_instructions:'Synthetic development fixture only',p_reason:null,p_confirm_duplicate:false,p_confirm_exception:false});
 }
}
const festivalPlan=await rpc('staffing_plan',{p_event:festival});const fixturePlan=await rpc('staffing_plan',{p_event:football});
assert.equal(festivalPlan.required_total,1+4+20+1+8+35+1+6+30+2);
assert.equal(fixturePlan.required_total,26);
console.log(JSON.stringify({festival,festivalRequired:festivalPlan.required_total,festivalDays:3,football,footballRequired:fixturePlan.required_total}));
