import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const users={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 officeB:[process.env.KSS_TEST_OFFICE_B_EMAIL,process.env.KSS_TEST_OFFICE_B_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD]};
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:users[name][0],password:users[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args={}){const {data,error}=await client.rpc(name,args);assert.ifError(error,`${name}: ${error?.message}`);return data;}
const content=(label)=>[{title:'Module '+label,pages:[{title:'Page '+label,blocks:[{type:'heading',text:'Heading '+label},{type:'paragraph',text:'Synthetic content '+label},{type:'callout',text:'No learning result is recorded'}]}]}];

test('TASK-20B version sealing, audience, grants, concurrency and retirement',{timeout:180000},async()=>{
 assert.ok(url?.includes('dnfhkmmnlbiabqypclqg'),'literal Dev target');
 assert.ok(key&&Object.values(users).every(([email,password])=>email&&password));
 const [admin,office,officeB,operations,staff]=await Promise.all(Object.keys(users).map(signed));
 const anon=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.ok((await anon.rpc('training_catalogue')).error,'unauthenticated catalogue denied');
 assert.ok((await staff.from('training_course_versions').select('id')).error,'direct Staff read denied');
 assert.ok((await office.from('training_course_versions').select('id')).error,'direct Office read denied');
 assert.ok((await office.from('training_course_versions').update({title:'tampered'}).eq('id',crypto.randomUUID())).error,'direct edit denied');
 assert.ok((await staff.rpc('training_admin')).error,'Staff administration denied');
 assert.ok((await operations.rpc('training_admin')).error,'Operations administration denied');
 assert.ok((await officeB.rpc('training_admin')).error,'Office membership alone denied');
 assert.ok((await officeB.rpc('training_create_course',{p_title:'Denied',p_summary:'Denied',p_content:content('denied')})).error);
 assert.ok((await office.rpc('training_grant',{p_person:crypto.randomUUID(),p_capability:'TRAINING_AUTHOR',p_reason:'Office cannot grant this'})).error);
 const officeBPerson='10000000-0000-4000-8000-000000000006';
 const grant=await rpc(admin,'training_grant',{p_person:officeBPerson,p_capability:'TRAINING_AUTHOR',p_reason:'Synthetic 20B author separation proof'});
 assert.ok((await rpc(admin,'training_grants')).some(g=>g.id===grant&&g.revokedAt===null),'Super oversight readback');
 const split=await rpc(officeB,'training_capabilities');assert.equal(split.author,true);assert.equal(split.publisher,false);
 const authorOnly=await rpc(officeB,'training_create_course',{p_title:'Synthetic author only '+Date.now(),p_summary:'Finite capability proof',p_content:content('author')});
 const authorDraft=(await rpc(officeB,'training_admin',{p_course:authorOnly}))[0];
 assert.ok((await officeB.rpc('training_publish',{p_version:authorDraft.versionId,p_revision:1})).error,'author grant cannot publish');
 await rpc(admin,'training_revoke',{p_grant:grant,p_reason:'Synthetic separation proof complete'});
 assert.ok((await rpc(admin,'training_grants')).some(g=>g.id===grant&&g.revokedAt&&g.revokedReason==='Synthetic separation proof complete'),'attributable revocation readback');
 assert.equal((await rpc(officeB,'training_capabilities')).author,false);
 assert.ok((await officeB.rpc('training_edit_draft',{p_version:authorDraft.versionId,p_revision:1,p_title:'Denied now',p_summary:'Revoked author',p_content:content('denied')})).error,'revoked grant denied');
 await rpc(admin,'training_abandon_draft',{p_version:authorDraft.versionId,p_revision:1,p_reason:'Synthetic author separation test complete'});
 const course=await rpc(office,'training_create_course',{p_title:'Synthetic 20B proof '+Date.now(),p_summary:'Synthetic catalogue test',p_content:content('v1')});
 const adminRows=await rpc(office,'training_admin',{p_course:course});
 const v1=adminRows[0];assert.equal(v1.state,'DRAFT');
 assert.equal((await rpc(staff,'training_catalogue',{p_course:course})).length,0,'draft absent from Staff catalogue');
 assert.equal((await rpc(operations,'training_catalogue',{p_course:course})).length,0,'draft absent from Operations catalogue');
 assert.ok((await office.rpc('training_publish',{p_version:v1.versionId,p_revision:1})).error === null,'publisher grant permits publication');
 const publishedV1=(await rpc(office,'training_admin',{p_course:course}))[0];
 assert.equal(publishedV1.state,'PUBLISHED');assert.ok(publishedV1.contentHash);
 assert.equal((await rpc(staff,'training_catalogue',{p_course:course}))[0].versionId,v1.versionId);
 assert.ok((await staff.rpc('training_edit_draft',{p_version:v1.versionId,p_revision:1,p_title:'No',p_summary:'No',p_content:content('bad')})).error);
 assert.ok((await office.rpc('training_edit_draft',{p_version:v1.versionId,p_revision:1,p_title:'Altered published',p_summary:'No',p_content:content('bad')})).error);
 const next=await rpc(office,'training_create_draft',{p_course:course});
 const draft=(await rpc(office,'training_admin',{p_course:course})).find(v=>v.versionId===next);
 assert.equal(draft.versionNumber,2);assert.equal(draft.state,'DRAFT');
 assert.equal((await rpc(staff,'training_catalogue',{p_course:course}))[0].versionId,v1.versionId,'draft v2 invisible');
 assert.ok((await office.rpc('training_edit_draft',{p_version:next,p_revision:1,p_title:'Synthetic v2',p_summary:'No HTML',p_content:[{title:'Bad',pages:[{title:'Page',blocks:[{type:'html',text:'<iframe>'}]}]}]})).error,'unsupported block denied');
 const oversized=[{title:'Oversized',pages:[{title:'Page',blocks:Array.from({length:12},()=>({type:'paragraph',text:'x'.repeat(1500)}))}]}];
 assert.ok((await office.rpc('training_edit_draft',{p_version:next,p_revision:1,p_title:'Synthetic v2',p_summary:'Too large',p_content:oversized})).error,'16KB page limit enforced in database');
 const revision=await rpc(office,'training_edit_draft',{p_version:next,p_revision:1,p_title:'Synthetic v2',p_summary:'A second exact package',p_content:content('v2')});
 assert.equal(revision,2);
 assert.ok((await office.rpc('training_edit_draft',{p_version:next,p_revision:1,p_title:'Stale edit',p_summary:'Denied',p_content:content('bad')})).error,'stale edit rejected');
 assert.ok((await office.rpc('training_publish',{p_version:next,p_revision:1})).error,'stale publish rejected');
 const concurrent=await Promise.all([office.rpc('training_publish',{p_version:next,p_revision:2}),office.rpc('training_publish',{p_version:next,p_revision:2})]);
 assert.equal(concurrent.filter(x=>!x.error).length,1,'one publication wins');
 assert.ok((await office.rpc('training_publish',{p_version:next,p_revision:2})).error,'retry cannot duplicate publication');
 const adminAfter=await rpc(office,'training_admin',{p_course:course});
 assert.equal(adminAfter.find(v=>v.versionId===v1.versionId).contentHash,publishedV1.contentHash);
 assert.deepEqual(adminAfter.find(v=>v.versionId===v1.versionId).modules,publishedV1.modules,'v1 content unchanged');
 assert.equal(adminAfter.find(v=>v.versionId===v1.versionId).publishedAt,publishedV1.publishedAt,'v1 publication time unchanged');
 assert.equal((await rpc(staff,'training_catalogue',{p_course:course}))[0].versionId,next,'only v2 current');
 const events=await rpc(office,'training_history',{p_course:course});
 assert.equal(events.filter(e=>e.action==='PUBLISH'&&e.versionId===next).length,1,'one publication event');
 assert.equal(events.filter(e=>e.action==='SUPERSEDE'&&e.versionId===v1.versionId).length,1);
 assert.ok(!JSON.stringify(events).includes('Synthetic content v2'),'generic history excludes body');
 assert.ok((await operations.rpc('training_retire',{p_version:next,p_reason:'No publishing access'})).error);
 await rpc(office,'training_retire',{p_version:next,p_reason:'Synthetic version lifecycle proof'});
 assert.equal((await rpc(staff,'training_catalogue',{p_course:course})).length,0,'retired course disappears');
 assert.ok((await office.rpc('training_retire',{p_version:next,p_reason:'Repeat retirement denied'})).error);
 assert.ok((await office.rpc('training_edit_draft',{p_version:next,p_revision:2,p_title:'Tampered',p_summary:'Denied',p_content:content('bad')})).error);
 const afterRetire=await rpc(office,'training_admin',{p_course:course});
 assert.ok(afterRetire.find(v=>v.versionId===next).retiredAt,'historical version retained');
 assert.equal(afterRetire.find(v=>v.versionId===v1.versionId).contentHash,publishedV1.contentHash);
 const missing=(await staff.rpc('training_catalogue',{p_course:crypto.randomUUID()}));assert.ifError(missing.error);assert.deepEqual(missing.data,[]);
});
