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
 const officeBPerson='10000000-0000-4000-8000-000000000006';
 const grantIds=[];
 assert.equal((await rpc(admin,'training_completion_access')).manager,false,'Super Admin role alone is not manager');
 assert.equal((await rpc(officeB,'training_completion_access')).manager,false,'ungranted Office role is not manager');
 assert.ok((await officeB.rpc('training_completion_admin')).error,'ungranted Office denied');
 assert.ok((await operations.rpc('training_completion_admin')).error,'Operations denied');
 assert.ok((await anon.rpc('training_completion_mine')).error,'anonymous denied');
  assert.ok((await staffA.from('training_completions').select('*')).error,'base completion table denied');
  assert.ok((await staffA.from('training_completion_rule_versions').select('*')).error,'base rule table denied');
  assert.ok((await staffA.from('training_completions').insert({id:crypto.randomUUID()})).error,'direct Completion creation denied');
  assert.ok((await staffA.from('training_completion_rule_versions').insert({id:crypto.randomUUID()})).error,'direct rule creation denied');
  assert.ok((await staffA.from('training_attempts').select('*')).error,'direct Attempt read denied');
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
  const existingManagers=await rpc(admin,'training_completion_grants_read');
  if(!existingManagers.grants.some(g=>g.personId===officePerson&&!g.revokedAt))
   grantIds.push(['training_completion_revoke_grant',await rpc(admin,'training_completion_grant',{p_person:officePerson,p_reason:'Synthetic 20E Completion Manager proof'})]);
  assert.equal((await rpc(office,'training_completion_access')).manager,true);
  const temporaryManager=await rpc(admin,'training_completion_grant',{p_person:officeBPerson,p_reason:'Synthetic 20E immediate revocation proof'});
  try {
   assert.equal((await rpc(officeB,'training_completion_access')).manager,true,'named Office grant active');
   assert.ok((await rpc(officeB,'training_completion_admin')).assignments,'granted Office can read manager projection');
  } finally {await rpc(admin,'training_completion_revoke_grant',{p_grant:temporaryManager,p_reason:'Synthetic 20E immediate revocation proof'});}
  assert.equal((await rpc(officeB,'training_completion_access')).manager,false,'revocation effective immediately');
  assert.ok((await officeB.rpc('training_completion_admin')).error,'revoked manager denied');
  const grantHistory=(await rpc(admin,'training_completion_grants_read')).grants.find(g=>g.id===temporaryManager);
  assert.ok(grantHistory?.grantedAt&&grantHistory?.revokedAt,'grant and revoke history retained');
  assert.ok((await admin.rpc('training_completion_void',{p_completion:completion,p_reason:'Synthetic administrative correction proof',p_request:request()})).error,'Super Admin role alone cannot void');
  assert.ok((await office.rpc('training_completion_void',{p_completion:crypto.randomUUID(),p_reason:'Synthetic guessed Completion correction proof',p_request:request()})).error,'guessed Completion denied');
  assert.ok((await office.rpc('training_completion_void',{p_completion:completion,p_reason:'short',p_request:request()})).error,'manager void needs substantive reason');
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

test('TASK-20E source lifecycle and exact AssessmentVersion policy',{timeout:240000},async()=>{
 const [admin,office,staffA,staffB]=await Promise.all(['admin','office','staffA','staffB'].map(signed));
 const officePerson='10000000-0000-4000-8000-000000000002',personA='10000000-0000-4000-8000-000000000003',personB='10000000-0000-4000-8000-000000000004';
 const temporary=[];
 async function ensure(read,match,create,revoke,args){if(!(await rpc(admin,read)).some(match)) temporary.push([revoke,await rpc(admin,create,args)]);}
 async function makeCourse(label){const course=await rpc(office,'training_create_course',{p_title:`Synthetic 20E ${label} ${Date.now()}`,p_summary:'Exact lifecycle proof',p_content:content});
  const version=(await rpc(office,'training_admin',{p_course:course}))[0].versionId;
  await rpc(office,'training_publish',{p_version:version,p_revision:1});return {course,version};}
 async function makeAssessment(version){const assessment=await rpc(office,'training_assessment_create',{p_course_version:version,p_questions:questions});
  await rpc(office,'training_assessment_publish',{p_version:assessment,p_revision:1});return assessment;}
 async function assign(person,course,version){return rpc(office,'training_assign',{p_person:person,p_course:course,p_version:version,p_due:'2026-12-22',p_reason:'Synthetic exact lifecycle assignment proof',p_request:request()});}
 async function markAndPass(client,assignment,version){await rpc(client,'training_mark_page',{p_assignment:assignment,p_module:1,p_page:1});
  await rpc(client,'training_mark_page',{p_assignment:assignment,p_module:1,p_page:2});
  const attempt=await rpc(client,'training_assessment_start',{p_assignment:assignment,p_version:version,p_request:request()});
  await rpc(client,'training_assessment_submit',{p_attempt:attempt,p_revision:1,p_answers:{q1:['a']},p_request:request()});return attempt;}
 const ruleArgs=(courseVersion,assessmentVersion,until=null,validity=null)=>({p_course_version:courseVersion,p_assessment_version:assessmentVersion,
  p_effective_from:new Date(Date.now()-1000).toISOString(),p_effective_until:until,p_validity_months:validity});
 try {
  await ensure('training_grants',g=>g.personId===officePerson&&g.capability==='TRAINING_AUTHOR'&&!g.revokedAt,
   'training_grant','training_revoke',{p_person:officePerson,p_capability:'TRAINING_AUTHOR',p_reason:'Synthetic lifecycle author proof'});
  await ensure('training_grants',g=>g.personId===officePerson&&g.capability==='TRAINING_PUBLISHER'&&!g.revokedAt,
   'training_grant','training_revoke',{p_person:officePerson,p_capability:'TRAINING_PUBLISHER',p_reason:'Synthetic lifecycle publisher proof'});
  await ensure('training_assessment_grants_read',g=>g.personId===officePerson&&g.capability==='ASSESSMENT_AUTHOR'&&!g.revokedAt,
   'training_assessment_grant','training_assessment_revoke',{p_person:officePerson,p_capability:'ASSESSMENT_AUTHOR',p_reason:'Synthetic lifecycle assessment author proof'});
  await ensure('training_assessment_grants_read',g=>g.personId===officePerson&&g.capability==='ASSESSMENT_PUBLISHER'&&!g.revokedAt,
   'training_assessment_grant','training_assessment_revoke',{p_person:officePerson,p_capability:'ASSESSMENT_PUBLISHER',p_reason:'Synthetic lifecycle assessment publisher proof'});
  if(!(await rpc(admin,'training_assigner_grants_read')).some(g=>g.personId===officePerson&&!g.revokedAt))
   temporary.push(['training_assigner_revoke',await rpc(admin,'training_assigner_grant',{p_person:officePerson,p_from:new Date(Date.now()-60000).toISOString(),p_until:null,p_reason:'Synthetic lifecycle assigner proof'})]);
  const first=await makeCourse('versions');const v1=await makeAssessment(first.version);
  const a=await assign(personA,first.course,first.version),b=await assign(personB,first.course,first.version);
  const aAttempt=await markAndPass(staffA,a,v1),bAttempt=await markAndPass(staffB,b,v1);
  const end=new Date(Date.now()+2500).toISOString();
  const rule1=await rpc(office,'training_completion_publish_rule',ruleArgs(first.version,v1,end));
  const v2=await makeAssessment(first.version);
  const aDone=await rpc(staffA,'training_completion_evaluate',{p_assignment:a,p_request:request()});
  assert.equal(aDone.status,'COMPLETED','older v1 pass counts when the pinned rule explicitly names v1 after v2 publication');
  assert.equal((await rpc(staffA,'training_completion_mine')).find(x=>x.assignmentId===a).ruleVersionId,rule1);
  while(Date.now()<Date.parse(end)+200) await new Promise(resolve=>setTimeout(resolve,100));
  const rule2=await rpc(office,'training_completion_publish_rule',{...ruleArgs(first.version,v2),p_effective_from:new Date(Date.parse(end)+100).toISOString()});
  const bUnmet=await rpc(staffB,'training_completion_evaluate',{p_assignment:b,p_request:request()});
  assert.equal(bUnmet.status,'UNMET');assert.equal(bUnmet.unmet.length,1,'older v1 pass does not satisfy rule requiring exact v2');
  assert.equal(bUnmet.unmet[0],`PASSED_ATTEMPT_REQUIRED:${v2}`);
  assert.equal((await rpc(staffA,'training_completion_mine')).find(x=>x.assignmentId===a).ruleVersionId,rule1,'new rule does not reinterpret old Completion');
  const bV2=await rpc(staffB,'training_assessment_start',{p_assignment:b,p_version:v2,p_request:request()});
  await rpc(staffB,'training_assessment_submit',{p_attempt:bV2,p_revision:1,p_answers:{q1:['a']},p_request:request()});
  const bDone=await rpc(staffB,'training_completion_evaluate',{p_assignment:b,p_request:request()});
  assert.equal(bDone.status,'COMPLETED');
  assert.equal((await rpc(staffB,'training_completion_mine')).find(x=>x.assignmentId===b).ruleVersionId,rule2,'case remains pinned');
  assert.ok(aAttempt!==bAttempt && bV2!==bAttempt,'exact Attempt identities remain distinct');
  await rpc(office,'training_retire',{p_version:first.version,p_reason:'Synthetic course lifecycle retirement proof'});
  assert.ok((await rpc(staffA,'training_completion_mine')).some(x=>x.assignmentId===a),'Completion survives CourseVersion retirement');
  assert.ok((await rpc(staffB,'training_completion_mine')).some(x=>x.assignmentId===b),'second Completion survives retirement');
  const cancelled=await makeCourse('cancelled');const cancelledAssessment=await makeAssessment(cancelled.version);
  await rpc(office,'training_completion_publish_rule',ruleArgs(cancelled.version,cancelledAssessment));
  const cancelledAssignment=await assign(personA,cancelled.course,cancelled.version);
  await rpc(office,'training_cancel',{p_assignment:cancelledAssignment,p_revision:1,p_reason:'Synthetic cancelled completion denial proof',p_request:request()});
  assert.ok((await staffA.rpc('training_completion_evaluate',{p_assignment:cancelledAssignment,p_request:request()})).error,'cancelled Assignment denied');
  const superseded=await makeCourse('superseded');const supersededAssessment=await makeAssessment(superseded.version);
  await rpc(office,'training_completion_publish_rule',ruleArgs(superseded.version,supersededAssessment));
  const supersededAssignment=await assign(personA,superseded.course,superseded.version);
  const draft=await rpc(office,'training_create_draft',{p_course:superseded.course});
  await rpc(office,'training_publish',{p_version:draft,p_revision:1});
  await rpc(office,'training_supersede_assignment',{p_assignment:supersededAssignment,p_revision:1,p_version:draft,p_due:'2026-12-23',p_reason:'Synthetic superseded completion denial proof',p_request:request()});
  assert.ok((await staffA.rpc('training_completion_evaluate',{p_assignment:supersededAssignment,p_request:request()})).error,'superseded Assignment denied');
  const retired=await makeCourse('retired-assessment');const retiredAssessment=await makeAssessment(retired.version);
  await rpc(office,'training_completion_publish_rule',ruleArgs(retired.version,retiredAssessment));
  const retiredAssignment=await assign(personA,retired.course,retired.version);
  await markAndPass(staffA,retiredAssignment,retiredAssessment);
  await rpc(office,'training_assessment_retire',{p_version:retiredAssessment,p_reason:'Synthetic required assessment retirement proof'});
  assert.ok((await staffA.rpc('training_completion_evaluate',{p_assignment:retiredAssignment,p_request:request()})).error,'retired required AssessmentVersion blocks new Completion');
  const retiredCourse=await makeCourse('retired-course');const retiredCourseAssessment=await makeAssessment(retiredCourse.version);
  await rpc(office,'training_completion_publish_rule',ruleArgs(retiredCourse.version,retiredCourseAssessment));
  const retiredCourseAssignment=await assign(personA,retiredCourse.course,retiredCourse.version);
  await rpc(office,'training_retire',{p_version:retiredCourse.version,p_reason:'Synthetic new Completion retirement denial proof'});
  assert.ok((await staffA.rpc('training_completion_evaluate',{p_assignment:retiredCourseAssignment,p_request:request()})).error,'retired CourseVersion blocks new Completion');
  assert.ok((await office.rpc('training_completion_publish_rule',ruleArgs(cancelled.version,v2))).error,'Course/Assessment version mismatch denied');
  const unpublished=await makeCourse('unpublished-rule');const unpublishedAssignment=await assign(personA,unpublished.course,unpublished.version);
  assert.ok((await staffA.rpc('training_completion_evaluate',{p_assignment:unpublishedAssignment,p_request:request()})).error,'no published CompletionRuleVersion cannot complete');
  assert.ok((await staffA.rpc('training_completion_evaluate',{p_assignment:crypto.randomUUID(),p_request:request()})).error,'guessed Assignment denied');
 } finally {
  for(const [fn,grant] of temporary.reverse()) {const {error}=await admin.rpc(fn,{p_grant:grant,p_reason:'Synthetic lifecycle temporary grant cleanup'});assert.ifError(error);}
 }
});
