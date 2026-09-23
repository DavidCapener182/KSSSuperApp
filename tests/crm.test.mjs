import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const users={
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 officeB:[process.env.KSS_TEST_OFFICE_B_EMAIL,process.env.KSS_TEST_OFFICE_B_PASSWORD],
 admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
};
const person={office:'10000000-0000-4000-8000-000000000002',officeB:'10000000-0000-4000-8000-000000000006'};
function newClient(){return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
async function signed(as){const client=newClient();const {error}=await client.auth.signInWithPassword({email:users[as][0],password:users[as][1]});assert.ifError(error);return client;}
const rpc=async(client,name,args)=>{const result=await client.rpc(name,args);assert.ifError(result.error);return result.data;};
async function cookie(as){let cookies=[];const client=createServerClient(url,key,{cookies:{getAll:()=>cookies,setAll:(items)=>{cookies=items.map(({name,value})=>({name,value}));}}});const {error}=await client.auth.signInWithPassword({email:users[as][0],password:users[as][1]});assert.ifError(error);return cookies.map(({name,value})=>`${name}=${value}`).join('; ');}
async function port(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const number=server.address().port;server.close();await once(server,'close');return number;}

test('05A guarded CRM lifecycle, exact Client identity and role isolation', {timeout:180000}, async()=>{
 assert.ok(url&&key&&Object.values(users).every((u)=>u[0]&&u[1]));
 const [office,officeB,admin,ops,staff]=await Promise.all(['office','officeB','admin','operations','staff'].map(signed));
 const anon=newClient();
 assert.ok((await anon.rpc('crm_create_organisation',{p_name:'Forbidden'})).error);
 for(const denied of [ops,staff]){
  assert.deepEqual((await denied.from('crm_organisations').select('id')).data,[]);
  assert.ok((await denied.rpc('crm_create_organisation',{p_name:'Forbidden'})).error);
 }
 const label=`Synthetic CRM ${Date.now()}`;
 const organisation=await rpc(office,'crm_create_organisation',{p_name:label});
 await rpc(office,'crm_update_organisation',{p_id:organisation,p_name:label,p_trading_name:null,p_website:null,p_email:null,p_phone:null,p_owner:person.officeB});
 assert.equal((await office.from('crm_organisation_owner_events').select('id').eq('organisation_id',organisation)).data.length,1);
 assert.equal((await officeB.from('crm_organisations').select('id').eq('id',organisation).single()).data.id,organisation);
 assert.deepEqual((await ops.from('crm_organisations').select('id').eq('id',organisation)).data,[]);
 assert.ok((await office.from('crm_organisations').update({relationship_status:'CLIENT'}).eq('id',organisation)).error);
 assert.ok((await office.from('crm_relationship_events').insert({organisation_id:organisation})).error);
 assert.ok((await office.from('audit_events').insert({entity_type:'crm_organisation',entity_id:organisation})).error);
 const a=await rpc(office,'crm_create_contact',{p_organisation:organisation,p_first:'Synthetic',p_last:'Buyer',p_email:'synthetic.buyer@example.test',p_primary:true});
 const b=await rpc(office,'crm_create_contact',{p_organisation:organisation,p_first:'Synthetic',p_last:'Procurement',p_email:'synthetic.procurement@example.test'});
 assert.notEqual(a,b);
 assert.ok((await office.rpc('crm_create_contact',{p_organisation:organisation,p_first:'Duplicate',p_last:'Buyer',p_email:'synthetic.buyer@example.test'})).error);
 assert.ok((await office.rpc('crm_create_contact',{p_organisation:organisation,p_first:'Synthetic',p_last:'Procurement'})).error);
 assert.equal((await office.from('crm_contacts').select('id').eq('organisation_id',organisation).eq('is_primary',true)).data.length,1);
 await rpc(office,'crm_update_contact',{p_id:b,p_first:'Synthetic',p_last:'Procurement',p_title:null,p_email:'synthetic.procurement@example.test',p_phone:null,p_active:true,p_primary:true});
 assert.deepEqual((await office.from('crm_contacts').select('id').eq('organisation_id',organisation).eq('is_primary',true)).data.map((row)=>row.id),[b]);
 const other=await rpc(office,'crm_create_organisation',{p_name:`${label} other`});
 assert.ok((await office.rpc('crm_create_opportunity',{p_organisation:other,p_title:'Wrong contact',p_type:'TENDER',p_owner:person.office,p_contact:a})).error);
 assert.ok((await office.rpc('crm_create_opportunity',{p_organisation:organisation,p_title:'Forged owner',p_type:'TENDER',p_owner:'10000000-0000-4000-8000-000000000003'})).error);
 const opportunity=await rpc(office,'crm_create_opportunity',{p_organisation:organisation,p_title:'Synthetic festival security',p_type:'TENDER',p_owner:person.office,p_contact:a,p_value:12000000});
 assert.equal((await office.from('crm_opportunities').select('stage').eq('id',opportunity).single()).data.stage,'NEW_LEAD');
 await rpc(office,'crm_transition_opportunity',{p_id:opportunity,p_stage:'PROPOSAL_TENDER'});
 assert.ok((await office.rpc('crm_transition_opportunity',{p_id:opportunity,p_stage:'QUALIFIED'})).error);
 await rpc(office,'crm_transition_opportunity',{p_id:opportunity,p_stage:'QUALIFIED',p_reason:'Corrected after discovery call'});
 await rpc(office,'crm_change_opportunity_owner',{p_id:opportunity,p_owner:person.officeB});
 await rpc(officeB,'crm_change_opportunity_value',{p_id:opportunity,p_value:13000000});
 await rpc(officeB,'crm_transition_opportunity',{p_id:opportunity,p_stage:'WON'});
 assert.equal((await office.from('crm_organisations').select('relationship_status').eq('id',organisation).single()).data.relationship_status,'CLIENT');
 assert.equal((await office.from('crm_relationship_events').select('id').eq('organisation_id',organisation)).data.length,1);
 assert.ok((await office.rpc('crm_transition_opportunity',{p_id:opportunity,p_stage:'LOST',p_reason:'Impossible'})).error);
 assert.ok((await office.rpc('crm_change_opportunity_value',{p_id:opportunity,p_value:1})).error);
 const renewal=await rpc(office,'crm_create_opportunity',{p_organisation:organisation,p_title:'Synthetic renewal',p_type:'RENEWAL',p_owner:person.office});
 assert.ok((await office.rpc('crm_transition_opportunity',{p_id:renewal,p_stage:'LOST'})).error);
 await rpc(office,'crm_transition_opportunity',{p_id:renewal,p_stage:'LOST',p_reason:'Synthetic budget decision'});
 assert.equal((await office.from('crm_organisations').select('relationship_status').eq('id',organisation).single()).data.relationship_status,'CLIENT');
 assert.equal((await office.from('crm_opportunity_events').select('id').eq('opportunity_id',opportunity)).data.length,5);
 assert.ifError((await admin.from('crm_organisations').select('id').eq('id',organisation).single()).error);
 const officeBRole='20000000-0000-4000-8000-000000000006';
 try{
  assert.ifError((await admin.from('role_assignments').update({effective_until:new Date(Date.now()-1000).toISOString()}).eq('id',officeBRole)).error);
  assert.deepEqual((await officeB.from('crm_organisations').select('id').eq('id',organisation)).data,[]);
  assert.ok((await officeB.rpc('crm_create_organisation',{p_name:'Denied after role expiry'})).error);
 }finally{
  assert.ifError((await admin.from('role_assignments').update({effective_until:null}).eq('id',officeBRole)).error);
 }
});

test('05A CRM routes enforce role and guessed-ID boundaries', {timeout:90000}, async()=>{
 const base=`http://127.0.0.1:${await port()}`;
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',new URL(base).port],{cwd:process.cwd(),stdio:'ignore'});
 try{
  for(let i=0;i<100;i++){try{await fetch(base);break;}catch{await new Promise((resolve)=>setTimeout(resolve,200));}}
  const cookies=Object.fromEntries(await Promise.all(['office','operations','staff'].map(async(as)=>[as,await cookie(as)])));
  const get=(path,as)=>fetch(base+path,{redirect:'manual',headers:as?{cookie:cookies[as]}:{}});
  assert.equal((await get('/crm')).status,307);
  assert.equal((await get('/api/crm')).status,401);
  assert.equal((await get('/crm','office')).status,200);
  assert.equal((await get('/api/crm?view=overview','office')).status,200);
  assert.equal((await get('/crm','operations')).status,404);
  assert.equal((await get('/crm','staff')).status,404);
  assert.equal((await get('/api/crm','operations')).status,403);
  assert.equal((await get('/api/crm','staff')).status,403);
  assert.equal((await get('/api/crm?view=organisation&id=10000000-0000-4000-8000-000000000001','office')).status,404);
  const denied=await fetch(base+'/api/crm',{method:'POST',headers:{cookie:cookies.staff,'content-type':'application/json'},body:JSON.stringify({action:'createOrganisation',name:'Denied'})});
  assert.equal(denied.status,403);
 }finally{server.kill('SIGTERM');if(server.exitCode===null)await once(server,'exit');}
});
