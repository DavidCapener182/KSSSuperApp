import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
async function signed(code){
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{
  email:process.env[`KSS_TEST_${code}_EMAIL`],password:process.env[`KSS_TEST_${code}_PASSWORD`]});
 assert.ifError(error);return client;
}
async function rpc(client,name,args={}){
 const {data,error}=await client.rpc(name,args);assert.ifError(error,`${name}: ${error?.message}`);return data;
}

test('TASK-20F-A exact synthetic requirement, matrix and audience', {timeout:120000}, async()=>{
 assert.ok(url?.includes('dnfhkmmnlbiabqypclqg'),'dedicated synthetic Development target');
 const [admin,office,staffA,staffB,operations]=await Promise.all(
  ['ADMIN','OFFICE','STAFF_A','STAFF_B','OPERATIONS'].map(signed));
 const officePerson='10000000-0000-4000-8000-000000000002';
 const grants=[];
 assert.equal((await rpc(admin,'training_requirement_access_20fa')).author,false,
  'Super Admin role cannot author');
 assert.ok((await office.rpc('training_requirement_admin_20fa')).error,'ungranted Office denied');
 assert.ok((await operations.rpc('training_requirement_contexts_20fa')).data?.length===0,
  'Operations sees no learner context');
 assert.ok((await staffA.from('training_requirement_versions_20fa').select('*')).error,
  'Staff base-table read denied');
 assert.ok((await staffA.from('training_requirement_versions_20fa').insert({id:crypto.randomUUID()})).error,
  'Staff base-table write denied');
 const staffContexts=await rpc(staffA,'training_requirement_contexts_20fa');
 assert.ok(staffContexts.length>0,'synthetic Staff A has an exact allocated context');
 const preflight=await rpc(admin,'training_requirement_admin_20fa');
 const ctx=staffContexts.find(item=>preflight.services.some(s=>s.id===item.serviceId));
 assert.ok(ctx,'active allocated Service in choices');
 try {
  const until=new Date(Date.now()+86400000).toISOString();
  for(const capability of ['AUTHOR','PUBLISHER','VIEWER']){
   grants.push(await rpc(admin,'training_requirement_grant_20fa',{
    p_person:officePerson,p_capability:capability,
    p_service:capability==='VIEWER'?ctx.serviceId:null,
    p_until:until,p_reason:'Synthetic 20F-A bounded pilot proof'}));
  }
  const choices=await rpc(office,'training_requirement_admin_20fa');
  const service=choices.services.find(s=>s.id===ctx.serviceId);
  const assignments=await rpc(staffA,'training_my_learning');
  const assigned=new Set(assignments.map(item=>item.versionId));
  const course=choices.courses.find(item=>!assigned.has(item.id));
  assert.ok(course,'a published, unassigned synthetic CourseVersion exists');
  const req=await rpc(office,'training_requirement_create_20fa',{
   p_label:`Synthetic Site Shift learning ${Date.now()}`,p_role:ctx.roleId,
   p_site:service.siteId,p_service:ctx.serviceId,p_course_version:course.id,
   p_prior:'NOT_ACCEPTED',p_from:ctx.asOf,p_until:null,
   p_reason:'Synthetic role and Service pilot requirement'});
  const first=(await rpc(office,'training_requirement_admin_20fa')).requirements
   .find(item=>item.id===req).versions[0];
  assert.equal(first.state,'DRAFT');
  assert.ok((await staffA.rpc('training_requirement_matrix_20fa',{
   p_person:ctx.personId,p_service:ctx.serviceId,p_role:ctx.roleId,p_as_of:ctx.asOf})).data.rows.every(
    item=>item.requirementId!==req),'draft does not appear in matrix');
  await rpc(office,'training_requirement_publish_20fa',{
   p_version:first.id,p_reason:'Publish synthetic exact-version pilot policy'});
  const staffResult=await rpc(staffA,'training_requirement_matrix_20fa',{
   p_person:ctx.personId,p_service:ctx.serviceId,p_role:ctx.roleId,p_as_of:ctx.asOf});
  const row=staffResult.rows.find(item=>item.requirementId===req);
  assert.equal(row.status,'NOT_ASSIGNED','published requirement is not an Assignment');
  assert.equal(row.courseVersionId,course.id);
  assert.equal(row.completionId,null);
  assert.ok(!JSON.stringify(row).includes('eligible'),'no readiness verdict');
  const manager=await rpc(office,'training_requirement_matrix_20fa',{
   p_person:ctx.personId,p_service:ctx.serviceId,p_role:ctx.roleId,p_as_of:ctx.asOf});
  assert.equal(manager.rows.find(item=>item.requirementId===req).status,'NOT_ASSIGNED');
  const completions=await rpc(staffA,'training_completion_mine');
  const pending=assignments.find(item=>item.state==='ACTIVE' && choices.courses.some(c=>c.id===item.versionId) &&
   !completions.some(c=>c.courseVersionId===item.versionId&&!c.voidedAt));
  assert.ok(pending,'existing synthetic active Assignment without Completion');
  const pendingReq=await rpc(office,'training_requirement_create_20fa',{
   p_label:`Synthetic in-progress learning ${Date.now()}`,p_role:ctx.roleId,
   p_site:service.siteId,p_service:ctx.serviceId,p_course_version:pending.versionId,
   p_prior:'ACCEPT_IF_CURRENT',p_from:ctx.asOf,p_until:null,
   p_reason:'Synthetic assignment is not Completion'});
  const pendingVersion=(await rpc(office,'training_requirement_admin_20fa')).requirements
   .find(item=>item.id===pendingReq).versions[0].id;
  await rpc(office,'training_requirement_publish_20fa',{
   p_version:pendingVersion,p_reason:'Publish in-progress synthetic pilot proof'});
  const progress=await rpc(staffA,'training_requirement_matrix_20fa',{
   p_person:ctx.personId,p_service:ctx.serviceId,p_role:ctx.roleId,p_as_of:ctx.asOf});
  assert.equal(progress.rows.find(item=>item.requirementId===pendingReq).status,'ASSIGNED_IN_PROGRESS');
  const completed=completions.find(c=>!c.voidedAt &&
   new Date(c.completedAt).toISOString().slice(0,10)<=ctx.asOf &&
   choices.courses.some(course=>course.id===c.courseVersionId));
  assert.ok(completed,'existing synthetic unvoided Completion for an exact published CourseVersion');
  const completedReq=await rpc(office,'training_requirement_create_20fa',{
   p_label:`Synthetic completed learning ${Date.now()}`,p_role:ctx.roleId,
   p_site:service.siteId,p_service:ctx.serviceId,p_course_version:completed.courseVersionId,
   p_prior:'ACCEPT_IF_CURRENT',p_from:ctx.asOf,p_until:null,
   p_reason:'Synthetic prior Completion accepted explicitly'});
  const completedVersion=(await rpc(office,'training_requirement_admin_20fa')).requirements
   .find(item=>item.id===completedReq).versions[0].id;
  await rpc(office,'training_requirement_publish_20fa',{
   p_version:completedVersion,p_reason:'Publish completed synthetic pilot proof'});
  const result=await rpc(staffA,'training_requirement_matrix_20fa',{
   p_person:ctx.personId,p_service:ctx.serviceId,p_role:ctx.roleId,p_as_of:ctx.asOf});
  assert.equal(result.rows.find(item=>item.requirementId===completedReq).status,'COMPLETED');
  assert.equal(result.rows.find(item=>item.requirementId===completedReq).completionId,completed.id);
  assert.ok((await staffB.rpc('training_requirement_matrix_20fa',{
   p_person:ctx.personId,p_service:ctx.serviceId,p_role:ctx.roleId,p_as_of:ctx.asOf})).error,
   'peer Staff denied');
  assert.ok((await operations.rpc('training_requirement_matrix_20fa',{
   p_person:ctx.personId,p_service:ctx.serviceId,p_role:ctx.roleId,p_as_of:ctx.asOf})).error,
   'Operations denied');
  assert.ok((await admin.rpc('training_requirement_publish_20fa',{
   p_version:first.id,p_reason:'Super role-only publication denial'})).error,
   'Super Admin role alone cannot publish');
  const endOn=new Date(`${ctx.asOf}T12:00:00Z`);
  endOn.setUTCDate(endOn.getUTCDate()+1);
  const nextDay=endOn.toISOString().slice(0,10);
  await rpc(office,'training_requirement_end_20fa',{
   p_version:first.id,p_end_on:nextDay,p_reason:'Close immutable synthetic pilot version for successor'});
  const ended=(await rpc(office,'training_requirement_admin_20fa')).requirements.find(item=>item.id===req);
  assert.equal(ended.versions[0].endedOn,nextDay);
  assert.ok(ended.events.some(event=>event.action==='ENDED' && event.versionId===first.id));
  const revised=await rpc(office,'training_requirement_revise_20fa',{
   p_previous:first.id,p_course_version:course.id,p_prior:'NOT_ACCEPTED',
   p_from:nextDay,p_until:null,p_reason:'Draft successor synthetic policy version'});
  await rpc(office,'training_requirement_publish_20fa',{
   p_version:revised,p_reason:'Publish successor synthetic policy version'});
  const versions=(await rpc(office,'training_requirement_admin_20fa')).requirements.find(item=>item.id===req).versions;
  assert.deepEqual(versions.map(version=>version.state),['PUBLISHED','PUBLISHED']);
  assert.notEqual(versions[0].hash,versions[1].hash);
  const oldDate=await rpc(staffA,'training_requirement_matrix_20fa',{
   p_person:ctx.personId,p_service:ctx.serviceId,p_role:ctx.roleId,p_as_of:ctx.asOf});
  assert.equal(oldDate.rows.find(item=>item.requirementId===req).versionId,first.id);
 } finally {
  for(const grant of grants.reverse()) await rpc(admin,'training_requirement_revoke_grant_20fa',{
   p_grant:grant,p_reason:'Synthetic pilot grant cleanup after proof'});
 }
 assert.equal((await rpc(office,'training_requirement_access_20fa')).viewer,false,
  'revocation removes viewer access immediately');
});
