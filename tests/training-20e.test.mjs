import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const names={admin:'ADMIN',office:'OFFICE',officeB:'OFFICE_B',operations:'OPERATIONS',staffA:'STAFF_A',staffB:'STAFF_B'};
async function signed(name){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const code=names[name];
 const {error}=await signInWithTestSession(c,{email:process.env[`KSS_TEST_${code}_EMAIL`],password:process.env[`KSS_TEST_${code}_PASSWORD`]});assert.ifError(error);return c;}
async function rpc(c,name,args={}){const {data,error}=await c.rpc(name,args);assert.ifError(error,`${name}: ${error?.message}`);return data;}
const request=()=>crypto.randomUUID();
const content=[{title:'Synthetic 20E module',pages:[
 {title:'First synthetic page',blocks:[{type:'paragraph',text:'Synthetic completion proof only.'}]},
 {title:'Second synthetic page',blocks:[{type:'paragraph',text:'Explicit mark required.'}]}
]}];
const questions=[{id:'q1',type:'SINGLE',prompt:'Synthetic designated answer?',options:[{id:'a',text:'Alpha'},{id:'b',text:'Beta'}],key:['a']}];

test('TASK-20E exact rule, deterministic evaluation, authority and void',{timeout:240000},async()=>{
 assert.ok(url?.includes('dnfhkmmnlbiabqypclqg'),'literal synthetic Dev target');
 const [admin,office,officeB,operations,staffA,staffB]=await Promise.all(Object.keys(names).map(signed));
 const anon=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const officePerson='10000000-0000-4000-8000-000000000002',staffPerson='10000000-0000-4000-8000-000000000003';
 const grantIds=[];
 assert.equal((await rpc(admin,'training_completion_access')).manager,false,'Super Admin role alone is not manager');
 assert.equal((await rpc(office,'training_completion_access')).manager,false,'Office role alone is not manager');
 assert.ok((await officeB.rpc('training_completion_admin')).error,'ungranted Office denied');
 assert.ok((await operations.rpc('training_completion_admin')).error,'Operations denied');
 assert.ok((await anon.rpc('training_completion_mine')).error,'anonymous denied');
 assert.ok((await staffA.from('training_completions').select('*')).error,'base completion table denied');
 assert.ok((await staffA.from('training_completion_rule_versions').select('*')).error,'base rule table denied');
 try {
  const trainingGrants=await rpc(admin,'training_grants');
  for(const capability of ['TRAINING_AUTHOR','TRAINING_PUBLISHER']) if(!trainingGrants.some(g=>g.personId===officePerson&&g.capability===capability&&!g.revokedAt))
   grantIds.push(['training_revoke',await rpc(admin,'training_grant',{p_person:officePerson,p_capability:capability,p_reason:`Synthetic 20E ${capability} proof`})]);
  const assessmentGrants=await rpc(admin,'training_assessment_grants_read');
  for(const capability of ['ASSESSMENT_AUTHOR','ASSESSMENT_PUBLISHER']) if(!assessmentGrants.some(g=>g.personId===officePerson&&g.capability===capability&&!g.revokedAt))
   grantIds.push(['training_assessment_revoke',await rpc(admin,'training_assessment_grant',{p_person:officePerson,p_capability:capability,p_reason:`Synthetic 20E ${capability} proof`})]);
  const assignerGrants=await rpc(admin,'training_assigner_grants_read');
  if(!assignerGrants.some(g=>g.personId===officePerson&&!g.revokedAt))
   grantIds.push(['training_assigner_revoke',await rpc(admin,'training_assigner_grant',{p_person:officePerson,p_from:new Date(Date.now()-60000).toISOString(),p_until:null,p_reason:'Synthetic 20E assignment proof'})]);
  const course=await rpc(office,'training_create_course',{p_title:`Synthetic 20E ${Date.now()}`,p_summary:'Exact completion proof',p_content:content});
  const version=(await rpc(office,'training_admin',{p_course:course}))[0].versionId;
  await rpc(office,'training_publish',{p_version:version,p_revision:1});
  const assessment=await rpc(office,'training_assessment_create',{p_course_version:version,p_questions:questions});
  await rpc(office,'training_assessment_publish',{p_version:assessment,p_revision:1});
  const assignment=await rpc(office,'training_assign',{p_person:staffPerson,p_course:course,p_version:version,p_due:'2026-12-15',p_reason:'Synthetic 20E exact assignment proof',p_request:request()});
  assert.equal((await rpc(staffA,'training_completion_mine')).filter(x=>x.assignmentId===assignment).length,0,'assignment creates no Completion');
  const rule=await rpc(office,'training_completion_publish_rule',{p_course_version:version,p_assessment_version:assessment,
   p_effective_from:new Date(Date.now()-60000).toISOString(),p_effective_until:null,p_validity_months:null});
  assert.ok(rule,'publisher created explicit rule');
  assert.ok((await office.rpc('training_completion_publish_rule',{p_course_version:version,p_assessment_version:assessment,
   p_effective_from:new Date(Date.now()-60000).toISOString(),p_effective_until:null,p_validity_months:null})).error,'overlapping rule denied');
  const unmet=await rpc(staffA,'training_completion_evaluate',{p_assignment:assignment,p_request:request()});
  assert.equal(unmet.status,'UNMET');assert.equal(unmet.unmet.length,2,'both page and pass gaps');
  assert.equal((await rpc(staffA,'training_completion_mine')).filter(x=>x.assignmentId===assignment).length,0,'unmet evaluation creates no Completion');
  assert.ok((await staffB.rpc('training_completion_evaluate',{p_assignment:assignment,p_request:request()})).error,'peer Staff denied');
  assert.ok((await operations.rpc('training_completion_evaluate',{p_assignment:assignment,p_request:request()})).error,'Operations denied');
  assert.ok((await admin.rpc('training_completion_evaluate',{p_assignment:assignment,p_request:request()})).error,'Super Admin role alone denied manager evaluation');
  const attempt=await rpc(staffA,'training_assessment_start',{p_assignment:assignment,p_version:assessment,p_request:request()});
  const passed=await rpc(staffA,'training_assessment_submit',{p_attempt:attempt,p_revision:1,p_answers:{q1:['a']},p_request:request()});
  assert.equal(passed.result,'PASSED');
  assert.equal((await rpc(staffA,'training_completion_mine')).filter(x=>x.assignmentId===assignment).length,0,'PASSED Attempt alone creates no Completion');
  const pagesUnmet=await rpc(staffA,'training_completion_evaluate',{p_assignment:assignment,p_request:request()});
  assert.equal(pagesUnmet.status,'UNMET');assert.equal(pagesUnmet.unmet.length,1,'page requirement remains');
  await rpc(staffA,'training_mark_page',{p_assignment:assignment,p_module:1,p_page:1});
  await rpc(staffA,'training_mark_page',{p_assignment:assignment,p_module:1,p_page:2});
  assert.equal((await rpc(staffA,'training_completion_mine')).filter(x=>x.assignmentId===assignment).length,0,'all page marks alone create no Completion');
  const requestA=request(),requestB=request();
  const concurrent=await Promise.all([staffA.rpc('training_completion_evaluate',{p_assignment:assignment,p_request:requestA}),
   staffA.rpc('training_completion_evaluate',{p_assignment:assignment,p_request:requestB})]);
  assert.equal(concurrent.filter(x=>!x.error).length,2,'concurrent evaluation succeeds');
  const completion=concurrent[0].data.completionId;
  assert.equal(concurrent[1].data.completionId,completion,'one Completion ID');
  assert.equal((await rpc(staffA,'training_completion_evaluate',{p_assignment:assignment,p_request:requestA})).completionId,completion,'request replay');
  assert.ok((await staffA.rpc('training_completion_evaluate',{p_assignment:crypto.randomUUID(),p_request:requestA})).error,'changed-payload replay denied');
  const history=(await rpc(staffA,'training_completion_mine')).filter(x=>x.assignmentId===assignment);
  assert.equal(history.length,1);assert.equal(history[0].ruleVersionId,rule,'exact rule pinned');
  assert.ok((await staffB.rpc('training_completion_mine')).data?.some?.(x=>x.id===completion)===false,'peer history isolated');
  grantIds.push(['training_completion_revoke_grant',await rpc(admin,'training_completion_grant',{p_person:officePerson,p_reason:'Synthetic 20E Completion Manager proof'})]);
  assert.equal((await rpc(office,'training_completion_access')).manager,true);
  assert.ok((await admin.rpc('training_completion_void',{p_completion:completion,p_reason:'Synthetic administrative correction proof',p_request:request()})).error,'Super Admin role alone cannot void');
  const voided=await rpc(office,'training_completion_void',{p_completion:completion,p_reason:'Synthetic administrative correction proof',p_request:request()});
  assert.equal(voided.status,'VOIDED');
  assert.equal((await rpc(staffA,'training_completion_mine')).find(x=>x.id===completion).voidedAt!==null,true,'void preserved history');
  assert.equal((await rpc(staffA,'training_completion_evaluate',{p_assignment:assignment,p_request:request()})).status,'VOIDED','void does not create replacement Completion');
 } finally {
  for(const [action,id] of grantIds.reverse()) {
   const args=action==='training_revoke'?{p_grant:id,p_reason:'Synthetic 20E temporary grant cleanup'}:
    action==='training_assessment_revoke'?{p_grant:id,p_reason:'Synthetic 20E temporary grant cleanup'}:
    {p_grant:id,p_reason:'Synthetic 20E temporary grant cleanup'};
   await admin.rpc(action,args);
  }
 }
});
