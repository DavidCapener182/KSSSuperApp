import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const signing=process.env.KSS_DOCUMENT_SIGNING_SECRET,base=process.env.KSS_20E_APP_BASE_URL;
const person={office:'10000000-0000-4000-8000-000000000002',staff:'10000000-0000-4000-8000-000000000003'};
const credentials={admin:'ADMIN',office:'OFFICE',officeB:'OFFICE_B',operations:'OPERATIONS',staff:'STAFF_A',peer:'STAFF_B'};
const content=[{title:'Synthetic certificate module',pages:[{title:'Page one',blocks:[{type:'paragraph',text:'Synthetic Training only.'}]}]}];
const questions=[{id:'q1',type:'SINGLE',prompt:'Synthetic answer?',options:[{id:'a',text:'Alpha'},{id:'b',text:'Beta'}],key:['a']}];
async function actor(name){
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const code=credentials[name];
 assert.ifError((await signInWithTestSession(client,{email:process.env[`KSS_TEST_${code}_EMAIL`],
  password:process.env[`KSS_TEST_${code}_PASSWORD`]})).error);
 return client;
}
async function cookie(client){
 const {data:{session},error}=await client.auth.getSession();assert.ifError(error);assert.ok(session);
 let cookies=[];
 const ssr=createServerClient(url,key,{cookies:{getAll(){return cookies;},setAll(items){cookies=items;}}});
 assert.ifError((await ssr.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token})).error);
 return cookies.map(({name,value})=>`${name}=${value}`).join('; ');
}
const proof=(...parts)=>createHmac('sha256',Buffer.from(signing,'hex')).update(parts.join('\x1f'),'utf8').digest('hex');
function ok(result,label){assert.ifError(result.error,label);return result.data;}
async function call(client,name,args={}){return ok(await client.rpc(name,args),name);}
async function post(cookies,body){
 const response=await fetch(`${base}/api/training-certificates`,{method:'POST',headers:{Cookie:cookies,'Content-Type':'application/json'},
  body:JSON.stringify(body)});
 return {response,body:await response.json()};
}
async function file(cookies,id){return fetch(`${base}/api/training-certificates/${id}/file`,{headers:{Cookie:cookies}});}

test('20E explicit certificate issue, private PDF, revocation, reissue and Completion void',{timeout:240000},async()=>{
 assert.ok(url?.includes('dnfhkmmnlbiabqypclqg')&&key&&signing&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base||''),
  'synthetic Dev and local application required');
 const [admin,office,officeB,operations,staff,peer]=await Promise.all(Object.keys(credentials).map(actor));
 const temporary=[];
 const ensure=async(read,match,grant,revoke,args)=>{
  if(!(await call(admin,read)).some(match)) temporary.push([revoke,await call(admin,grant,args)]);
 };
 try {
  for(const capability of ['TRAINING_AUTHOR','TRAINING_PUBLISHER']) await ensure('training_grants',
   g=>g.personId===person.office&&g.capability===capability&&!g.revokedAt,
   'training_grant','training_revoke',{p_person:person.office,p_capability:capability,p_reason:'Synthetic certificate publication proof'});
  for(const capability of ['ASSESSMENT_AUTHOR','ASSESSMENT_PUBLISHER']) await ensure('training_assessment_grants_read',
   g=>g.personId===person.office&&g.capability===capability&&!g.revokedAt,
   'training_assessment_grant','training_assessment_revoke',{p_person:person.office,p_capability:capability,p_reason:'Synthetic certificate assessment proof'});
  await ensure('training_assigner_grants_read',g=>g.personId===person.office&&!g.revokedAt,
   'training_assigner_grant','training_assigner_revoke',{p_person:person.office,
    p_from:new Date(Date.now()-60000).toISOString(),p_until:null,p_reason:'Synthetic certificate assignment proof'});
  const existing=await call(admin,'training_completion_grants_read');
  if(!existing.grants.some(g=>g.personId===person.office&&!g.revokedAt)) temporary.push([
   'training_completion_revoke_grant',await call(admin,'training_completion_grant',
    {p_person:person.office,p_reason:'Synthetic certificate manager proof'})]);

  const course=await call(office,'training_create_course',{p_title:`Synthetic certificate ${Date.now()}`,
   p_summary:'Explicit certificate issue proof',p_content:content});
  const version=(await call(office,'training_admin',{p_course:course}))[0].versionId;
  await call(office,'training_publish',{p_version:version,p_revision:1});
  const assessment=await call(office,'training_assessment_create',{p_course_version:version,p_questions:questions});
  await call(office,'training_assessment_publish',{p_version:assessment,p_revision:1});
  const assignment=await call(office,'training_assign',{p_person:person.staff,p_course:course,p_version:version,
   p_due:'2026-12-22',p_reason:'Synthetic certificate assignment proof',p_request:randomUUID()});
  await call(office,'training_completion_publish_rule',{p_course_version:version,p_assessment_version:assessment,
   p_effective_from:new Date(Date.now()-60000).toISOString(),p_effective_until:null,p_validity_months:12});
  const attempt=await call(staff,'training_assessment_start',{p_assignment:assignment,p_version:assessment,p_request:randomUUID()});
  await call(staff,'training_assessment_submit',{p_attempt:attempt,p_revision:1,p_answers:{q1:['a']},p_request:randomUUID()});
  await call(staff,'training_mark_page',{p_assignment:assignment,p_module:1,p_page:1});
  assert.deepEqual(await call(staff,'training_certificate_history',{p_assignment:assignment}),[],
   'PASSED Attempt and page marks do not issue a certificate');
  const completion=(await call(staff,'training_completion_evaluate',{p_assignment:assignment,p_request:randomUUID()})).completionId;
  assert.ok(completion);
  assert.deepEqual(await call(staff,'training_certificate_history',{p_assignment:assignment}),[],
   'explicit Completion alone issues no certificate');
  assert.ok((await staff.from('training_certificate_issues').select('*')).error,'direct issue read denied');
  assert.ok((await office.from('training_certificate_issues').insert({id:randomUUID()})).error,'direct issue write denied');
  assert.ok((await office.rpc('training_certificate_issue_begin',{p_completion:completion,p_template:randomUUID(),
   p_request:randomUUID(),p_reissue_of:null,p_reason:'Synthetic direct call denial',p_proof:'bad'})).error,
   'browser cannot reserve with forged server proof');
  const template=await call(office,'training_certificate_publish_template',{
   p_title:'Training completion certificate',p_issuer_label:'KSS Training',
   p_statement:'This certificate records an explicit issue against the named learner and recorded course completion.'});
  assert.ok(template);
  const officeCookies=await cookie(office),staffCookies=await cookie(staff),peerCookies=await cookie(peer);
  const credentialFacts=async()=>{
   const response=await fetch(`${base}/api/credentials`,{headers:{Cookie:staffCookies}});
   assert.equal(response.status,200,'same Staff credential read remains separately authorised');
   const body=await response.json();
   return {claims:body.claims,revisions:body.revisions,decisions:body.decisions};
  };
  const credentialsBeforeCertificate=await credentialFacts();
  const requestA=randomUUID(),requestB=randomUUID();
  const input=(requestId,reissueOf=null)=>({action:'ISSUE',completionId:completion,templateVersionId:template,
   requestId,reissueOf,reason:'Synthetic explicit manager certificate decision'});
  const concurrent=await Promise.all([post(officeCookies,input(requestA)),post(officeCookies,input(requestB))]);
  assert.equal(concurrent.filter(x=>x.response.status===200).length,1,'concurrent issue has one winner');
  const winner=concurrent.find(x=>x.response.status===200);
  const winningRequest=winner===concurrent[0]?requestA:requestB;
  const issueId=winner.body.data.issueId;
  const history=await call(staff,'training_certificate_history',{p_assignment:assignment});
  assert.equal(history.filter(x=>x.current).length,1);
  assert.equal(history[0].id,issueId);assert.equal(history[0].completionId,completion);
  assert.deepEqual(await credentialFacts(),credentialsBeforeCertificate,
   'certificate issue cannot create or change the same Staff credential verification');
  assert.ok(history[0].expiryOn,'factual expiry comes from pinned 12-month rule');
  assert.equal((await post(officeCookies,input(winningRequest))).body.data.issueId,issueId,'exact replay returns same issue');
  assert.notEqual((await post(officeCookies,{...input(winningRequest),reason:'Changed certificate request replay'})).response.status,200,
   'changed-payload replay denied');
  assert.ok((await peer.rpc('training_certificate_history',{p_assignment:assignment})).error,'peer history denied');
  assert.ok((await operations.rpc('training_certificate_history',{p_assignment:assignment})).error,'Operations denied');
  assert.ok((await officeB.rpc('training_certificate_history',{p_assignment:assignment})).error,'ungranted Office denied');
  assert.ok((await staff.rpc('training_certificate_file_info',{p_issue:randomUUID(),p_proof:'bad'})).error,
   'guessed issue ID denied');
  const info=await call(office,'training_certificate_file_info',{p_issue:issueId,
   p_proof:proof('certificate_file_info',issueId)});
  const pdf=await file(staffCookies,issueId);
  assert.equal(pdf.status,200,'Staff application PDF succeeds');
  assert.match(pdf.headers.get('cache-control')||'',/no-store/);
  assert.equal(createHash('sha256').update(Buffer.from(await pdf.arrayBuffer())).digest('hex'),info.sha256,
   'immutable PDF matches recorded SHA-256');
  assert.equal((await file(peerCookies,issueId)).status,404,'peer guessed PDF denied');
  assert.ok((await staff.storage.from('training-certificates').download(info.objectKey)).error,
   'ordinary Staff direct Storage denied for known key');
  assert.ok((await operations.storage.from('training-certificates').download(info.objectKey)).error,
   'Operations direct Storage denied');
  assert.ok((await officeB.storage.from('training-certificates').download(info.objectKey)).error,
   'ungranted Office direct Storage denied');
  const shortGrant=await call(admin,'training_completion_grant',{
   p_person:'10000000-0000-4000-8000-000000000006',p_reason:'Synthetic certificate immediate manager revocation proof'});
  try {
   const officeBCookies=await cookie(officeB);
   assert.equal((await file(officeBCookies,issueId)).status,200,'named manager can open current certificate');
   await call(admin,'training_completion_revoke_grant',{p_grant:shortGrant,
    p_reason:'Synthetic certificate immediate manager revocation proof'});
   assert.equal((await file(officeBCookies,issueId)).status,404,'revoked manager immediately loses download');
   assert.ok((await officeB.rpc('training_certificate_history',{p_assignment:assignment})).error,
    'revoked manager loses history access');
  } finally {
   const grants=await call(admin,'training_completion_grants_read');
   if(grants.grants.some(g=>g.id===shortGrant&&!g.revokedAt))
    await call(admin,'training_completion_revoke_grant',{p_grant:shortGrant,
     p_reason:'Synthetic certificate manager grant cleanup'});
  }

  const revoked=await post(officeCookies,{action:'REVOKE',issueId,reason:'Synthetic certificate revocation proof',requestId:randomUUID()});
  assert.equal(revoked.response.status,200);
  assert.equal((await file(staffCookies,issueId)).status,404,'revoked application download denied');
  const fresh=await actor('staff');
  assert.equal((await file(await cookie(fresh),issueId)).status,404,'fresh Staff session cannot bypass revocation');
  assert.ok((await fresh.storage.from('training-certificates').download(info.objectKey)).error,
   'fresh Staff direct Storage remains denied');
  const reissue=await post(officeCookies,input(randomUUID(),issueId));
  assert.equal(reissue.response.status,200,'reasoned reissue succeeds');
  const nextId=reissue.body.data.issueId;
  assert.notEqual(nextId,issueId,'reissue has new immutable identity');
  const afterReissue=await call(staff,'training_certificate_history',{p_assignment:assignment});
  assert.equal(afterReissue.filter(x=>x.current).length,1);
  assert.equal(afterReissue.find(x=>x.id===nextId).reissueOf,issueId);
  assert.equal(afterReissue.find(x=>x.id===issueId).state,'REVOKED');
  const nextInfo=await call(office,'training_certificate_file_info',{p_issue:nextId,
   p_proof:proof('certificate_file_info',nextId)});
  assert.notEqual(nextInfo.objectKey,info.objectKey,'reissue uses a new private object');
  assert.notEqual(nextInfo.sha256,info.sha256,'reissue records new immutable PDF bytes');
  const privateReader=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const oldObject=await privateReader.storage.from('training-certificates').download(info.objectKey);
  assert.ifError(oldObject.error);
  assert.equal(createHash('sha256').update(Buffer.from(await oldObject.data.arrayBuffer())).digest('hex'),info.sha256,
   'revoked issue keeps its original private PDF and recorded hash');
  assert.equal((await file(staffCookies,nextId)).status,200);
  await call(office,'training_completion_void',{p_completion:completion,p_reason:'Synthetic certificate invalidation proof',p_request:randomUUID()});
  const afterVoid=await call(staff,'training_certificate_history',{p_assignment:assignment});
  assert.equal(afterVoid.find(x=>x.id===nextId).state,'COMPLETION_VOIDED');
  assert.ok(afterVoid.find(x=>x.id===nextId).events.some(x=>x.action==='COMPLETION_VOIDED'));
  assert.equal((await file(staffCookies,nextId)).status,404,'Completion void immediately invalidates PDF download');
  assert.deepEqual(await credentialFacts(),credentialsBeforeCertificate,
   'certificate revocation and Completion void cannot change credential verification');
  assert.ok((await call(staff,'training_completion_mine')).some(x=>x.id===completion&&x.voidedAt),
   'Completion and passed evidence retained');
 } finally {
  for(const [revoke,id] of temporary.reverse()) await call(admin,revoke,{p_grant:id,p_reason:'Synthetic certificate temporary grant cleanup'});
 }
});
