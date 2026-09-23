import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {createServerClient} from '@supabase/ssr';

const project=process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const caseId='3d3f1499-6163-4c9b-9adb-11972cedc985'; // Accepted synthetic Staff A V2 case.
assert.ok(project?.includes('dnfhkmmnlbiabqypclqg.supabase.co') && publishable);
async function session(email,password){
  let cookies=[];
  const client=createServerClient(project,publishable,{cookies:{getAll:()=>cookies,setAll:(items)=>{cookies=items.map(({name,value})=>({name,value}));}}});
  const result=await client.auth.signInWithPassword({email,password});assert.ifError(result.error);
  return cookies.map(({name,value})=>`${name}=${value}`).join('; ');
}
const staff=await session(process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD);
const office=await session(process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD);
const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
const port=listener.address().port;listener.close();await once(listener,'close');
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),stdio:'ignore'});
const post=(body)=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const put=(body)=>({method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
try {
  for(let i=0;i<100;i++){try{await fetch(base);break;}catch{await new Promise(r=>setTimeout(r,200));}}
  const call=async(path,cookie,options={})=>{const response=await fetch(base+path,{redirect:'manual',...options,headers:{cookie,...options.headers}});
    const text=await response.text();assert.ok(response.ok,`${path} ${response.status}: ${text.slice(0,250)}`);
    try{return JSON.parse(text);}catch{return text;}};
  const read=async()=> (await call(`/api/onboarding/${caseId}`,office)).case;
  let c=await read();assert.ok([3,4].includes(c.verifiedCount),'Unexpected fixture state; stop before adding submissions');
  assert.equal(c.requirements.find(x=>x.code==='SIA_LICENCE').state,'UPDATE_NEEDS_SUBMISSION');
  if(c.requirements.find(x=>x.code==='PERSONAL_DETAILS').state==='UPDATE_NEEDS_SUBMISSION') {
    await call('/api/profile/submissions',staff,post({caseId,requestKey:randomUUID()}));
    console.log('Personal Details explicitly resubmitted through Staff API');
  }
  const date=new Date(Date.now()+365*86400000).toISOString().slice(0,10);
  await call('/api/profile/sia',staff,put({category:'SECURITY_GUARDING',reference:`SYN-SIA-03F-${randomUUID().slice(0,8).toUpperCase()}`,expiresOn:date}));
  const submitted=await call('/api/profile/sia/submissions',staff,post({caseId,category:'SECURITY_GUARDING',requestKey:randomUUID()}));
  c=await read();const sia=c.requirements.find(x=>x.code==='SIA_LICENCE');
  assert.equal(sia.state,'AWAITING_EVIDENCE_REQUEST');
  const issued=await call(`/api/onboarding/${caseId}/sia-request`,office,post({requirementId:sia.id,submissionId:submitted.submissionId}));
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n2 0 obj\n<< /Length 81 >>\nstream\nSynthetic development SIA evidence. Not a real licence or register verification.\nendstream\nendobj\n%%EOF\n');
  const data=new FormData();data.set('file',new File([pdf],'synthetic-03f-sia-evidence.pdf',{type:'application/pdf'}));
  await call(`/api/documents/${issued.requestId}/upload`,staff,{method:'POST',body:data});
  const request=(await call(`/api/documents/${issued.requestId}`,office)).request;
  const versionId=request.version.id;
  await call(`/api/documents/${issued.requestId}/reviews`,office,post({versionId,decision:'ACCEPTED_AS_EVIDENCE'}));
  c=await read();assert.equal(c.requirements.find(x=>x.code==='SIA_LICENCE').state,'UNDER_REVIEW','Evidence acceptance must not verify SIA');
  await call(`/api/onboarding/${caseId}/sia-verify`,office,post({requirementId:sia.id,submissionId:submitted.submissionId,versionId}));
  c=await read();assert.equal(c.verifiedCount,5);assert.equal(c.requirements.find(x=>x.code==='CORE_KSS_INDUCTION').state,'NOT_CONNECTED');
  assert.equal(c.state,'IN_PROGRESS');
  console.log(JSON.stringify({caseId,submissionId:submitted.submissionId,requestId:issued.requestId,versionId,verifiedCount:c.verifiedCount,induction:'NOT_CONNECTED',state:c.state}));
} finally {server.kill();await once(server,'exit').catch(()=>{});}
