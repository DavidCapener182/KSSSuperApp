import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const signing=process.env.KSS_DOCUMENT_SIGNING_SECRET;
const staffA='10000000-0000-4000-8000-000000000003';
const office='10000000-0000-4000-8000-000000000002';
const service='584a0997-c869-432d-9b32-aac3de1c6750';
const serviceRole='1f4e0a75-5194-4f21-8936-1ff3b43460f7';
const siteA='30000000-0000-4000-8000-000000000001';
const emptyEvent='36cf541a-dbb7-477c-9c1a-616a97610341';
const credentials={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
 staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD]};
const diagnosticTokens=new Map();
const appBase=process.env.KSS_19A_APP_BASE_URL;
async function appCookieHeader(client){
 const { data: { session }, error }=await client.auth.getSession();assert.ifError(error);assert.ok(session);
 let cookies=[];
 const server=createServerClient(url,key,{cookies:{getAll(){return cookies;},setAll(items){cookies=items;}}});
 assert.ifError((await server.auth.setSession({access_token:session.access_token,
  refresh_token:session.refresh_token})).error);
 return cookies.map(({name,value})=>`${name}=${value}`).join('; ');
}
async function directStorageDenied(objectKey,token,label){
 const path=`${url}/storage/v1/object/enterprise-controlled-documents/${objectKey}`;
 for(const target of [path,`${path}?cacheNonce=${randomUUID()}`]){
  const response=await fetch(target,{headers:{apikey:key,Authorization:`Bearer ${token}`,
   'Cache-Control':'no-cache'}});
  assert.notEqual(response.status,200,`${label}: direct authenticated Storage returned bytes`);
  await response.arrayBuffer();
 }
}
async function actor(name){
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const signed=await signInWithTestSession(db,{email:credentials[name][0],password:credentials[name][1]});
 assert.ifError(signed.error);diagnosticTokens.set(name,signed.data.session.access_token);return db;
}
function proof(...parts){return createHmac('sha256',Buffer.from(signing,'hex')).update(parts.join('\x1f'),'utf8').digest('hex');}
function ok(result,context){assert.ifError(result.error,context);return result.data;}

test('19A operational exact-version assignment, source audience, replacement and 03C separation',
 {timeout:180000},async()=>{
 assert.ok(url&&key&&signing);
 const admin=await actor('admin'), officeActor=await actor('office'), staff=await actor('staff');
 const staffB=await actor('staffB'), operations=await actor('operations');
 assert.equal((ok(await operations.rpc('operational_document_capabilities'))).assign,false);
 assert.equal((ok(await officeActor.rpc('operational_document_capabilities'))).assign,false);
 const grant=ok(await admin.rpc('operational_document_grant',{
  target_person:office,capability_code:'ASSIGN',expires_at:new Date(Date.now()+86400000).toISOString()}));
 try {
  assert.equal((ok(await officeActor.rpc('operational_document_capabilities'))).assign,true);
  assert.equal((ok(await staff.rpc('operational_document_capabilities'))).publish,false);
  assert.ok((await staff.from('operational_document_assignments').select('id')).error,'no direct table reads');
  const documentId=ok(await admin.rpc('create_operational_controlled_document',{
   supplied_title:`Synthetic operational SOP ${randomUUID().slice(0,8)}`}));
  const bytes=await readFile('output/pdf/kss-development-terms-v1.pdf');
  const hash=createHash('sha256').update(bytes).digest('hex');
  async function publishVersion(){
   const filename='synthetic-operational-instruction.pdf';
   const pending=ok(await admin.rpc('begin_controlled_version',{
    requested_document:documentId,supplied_name:filename,supplied_size:bytes.length,supplied_sha256:hash,
    server_proof:proof('controlled_begin',documentId,filename,String(bytes.length),hash)}))[0];
   assert.ok(pending?.version_id);
   ok(await admin.storage.from('enterprise-controlled-documents').upload(pending.object_key,bytes,
    {contentType:'application/pdf',upsert:false,cacheControl:'0'}));
   assert.equal(ok(await admin.rpc('finalize_controlled_version',{
    requested_version:pending.version_id,server_proof:proof('controlled_finalize',pending.version_id,hash)})),true);
   assert.equal(ok(await admin.rpc('publish_controlled_version',{
    requested_version:pending.version_id,requested_effective_on:new Date().toISOString().slice(0,10)})),true);
   return pending;
  }
  const v1=await publishVersion();
  const from=new Date(Date.now()+1000).toISOString();
  const serviceAssignment=ok(await officeActor.rpc('operational_document_assign',{
   requested_version:v1.version_id,target_kind:'SITE_SERVICE',target_id:service,
   context_kind:null,context_id:null,required:true,effective_from:from,effective_until:null,assignment_reason:'Synthetic exact assignment test'}));
  const personAssignment=ok(await officeActor.rpc('operational_document_assign',{
   requested_version:v1.version_id,target_kind:'PERSON',target_id:staffA,
   context_kind:null,context_id:null,required:true,effective_from:from,effective_until:null,assignment_reason:'Synthetic exact assignment test'}));
  const siteAssignment=ok(await officeActor.rpc('operational_document_assign',{
   requested_version:v1.version_id,target_kind:'SITE',target_id:siteA,
   context_kind:null,context_id:null,required:false,effective_from:from,effective_until:null,assignment_reason:'Synthetic exact assignment test'}));
  const roleAssignment=ok(await officeActor.rpc('operational_document_assign',{
   requested_version:v1.version_id,target_kind:'OPERATIONAL_ROLE',target_id:serviceRole,
   context_kind:'SITE_SERVICE',context_id:service,required:true,effective_from:from,effective_until:null,assignment_reason:'Synthetic exact assignment test'}));
  const eventAssignment=ok(await officeActor.rpc('operational_document_assign',{
   requested_version:v1.version_id,target_kind:'EVENT',target_id:emptyEvent,
   context_kind:null,context_id:null,required:true,effective_from:from,effective_until:null,assignment_reason:'Synthetic exact assignment test'}));
  assert.ok((await operations.rpc('operational_document_assign',{
   requested_version:v1.version_id,target_kind:'PERSON',target_id:staffA,context_kind:null,context_id:null,
   required:true,effective_from:from,effective_until:null,assignment_reason:'Synthetic exact assignment test'})).error);
  assert.ok((await officeActor.rpc('operational_document_assign',{
   requested_version:v1.version_id,target_kind:'SITE_SERVICE',target_id:randomUUID(),context_kind:null,
   context_id:null,required:true,effective_from:from,effective_until:null,assignment_reason:'Synthetic exact assignment test'})).error);
  await new Promise((resolve)=>setTimeout(resolve,1300));
  const mineA=ok(await staff.rpc('operational_document_my_list')).assignments;
  const mineB=ok(await staffB.rpc('operational_document_my_list')).assignments;
  assert.ok(mineA.some((item)=>item.id===personAssignment&&item.current));
  assert.ok(mineA.some((item)=>item.id===serviceAssignment&&item.current),'current allocated service audience');
  assert.ok(mineA.some((item)=>item.id===siteAssignment&&item.current),'current exact Site assignment audience');
  assert.ok(mineA.some((item)=>item.id===roleAssignment&&item.current),'role within exact Service allocation');
  assert.ok(mineB.some((item)=>item.id===serviceAssignment&&item.current),'other allocated service person');
  assert.ok(!mineB.some((item)=>item.id===siteAssignment),'other Site does not inherit access');
  assert.ok(!mineA.some((item)=>item.id===eventAssignment),'Event configuration alone exposes no PDF');
  ok(await officeActor.rpc('operational_document_revoke',{assignment_id:siteAssignment,
   reason:'Synthetic Site scope check complete'}));
  ok(await officeActor.rpc('operational_document_revoke',{assignment_id:roleAssignment,
   reason:'Synthetic role scope check complete'}));
  ok(await officeActor.rpc('operational_document_revoke',{assignment_id:eventAssignment,
   reason:'Synthetic empty Event scope check complete'}));
  assert.ok((await staff.storage.from('enterprise-controlled-documents').download(v1.object_key)).error,
   'no direct byte access before open');
  assert.ok((await staff.rpc('operational_document_open',{assignment_id:personAssignment,server_proof:'bad'})).error);
  ok(await staff.rpc('operational_document_open',{assignment_id:personAssignment,
   server_proof:proof('operational_open',personAssignment,v1.version_id)}));
  assert.ok((await staff.storage.from('enterprise-controlled-documents').download(v1.object_key)).error,
   'Staff cannot retrieve operational bytes directly after an authorised open');
  await directStorageDenied(v1.object_key,diagnosticTokens.get('staff'),'current assignment');
  let appCookies;
  if(appBase){
   appCookies=await appCookieHeader(staff);
   const opened=await fetch(`${appBase}/api/operational-documents/my/${personAssignment}/file`,
    {headers:{Cookie:appCookies}});
   assert.equal(opened.status,200,'current exact assignment opens through application route');
   assert.equal(opened.headers.get('content-type'),'application/pdf');
   assert.match(opened.headers.get('cache-control')||'',/no-store/);
   assert.equal(createHash('sha256').update(Buffer.from(await opened.arrayBuffer())).digest('hex'),hash);
   assert.ok(![...opened.headers].some(([k,v])=>
    `${k}:${v}`.includes(v1.object_key)||`${k}:${v}`.includes(process.env.SUPABASE_SECRET_KEY||'UNSET_SECRET')),
    'browser response headers disclose neither object key nor server secret');
   const warmed=await staff.storage.from('enterprise-controlled-documents').download(v1.object_key);
   assert.ok(warmed.error,'known Storage key cannot warm a Staff CDN path');
  }
  assert.ok((await staff.rpc('operational_document_acknowledge',{assignment_id:personAssignment,server_proof:'bad'})).error);
  ok(await staff.rpc('operational_document_acknowledge',{assignment_id:personAssignment,
   server_proof:proof('operational_ack',personAssignment,v1.version_id)}));
  const status=ok(await officeActor.rpc('operational_document_status',{assignment_id:serviceAssignment}));
  assert.equal(status.recipientCount,2);assert.equal(status.acknowledgedCount,1);
  const opsStatus=ok(await operations.rpc('operational_document_context_status',
   {p_kind:'SITE_SERVICE',p_id:service}));
  assert.ok(opsStatus.assignments.some((item)=>item.assignmentId===serviceAssignment&&
   item.recipientCount===2&&item.acknowledgedCount===1));
  assert.ok((await staff.rpc('operational_document_context_status',
   {p_kind:'SITE_SERVICE',p_id:service})).error,'Staff cannot read manager counts');
  const v2=await publishVersion();
  assert.ok(ok(await staff.rpc('operational_document_my_list')).assignments.some((item)=>
   item.id===personAssignment&&item.version_id===v1.version_id&&item.acknowledged_at),
   'publishing alone preserves v1 assignment and acknowledgement');
  const replacementAt=new Date(Date.now()+1200).toISOString();
  const replacements=ok(await officeActor.rpc('operational_document_replace',{
   old_assignment_ids:[personAssignment,serviceAssignment],new_version:v2.version_id,
   replacement_at:replacementAt,reason:'Synthetic version two replaces exact first version'}));
  assert.equal(replacements.length,2);
  await new Promise((resolve)=>setTimeout(resolve,1400));
  const after=ok(await staff.rpc('operational_document_my_list')).assignments;
  assert.ok(after.some((item)=>item.version_id===v1.version_id&&!item.current&&item.acknowledged_at));
  assert.ok(after.some((item)=>item.version_id===v2.version_id&&item.current&&!item.acknowledged_at));
  assert.ok((await staff.rpc('operational_document_file_info',{assignment_id:personAssignment,
   server_proof:proof('operational_file_info',personAssignment)})).error,
   'source-authorised file route loses access immediately');
  if(appBase){
   const historical=await fetch(`${appBase}/api/operational-documents/my/${personAssignment}/file`,
    {headers:{Cookie:appCookies}});
   assert.equal(historical.status,404,'historical application route revokes immediately');
   await historical.arrayBuffer();
   const current=await fetch(`${appBase}/api/operational-documents/my/${replacements[0]}/file`,
    {headers:{Cookie:appCookies}});
   assert.equal(current.status,200,'replacement assignment opens through application route');
   assert.equal(createHash('sha256').update(Buffer.from(await current.arrayBuffer())).digest('hex'),hash);
  }
  assert.ok((await staff.storage.from('enterprise-controlled-documents').download(v1.object_key)).error,
   'previously known object key stays denied after replacement');
  await directStorageDenied(v1.object_key,diagnosticTokens.get('staff'),'same Staff session after replacement');
  const freshStaff=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const freshSignIn=await freshStaff.auth.signInWithPassword({email:credentials.staff[0],password:credentials.staff[1]});
  assert.ifError(freshSignIn.error);assert.ok(freshSignIn.data.session);
  assert.ok((await freshStaff.storage.from('enterprise-controlled-documents').download(v1.object_key)).error,
   'fresh Staff session cannot retrieve the old object key');
  await directStorageDenied(v1.object_key,freshSignIn.data.session.access_token,
   'fresh Staff session after replacement');
  assert.ok((await staff.rpc('operational_document_file_info',{assignment_id:replacements[0],
   server_proof:'bad'})).error,'Storage object key requires a server-only proof');
  if (process.env.KSS_19A_STORAGE_DIAGNOSTIC === '1') {
   const token=diagnosticTokens.get('staff');
   const tokenB=diagnosticTokens.get('staffB');
   await actor('staff');
   const freshToken=diagnosticTokens.get('staff');
   const path=`${url}/storage/v1/object/enterprise-controlled-documents/${v1.object_key}`;
   for (const seconds of [0,30,60,90,120]) {
    if (seconds) await new Promise((resolve)=>setTimeout(resolve,30000));
    const probes=await Promise.all([
     fetch(path,{headers:{apikey:key,Authorization:`Bearer ${token}`, 'Cache-Control':'no-cache'}}),
     fetch(`${path}?cacheNonce=${randomUUID()}`,{headers:{apikey:key,Authorization:`Bearer ${token}`, 'Cache-Control':'no-cache'}}),
     fetch(path,{headers:{apikey:key,Authorization:`Bearer ${tokenB}`, 'Cache-Control':'no-cache'}}),
     fetch(path,{headers:{apikey:key,Authorization:`Bearer ${key}`, 'Cache-Control':'no-cache'}}),
     fetch(path,{headers:{apikey:key,Authorization:`Bearer ${freshToken}`, 'Cache-Control':'no-cache'}}),
    ]);
    console.log('STORAGE_DIAGNOSTIC',JSON.stringify({seconds,probes:probes.map((r)=>({
     status:r.status,cacheControl:r.headers.get('cache-control'),age:r.headers.get('age'),
     cfCache:r.headers.get('cf-cache-status'),etag:r.headers.get('etag'),
     storageMode:r.headers.get('x-sb-cache-status')}))}));
    if(seconds===0) console.log('STORAGE_DIAGNOSTIC_ERRORS',JSON.stringify(await Promise.all(
     probes.map((r)=>r.status===200?Promise.resolve('ok'):r.clone().text().then((value)=>value.slice(0,240))))));
    await Promise.all(probes.map((r)=>r.arrayBuffer()));
   }
  }
  assert.ok((await staff.from('operational_document_acknowledgements').select('id')).error,
   'acknowledgement history not directly exposed');
 } finally { ok(await admin.rpc('operational_document_revoke_grant',{grant_id:grant})); }
});
