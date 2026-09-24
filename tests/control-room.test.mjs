import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const credentials={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD]};
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:credentials[name][0],password:credentials[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args={}){const {data,error}=await client.rpc(name,args);assert.ifError(error,`${name} failed`);return data;}
const request=(client,extra={})=>rpc(client,'control_room_snapshot_13a',{p_source:null,p_site:null,p_offset:0,p_limit:50,...extra});
const nextDate=(day)=>new Date(Date.parse(`${day}T00:00:00Z`)+86400000).toISOString().slice(0,10);

test('TASK-13A read-only Control Room authority, exact source counts and bounded snapshots',{timeout:180000},async()=>{
 assert.ok(url?.includes('dnfhkmmnlbiabqypclqg'),'tests must target dedicated synthetic Dev');
 assert.ok(key&&Object.values(credentials).every(x=>x.every(Boolean)));
 const [admin,office,operations,staff]=await Promise.all(['admin','office','operations','staff'].map(signed));
 assert.ok((await staff.rpc('control_room_snapshot_13a',{p_source:null,p_site:null,p_offset:0,p_limit:1})).error,'Staff has no manager Control Room');
 assert.ok((await operations.rpc('control_room_snapshot_13a',{p_source:'OTHER',p_site:null,p_offset:0,p_limit:1})).error,'invalid source denied');
 assert.ok((await operations.rpc('control_room_snapshot_13a',{p_source:null,p_site:null,p_offset:0,p_limit:51})).error,'oversized page denied');
 assert.ok((await operations.from('attendance_cases').select('id')).error,'direct attendance records remain denied');
 assert.ok((await operations.from('incidents').select('id')).error,'direct Incident records remain denied');
 const [all,officeView,adminView]=await Promise.all([request(operations),request(office),request(admin)]);
 assert.ok(Date.parse(all.as_of));assert.equal(all.cards.length,all.total,'fixture fits bounded page');
 assert.equal(officeView.total,all.total);assert.equal(adminView.total,all.total);
 assert.equal(all.incidents,null,'ordinary Operations without separate reviewer grant gets no Incident module');
 assert.ok(all.horizon&&typeof all.horizon.overdue==='boolean');
 assert.equal(Object.hasOwn(all.horizon,'last_run_id'),false,'private maintenance ledger identity is not exposed');
 assert.ok(all.cards.every(card=>card.required>=card.allocated&&card.allocated>=card.accepted));
 assert.ok(all.cards.every(card=>card.recorded_no_shows>=0&&card.attendance_reviews>=0));
 assert.ok(!/person_name|phone|email|narrative|payable|worked_time|credential/i.test(JSON.stringify(all)),'no private Person, Incident or worked-time payload');
 const first=await request(operations,{p_offset:0,p_limit:2}),second=await request(operations,{p_offset:2,p_limit:2});
 assert.equal(first.total,second.total);assert.equal(new Set([...first.cards,...second.cards].map(x=>`${x.source}:${x.source_id}:${x.service_date}`)).size,first.cards.length+second.cards.length);
 const eventCards=all.cards.filter(x=>x.source==='EVENT'),staticCards=all.cards.filter(x=>x.source==='SITE_SHIFT');
 assert.ok(eventCards.length>0&&staticCards.length>0,'synthetic Dev contains both source kinds in the current window');
 assert.equal((await request(operations,{p_source:'EVENT'})).total,eventCards.length);
 assert.equal((await request(operations,{p_source:'SITE_SHIFT'})).total,staticCards.length);
 const chosen=staticCards[0],siteFiltered=await request(operations,{p_site:chosen.site_id});
 assert.ok(siteFiltered.cards.length>0&&siteFiltered.cards.every(x=>x.site_id===chosen.site_id));
 const event=eventCards[0],sourceEvent=await rpc(operations,'deployment_event_summary',{p_event:event.source_id});
 assert.equal(event.required,sourceEvent.required);assert.equal(event.allocated,sourceEvent.allocated);
 assert.equal(event.accepted,sourceEvent.accepted);assert.equal(event.required-event.allocated,sourceEvent.remaining);
 const service=await rpc(operations,'site_service_detail',{p_site:chosen.site_id,p_service:chosen.source_id,p_from:chosen.service_date,p_until:nextDate(chosen.service_date)});
 const planned=service.demands.filter(x=>x.state==='PLANNED');
 assert.equal(chosen.required,planned.reduce((n,x)=>n+x.required_quantity,0));
 assert.equal(chosen.allocated,planned.reduce((n,x)=>n+x.allocated,0));
 assert.equal(chosen.accepted,planned.reduce((n,x)=>n+x.accepted,0));
 const attendance=await rpc(operations,'attendance_site_overview_09b',{p_service:chosen.source_id,p_offset:0,p_limit:100});
 const relevant=attendance.items.filter(x=>x.service_date===chosen.service_date&&x.demand_state==='PLANNED');
 assert.equal(chosen.checked_in,relevant.filter(x=>x.attendance.check_in_at!==null).length);
 assert.equal(chosen.attendance_reviews,relevant.filter(x=>x.attendance.review_required).length);
 const prior=await request(operations,{p_offset:0,p_limit:1});
 assert.ok((await operations.rpc('site_shift_maintenance_health_08d')).error,'Control Room health does not widen 08D administrator function');
 const after=await request(operations,{p_offset:0,p_limit:1});assert.equal(after.horizon.last_success_at,prior.horizon.last_success_at,'read did not run horizon maintenance');
 const grants=await rpc(admin,'incident_reviewer_grants_list');const row=grants.find(x=>x.personId==='10000000-0000-4000-8000-000000000007');assert.ok(row);
 let grant=null;
 if(!row.grant?.active)grant=await rpc(admin,'incident_reviewer_grant',{p_reviewer:row.personId,p_last_active_date:new Date(Date.now()+14*86400000).toISOString().slice(0,10),p_reason:'Synthetic TASK-13A Incident visibility proof'});
 try{const reviewed=await request(operations);assert.ok(reviewed.incidents&&Number.isInteger(reviewed.incidents.count));
  assert.equal((await request(office)).incidents,null,'Office has no Incident Reviewer grant');
  assert.ok(!JSON.stringify(reviewed.incidents).includes('narrative'));
 }finally{if(grant)await rpc(admin,'incident_reviewer_revoke',{p_grant:grant,p_reason:'Synthetic TASK-13A Incident visibility proof complete'});}
 if(grant)assert.equal((await request(operations)).incidents,null,'revocation removes Incident module immediately');
});
