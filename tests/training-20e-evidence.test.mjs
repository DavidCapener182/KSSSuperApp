import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
async function signed(code){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:process.env[`KSS_TEST_${code}_EMAIL`],password:process.env[`KSS_TEST_${code}_PASSWORD`]});assert.ifError(error);return client;}
async function rpc(client,name,args={}){const {data,error}=await client.rpc(name,args);assert.ifError(error,`${name}: ${error?.message}`);return data;}

test('TASK-20E evidence read separates Staff facts from named manager attribution',{timeout:120000},async()=>{
 assert.ok(url?.includes('dnfhkmmnlbiabqypclqg'),'literal synthetic Development target');
 const [admin,office,operations,staffA,staffB]=await Promise.all(['ADMIN','OFFICE','OPERATIONS','STAFF_A','STAFF_B'].map(signed));
 const mine=await rpc(staffA,'training_completion_mine');
 const chosen=mine.find(item=>item.assignmentId&&item.voidedAt);
 assert.ok(chosen,'synthetic Staff A voided Completion fixture');
 const assignment=chosen.assignmentId;
 const self=await rpc(staffA,'training_completion_history',{p_assignment:assignment});
 assert.equal(self.assignment.id,assignment);
 assert.equal(self.completion.id,chosen.id);
 assert.ok(self.completion.voidedAt,'factual void shown to learner');
 for(const field of ['evaluatedBy','voidedBy','voidReason']) assert.equal(Object.hasOwn(self.completion,field),false,`Staff must not receive ${field}`);
 for(const event of self.events){
  assert.deepEqual(Object.keys(event).sort(),['action','completionId','id','occurredAt'].sort(),'learner event allowlist');
  for(const field of ['actorPersonId','reason','details']) assert.equal(Object.hasOwn(event,field),false,`Staff must not receive ${field}`);
 }
 for(const attempt of self.attempts) assert.deepEqual(Object.keys(attempt).sort(),['assessmentVersionId','id','result','state','submittedAt'].sort(),'safe Attempt allowlist');
 assert.ok((await staffB.rpc('training_completion_history',{p_assignment:assignment})).error,'peer Staff denied');
 assert.ok((await operations.rpc('training_completion_history',{p_assignment:assignment})).error,'Operations denied');
 assert.ok((await admin.rpc('training_completion_history',{p_assignment:assignment})).error,'Super Admin role alone denied');
 assert.ok((await office.rpc('training_completion_history',{p_assignment:assignment})).error,'Office without named grant denied');
 const grant=await rpc(admin,'training_completion_grant',{p_person:'10000000-0000-4000-8000-000000000002',p_reason:'Synthetic 20E evidence audience proof'});
 try {
  const manager=await rpc(office,'training_completion_history',{p_assignment:assignment});
  assert.equal(manager.completion.id,self.completion.id);
  assert.equal(manager.completion.voidedBy,'10000000-0000-4000-8000-000000000002');
  assert.ok(manager.completion.voidReason);
  assert.ok(manager.completion.evaluatedBy);
  for(const event of manager.events){
   assert.deepEqual(Object.keys(event).sort(),['action','actorPersonId','completionId','id','occurredAt','reason'].sort(),'manager event allowlist');
   assert.equal(Object.hasOwn(event,'details'),false,'raw details never projected');
  }
  assert.ok((await office.rpc('training_completion_grants_read')).error,'manager grant does not confer Super Admin oversight');
 } finally {await rpc(admin,'training_completion_revoke_grant',{p_grant:grant,p_reason:'Synthetic 20E evidence grant cleanup'});}
 assert.ok((await office.rpc('training_completion_history',{p_assignment:assignment})).error,'revocation removes evidence access immediately');
 assert.equal((await rpc(staffA,'training_completion_history',{p_assignment:assignment})).completion.id,self.completion.id,'Staff self history remains available');
});
