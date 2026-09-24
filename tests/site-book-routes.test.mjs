import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createServerClient } from '@supabase/ssr';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const users={office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD]};
async function cookiesFor(name){let cookies=[];const client=createServerClient(url,key,{cookies:{getAll:()=>cookies,setAll:(items)=>{cookies=items.map(({name,value})=>({name,value}))}}});const {error}=await signInWithTestSession(client,{email:users[name][0],password:users[name][1]});assert.ifError(error);return cookies.map(({name,value})=>`${name}=${value}`).join('; ')}
async function freePort(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const value=server.address().port;server.close();await once(server,'close');return value}

test('TASK-14A authenticated routes preserve Office grant and Staff book boundaries',{timeout:120000},async()=>{
 assert.ok(url&&key&&Object.values(users).every(x=>x.every(Boolean)));
 const port=await freePort(),base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),stdio:'ignore'});
 try{
  for(let i=0;i<100;i++){try{await fetch(base);break}catch{await new Promise(r=>setTimeout(r,200))}}
  const office=await cookiesFor('office'),staff=await cookiesFor('staff');
  const get=(path,cookie)=>fetch(base+path,{redirect:'manual',headers:cookie?{cookie}:{}});
  assert.equal((await get('/site-book')).headers.get('location'),'/?next=%2Fsite-book');
  assert.equal((await get('/site-book/access')).headers.get('location'),'/?next=%2Fsite-book%2Faccess');
  assert.equal((await get('/site-book',staff)).status,200);
  assert.equal((await get('/site-book/access',staff)).status,404);
  assert.equal((await get('/site-book/access',office)).status,200);
  assert.equal((await get('/api/site-book',staff)).status,200);
  assert.equal((await get('/api/site-book/grants',staff)).status,403);
  assert.equal((await get('/api/site-book/grants',office)).status,200);
  assert.equal((await get('/api/site-book/00000000-0000-4000-8000-000000000000',staff)).status,404);
  assert.equal((await get('/api/site-book/00000000-0000-4000-8000-000000000000?mode=search',staff)).status,404);
 }finally{server.kill('SIGTERM');if(server.exitCode===null)await once(server,'exit')}
});
