import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const officeCredentials=[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD];
const operationsCredentials=[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD];
const officeId='10000000-0000-4000-8000-000000000002';

async function signedIn(credentials){
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:credentials[0],password:credentials[1]});
 assert.ifError(error);
 return client;
}
async function rpc(client,name,args){
 const {data,error}=await client.rpc(name,args);
 assert.ifError(error);
 return data;
}
function londonDate(){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function mondayOnOrAfter(date){
 const value=new Date(`${date}T00:00:00Z`);
 const offset=(8-value.getUTCDay())%7;
 value.setUTCDate(value.getUTCDate()+offset);
 return value.toISOString().slice(0,10);
}

test('08D current-window reruns are scoped, recorded and safe under concurrency', {timeout:180000}, async()=>{
 assert.ok(url&&key&&officeCredentials.every(Boolean)&&operationsCredentials.every(Boolean));
 const [officeA,officeB,operations]=await Promise.all([
  signedIn(officeCredentials),signedIn(officeCredentials),signedIn(operationsCredentials)
 ]);

 assert.ok((await operations.rpc('site_shift_maintenance_rerun_08d')).error,
  'Operations cannot start maintenance');
 assert.ok((await operations.rpc('site_shift_maintenance_status_08d')).error,
  'Operations cannot inspect the admin maintenance ledger');
 assert.ok((await operations.rpc('site_shift_maintenance_health_08d')).error,
  'Operations cannot inspect administrator maintenance health');
 assert.ok((await officeA.schema('private').from('site_shift_maintenance_runs_08d').select('id')).error,
  'authenticated users cannot read private run rows directly');

 const [first,second]=await Promise.all([
  rpc(officeA,'site_shift_maintenance_rerun_08d',{}),
  rpc(officeB,'site_shift_maintenance_rerun_08d',{})
 ]);
 assert.notEqual(first,second,'concurrent attempts receive distinct history identities');
 const status=await rpc(officeA,'site_shift_maintenance_status_08d',{p_limit:10});
 const attempts=status.filter((run)=>run.run_id===first||run.run_id===second);
 assert.equal(attempts.length,2);
 for(const run of attempts){
  assert.equal(run.window_from,londonDate());
  assert.equal(run.window_until,
   new Date(Date.parse(`${run.window_from}T00:00:00Z`)+run.horizon_weeks*7*86400000).toISOString().slice(0,10));
  assert.ok(['SUCCEEDED','PARTIAL_FAILURE','FAILED','SKIPPED_LOCKED'].includes(run.state));
  assert.equal(run.services_total,run.services_succeeded+run.services_failed);
  assert.equal(run.services.length,run.services_total);
 }
 const health=await rpc(officeA,'site_shift_maintenance_health_08d',{});
 assert.equal(health.window_from,londonDate());
 assert.equal(health.horizon_weeks,8);
 assert.equal(health.overdue_after_hours,36);
 assert.equal(health.overdue,false);

 const runForReads=status[0];
 const countBefore=status.length;
 const week=mondayOnOrAfter(londonDate());
 await rpc(operations,'workforce_week_08a',{p_week:week,p_event:null,p_site:null,p_client:null,p_role:null,
  p_owner:null,p_gaps:false,p_conflicts:false,p_offset:0,p_limit:20});
 const statusAfter=await rpc(officeA,'site_shift_maintenance_status_08d',{p_limit:10});
 assert.equal(statusAfter.length,countBefore,'a Workforce read does not launch maintenance');
 assert.equal(statusAfter[0].run_id,runForReads.run_id);
});
