import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createServerClient } from '@supabase/ssr';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const users={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD]};
async function cookiesFor(name){let cookies=[];const client=createServerClient(url,key,{cookies:{
 getAll:()=>cookies,setAll:(items)=>{cookies=items.map(({name,value})=>({name,value}))}}});
 const {error}=await signInWithTestSession(client,{email:users[name][0],password:users[name][1]});assert.ifError(error);
 return cookies.map(({name,value})=>name+'='+value).join('; ');}
async function freePort(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port;server.close();await once(server,'close');return port;}

test('TASK-15A authenticated routes and role boundaries',{timeout:180000},async()=>{
 assert.ok(url&&key&&Object.values(users).every(([email,password])=>email&&password));
 const port=await freePort(),base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],
  {cwd:process.cwd(),stdio:'ignore'});
 try {
  for(let i=0;i<100;i++){try{await fetch(base);break}catch{await new Promise(resolve=>setTimeout(resolve,200));}}
  const session={};for(const name of Object.keys(users))session[name]=await cookiesFor(name);
  const get=(path,as)=>fetch(base+path,{redirect:'manual',headers:as?{cookie:session[as]}:{}});
  assert.equal((await get('/assets')).headers.get('location'),'/?next=%2Fassets');
  assert.equal((await get('/my-equipment')).headers.get('location'),'/?next=%2Fmy-equipment');
  assert.equal((await get('/assets','office')).status,200);
  assert.equal((await get('/assets','operations')).status,200);
  assert.equal((await get('/assets','admin')).status,200);
  assert.equal((await get('/assets','staff')).status,404);
  assert.equal((await get('/my-equipment','staff')).status,200);
  assert.equal((await get('/my-equipment','office')).status,404);
  const self=await get('/api/assets?self=1','staff');assert.equal(self.status,200);
  const selfData=(await self.json()).data;
  assert.ok(!selfData.stores.length&&!selfData.stock.length,'Staff projection has no store or global stock');
  assert.equal((await get('/api/assets?admin=1','staff')).status,403);
  assert.equal((await get('/api/assets?holders=1','staff')).status,403);
  assert.equal((await get('/api/assets?self=1','office')).status,403);
  assert.equal((await get('/api/assets?admin=1','admin')).status,200);
  const post=await fetch(base+'/api/assets',{method:'POST',headers:{cookie:session.staff,'content-type':'application/json'},
   body:JSON.stringify({action:'REGISTER',requestKey:crypto.randomUUID(),reference:'DENIED-STAFF',
     class:'RADIO',description:'Denied registration',condition:'GOOD',storeId:crypto.randomUUID()})});
  assert.equal(post.status,403);
 } finally {server.kill('SIGTERM');if(server.exitCode===null)await once(server,'exit');}
});
