import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminId='10000000-0000-4000-8000-000000000001';
const staffA='10000000-0000-4000-8000-000000000003';
const staffB='10000000-0000-4000-8000-000000000004';
async function as(email,password){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email,password});assert.ifError(error);return client;}
const issue={storeName:'Synthetic TFS Store',storeNumber:'00123',region:'unassigned',owner:'Unassigned',type:'Stock loss',priority:'Review',status:'Needs triage',evidenceDate:'',evidenceSummary:'Synthetic discrepancy for access proof only',nextAction:'Review the synthetic source note',sourceNote:'Synthetic test fixture; no Outlook source',potentialInternalTheftReview:false};

test('CW01 exact grant, cross-client denial, revocation and issue readback', {timeout:120000}, async()=>{
 assert.ok(url&&key&&process.env.KSS_TEST_ADMIN_PASSWORD&&process.env.KSS_TEST_STAFF_A_PASSWORD&&process.env.KSS_TEST_STAFF_B_PASSWORD);
 const [admin,a,b]=await Promise.all([
  as(process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD),
  as(process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD),
  as(process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD)]);
 const anon=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 for(const table of ['client_workspaces','client_workspace_modules','client_workspace_grants','client_workspace_grant_events','tfs_lp_issues','tfs_lp_issue_events']){
  assert.ok((await anon.from(table).select('*')).error, `${table}: anonymous direct read denied`);
  assert.ok((await a.from(table).select('*')).error, `${table}: authenticated direct read denied`);
 }
 const marker=`CW01 synthetic ${Date.now()}`;
 const orgA=await admin.from('crm_organisations').insert({name:`${marker} A`,relationship_status:'CLIENT',created_by_person_id:adminId}).select('id').single();assert.ifError(orgA.error);
 const orgB=await admin.from('crm_organisations').insert({name:`${marker} B`,relationship_status:'CLIENT',created_by_person_id:adminId}).select('id').single();assert.ifError(orgB.error);
 const wa=await admin.rpc('cw_create_workspace',{p_organisation:orgA.data.id,p_reason:'Synthetic exact grant proof'});assert.ifError(wa.error);
 const wb=await admin.rpc('cw_create_workspace',{p_organisation:orgB.data.id,p_reason:'Synthetic cross-client proof'});assert.ifError(wb.error);
 const grantA=await admin.rpc('cw_grant',{p_workspace:wa.data,p_person:staffA,p_permission:'OPERATE',p_reason:'Synthetic scoped issue proof'});assert.ifError(grantA.error);
 const grantB=await admin.rpc('cw_grant',{p_workspace:wb.data,p_person:staffB,p_permission:'OPERATE',p_reason:'Synthetic other client proof'});assert.ifError(grantB.error);
 const dirA=await a.rpc('cw_directory');assert.ifError(dirA.error);assert.ok(dirA.data.some(x=>x.id===wa.data));assert.ok(!dirA.data.some(x=>x.id===wb.data));
 const dirB=await b.rpc('cw_directory');assert.ifError(dirB.error);assert.ok(dirB.data.some(x=>x.id===wb.data));assert.ok(!dirB.data.some(x=>x.id===wa.data));
 assert.ok((await a.rpc('cw_workspace',{p_workspace:wb.data})).error);
 assert.ok((await a.rpc('cw_issues',{p_workspace:wb.data})).error);
 assert.ok((await a.rpc('cw_issue',{p_workspace:wb.data,p_issue:crypto.randomUUID()})).error);
 assert.ok((await a.rpc('cw_issue_save',{p_workspace:wb.data,p_issue:null,p_revision:null,p_data:issue,p_reason:null})).error);
 const created=await a.rpc('cw_issue_save',{p_workspace:wa.data,p_issue:null,p_revision:null,p_data:issue,p_reason:null});assert.ifError(created.error);
 const readback=await a.rpc('cw_issue',{p_workspace:wa.data,p_issue:created.data});assert.ifError(readback.error);
 assert.equal(readback.data.store_number,'00123');assert.equal(readback.data.revision,1);assert.equal(readback.data.history.length,1);
 const changed=await a.rpc('cw_issue_save',{p_workspace:wa.data,p_issue:created.data,p_revision:1,p_data:{...issue,status:'Investigating'},p_reason:'Synthetic status review'});assert.ifError(changed.error);
 const after=await a.rpc('cw_issue',{p_workspace:wa.data,p_issue:created.data});assert.ifError(after.error);
 assert.equal(after.data.status,'Investigating');assert.equal(after.data.revision,2);assert.equal(after.data.history.length,2);
 assert.ok((await a.rpc('cw_issue_save',{p_workspace:wa.data,p_issue:created.data,p_revision:1,p_data:issue,p_reason:'Stale synthetic write'})).error);
 assert.equal((await b.rpc('cw_issue',{p_workspace:wb.data,p_issue:created.data})).data,null);
 const revoked=await admin.rpc('cw_revoke',{p_grant:grantA.data,p_reason:'Synthetic immediate revoke proof'});assert.ifError(revoked.error);
 const cutOff=await a.rpc('cw_directory');assert.ifError(cutOff.error);assert.ok(!cutOff.data.some(x=>x.id===wa.data));
 assert.ok((await a.rpc('cw_workspace',{p_workspace:wa.data})).error);
 assert.ok((await a.rpc('cw_issues',{p_workspace:wa.data})).error);
 assert.ok((await a.rpc('cw_issue',{p_workspace:wa.data,p_issue:created.data})).error);
 assert.ok((await a.rpc('cw_issue_save',{p_workspace:wa.data,p_issue:created.data,p_revision:2,p_data:issue,p_reason:'Denied after revoke'})).error);
 assert.ok(grantB.data);
});
