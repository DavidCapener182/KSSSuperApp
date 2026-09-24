import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const users={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD]};
async function sign(role){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await signInWithTestSession(c,{email:users[role][0],password:users[role][1]});assert.ifError(error);return c;}
async function rpc(c,name,args){const {data,error}=await c.rpc(name,args);assert.ifError(error);return data;}

test('TASK-21C exact 08A/09B facts, independent authority and no source mutation', {timeout:180000},async()=>{
 assert.ok(url&&key&&Object.values(users).every(([email,password])=>email&&password));
 const [office,admin,operations,staff]=await Promise.all(['office','admin','operations','staff'].map(sign));
 const list=await rpc(office,'service_delivery_list',{p_offset:0,p_limit:50});
 let detail,overview;
 for(const row of list.items){const d=await rpc(office,'service_delivery_detail',{p_id:row.id});const a=await rpc(office,'attendance_site_overview_09b',{p_service:d.siteServiceId,p_demand:null,p_offset:0,p_limit:100});if(a.total>0){detail=d;overview=a;break;}}
 assert.ok(detail&&overview,'synthetic 09B Service Delivery fixture with recorded attendance required');
 const day=overview.items[0].service_date,month=day.slice(0,7),startsOn=`${month}-01`;
 const [year,number]=month.split('-').map(Number);
 const endsOn=new Date(Date.UTC(year,number,0)).toISOString().slice(0,10);
 let period=detail.periods.find(p=>p.starts_on<=day&&p.ends_on>=day);
 if(!period){
  const created=await rpc(office,'service_delivery_change',{p_id:detail.id,p_kind:'PERIOD_CREATED',p_subject:null,
    p_data:{name:`21C synthetic source review ${month}`,startsOn,endsOn,ownerId:detail.ownerId},p_expected:detail.revision,p_key:crypto.randomUUID()});
  detail=await rpc(office,'service_delivery_detail',{p_id:detail.id});period=detail.periods.find(p=>p.id===created.subjectId);
 }
 assert.ok(period);
 const args={p_delivery:detail.id,p_period:period.id};
 const sourceBefore=await rpc(office,'site_service_detail',{p_site:detail.siteId,p_service:detail.siteServiceId,p_from:period.starts_on,p_until:new Date(Date.parse(`${period.ends_on}T00:00:00Z`)+86400000).toISOString().slice(0,10)});
 const attendanceBefore=await rpc(office,'attendance_site_overview_09b',{p_service:detail.siteServiceId,p_demand:null,p_offset:0,p_limit:100});
 const cards=await rpc(office,'service_delivery_source_cards_21c',args);
 assert.equal(cards.reviewPeriodId,period.id);assert.equal(cards.siteServiceId,detail.siteServiceId);
 assert.equal(cards.startsOn,period.starts_on);assert.equal(cards.endsOn,period.ends_on);
 const demands=sourceBefore.demands.filter(d=>d.state==='PLANNED');
 const sum=key=>demands.reduce((n,d)=>n+d[key],0);
 assert.equal(cards.staffing.plannedDemandCount,demands.length);
 assert.equal(cards.staffing.required,sum('required_quantity'));
 assert.equal(cards.staffing.allocated,sum('allocated'));
 assert.equal(cards.staffing.accepted,sum('accepted'));
 assert.equal(cards.staffing.remaining,demands.reduce((n,d)=>n+Math.max(0,d.required_quantity-d.allocated),0));
 const scoped=attendanceBefore.items.filter(x=>x.service_date>=period.starts_on&&x.service_date<=period.ends_on);
 assert.ok(scoped.length>0,'recorded attendance fixture is inside exact review');
 assert.equal(cards.attendance.recordedCaseCount,scoped.length);
 assert.equal(cards.attendance.checkIns,scoped.filter(x=>x.attendance.check_in_at).length);
 assert.equal(cards.attendance.checkOuts,scoped.filter(x=>x.attendance.check_out_at).length);
 assert.equal(cards.attendance.currentExceptions,scoped.filter(x=>x.attendance.exception_recorded).length);
 assert.equal(cards.attendance.noShows,scoped.filter(x=>x.attendance.no_show_recorded).length);
 assert.equal(cards.attendance.reviewRequired,scoped.filter(x=>x.attendance.review_required).length);
 assert.equal(JSON.stringify(cards).includes('person_name'),false);
 assert.equal(JSON.stringify(cards).includes('events'),false);
 assert.equal(JSON.stringify(cards).includes('reason'),false);
 assert.deepEqual(await rpc(office,'site_service_detail',{p_site:detail.siteId,p_service:detail.siteServiceId,p_from:period.starts_on,p_until:new Date(Date.parse(`${period.ends_on}T00:00:00Z`)+86400000).toISOString().slice(0,10)}),sourceBefore);
 assert.deepEqual(await rpc(office,'attendance_site_overview_09b',{p_service:detail.siteServiceId,p_demand:null,p_offset:0,p_limit:100}),attendanceBefore);
 assert.deepEqual((await rpc(admin,'service_delivery_source_cards_21c',args)).staffing,cards.staffing);
 assert.ok((await operations.rpc('service_delivery_source_cards_21c',args)).error,'Operations source access does not grant Service Delivery');
 assert.ok((await staff.rpc('service_delivery_source_cards_21c',args)).error);
 assert.ok((await office.rpc('service_delivery_source_cards_21c',{p_delivery:detail.id,p_period:crypto.randomUUID()})).error,'guessed review denied');
 assert.ok((await office.from('attendance_cases').select('id')).error,'source direct table still denied');
});
