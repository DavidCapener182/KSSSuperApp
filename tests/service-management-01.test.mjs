import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const credentials={
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
};
async function signed(role) {
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:credentials[role][0],password:credentials[role][1]});
 assert.ifError(error);return client;
}
async function portfolio(client,args={}) {
 const {data,error}=await client.rpc('service_delivery_portfolio',{p_view:'all',p_offset:0,p_limit:25,...args});
 assert.ifError(error);return data;
}

test('SERVICE-01 portfolio filters the complete authorised set and keeps source records private', {timeout:120000}, async()=>{
 assert.ok(url?.includes('dnfhkmmnlbiabqypclqg')&&key&&Object.values(credentials).every(([email,password])=>email&&password),'literal synthetic Development only');
 const [office,admin,ops,staff]=await Promise.all(Object.keys(credentials).map(signed));
 assert.ok((await ops.rpc('service_delivery_portfolio',{p_view:'all'})).error,'Operations denied by guarded RPC');
 assert.ok((await staff.rpc('service_delivery_portfolio',{p_view:'all'})).error,'Staff denied by guarded RPC');
 assert.ok((await office.from('service_change_requests').select('id')).error,'direct change table read denied');
 const first=await portfolio(office);
 assert.ok(first.total>=first.items.length);
 assert.ok(first.items.length<=25);
 assert.ok(first.asOf&&Array.isArray(first.owners));
 assert.equal((await portfolio(admin)).total,first.total,'Office/Super broad management visibility agrees');
 if (first.total>25) {
  const second=await portfolio(office,{p_offset:25});
  assert.equal(second.total,first.total);
  assert.ok(second.items.every(item=>!first.items.some(previous=>previous.id===item.id)),'server pages do not repeat records');
 }
 if (!first.items.length) return;
 const row=first.items[0];
 const byClient=await portfolio(office,{p_client:row.client_name});
 assert.ok(byClient.items.some(item=>item.id===row.id));
 assert.ok(byClient.items.every(item=>item.client_name.toLowerCase().includes(row.client_name.toLowerCase())));
 const byOwner=await portfolio(office,{p_owner:row.owner_person_id});
 assert.ok(byOwner.items.every(item=>item.owner_person_id===row.owner_person_id));
 const mine=await portfolio(office,{p_view:'mine'});
 assert.ok(mine.total<=first.total);
 assert.ok(mine.items.every(item=>item.owner_person_id===mine.items[0].owner_person_id));
 const due=await portfolio(office,{p_view:'reviews_due'});
 assert.ok(due.items.every(item=>item.review_due_count>0));
 const overdue=await portfolio(office,{p_view:'actions_overdue'});
 assert.ok(overdue.items.every(item=>item.overdue_action_count>0));
 const upcoming=await portfolio(office,{p_view:'meetings_upcoming'});
 assert.ok(upcoming.items.every(item=>item.next_meeting_at));
 const pending=await portfolio(office,{p_view:'changes_awaiting'});
 assert.ok(pending.items.every(item=>item.changes_awaiting_count>0));
 assert.ok((await office.rpc('service_delivery_portfolio',{p_view:'invalid'})).error,'unknown view denied');
 assert.ok((await office.rpc('service_delivery_portfolio',{p_view:'all',p_offset:-1})).error,'invalid paging denied');
 assert.ok((await ops.rpc('service_change_application_candidate',{p_delivery:row.id,p_change:crypto.randomUUID()})).error,'Operations candidate read denied');
 assert.ok((await staff.rpc('service_change_application_candidate',{p_delivery:row.id,p_change:crypto.randomUUID()})).error,'Staff candidate read denied');
 assert.ok((await office.rpc('service_change_application_candidate',{p_delivery:row.id,p_change:crypto.randomUUID()})).error,'wrong exact change denied');
});
