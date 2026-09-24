import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createServerClient } from '@supabase/ssr';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const users={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD]};
async function cookiesFor(name){let cookies=[];const client=createServerClient(url,key,{cookies:{getAll:()=>cookies,setAll:(items)=>{cookies=items.map(({name,value})=>({name,value}))}}});const {error}=await signInWithTestSession(client,{email:users[name][0],password:users[name][1]});assert.ifError(error);return cookies.map(({name,value})=>`${name}=${value}`).join('; ')}
async function freePort(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const value=server.address().port;server.close();await once(server,'close');return value}

test('TASK-12A authenticated routes match Staff, reviewer and Office boundaries',{timeout:180000},async()=>{
 assert.ok(url&&key&&Object.values(users).every(([email,password])=>email&&password));
 const port=await freePort(),base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),stdio:'ignore'});
 try{
  for(let i=0;i<100;i++){try{await fetch(base);break}catch{await new Promise(r=>setTimeout(r,200))}}
  const session={};for(const name of Object.keys(users))session[name]=await cookiesFor(name);
  const get=(path,as)=>fetch(base+path,{redirect:'manual',headers:as?{cookie:session[as]}:{}});
  assert.equal((await get('/incidents')).headers.get('location'),'/?next=%2Fincidents');
  assert.equal((await get('/access/incident-reviewers')).headers.get('location'),'/?next=%2Faccess%2Fincident-reviewers');
  assert.equal((await get('/incidents','staff')).status,200);
  assert.equal((await get('/incidents','operations')).status,404,'Operations without an active reviewer grant cannot view route');
  assert.equal((await get('/incidents','office')).status,404,'Office role alone cannot view route');
  assert.equal((await get('/incidents','admin')).status,200,'Super Admin oversight is available');
  assert.equal((await get('/access/incident-reviewers','admin')).status,200,'Super Admin can manage reviewer grants');
  assert.equal((await get('/access/incident-reviewers','staff')).status,404);
  assert.equal((await get('/api/incidents','staff')).status,200);
  assert.equal((await get('/api/incidents','operations')).status,403);
  assert.equal((await get('/api/incidents','office')).status,403);
  assert.equal((await get('/api/incidents','admin')).status,200);
 }finally{server.kill('SIGTERM');if(server.exitCode===null)await once(server,'exit')}
});
