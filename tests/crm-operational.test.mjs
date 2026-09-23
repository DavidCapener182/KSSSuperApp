import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const identities={
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 officeB:[process.env.KSS_TEST_OFFICE_B_EMAIL,process.env.KSS_TEST_OFFICE_B_PASSWORD],
 admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 staff:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
};
const person={office:'10000000-0000-4000-8000-000000000002',officeB:'10000000-0000-4000-8000-000000000006'};
async function signed(as){
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await client.auth.signInWithPassword({email:identities[as][0],password:identities[as][1]});
 assert.ifError(error); return client;
}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);assert.ifError(error);return data;}
async function cookie(as){
 let cookies=[];const client=createServerClient(url,key,{cookies:{getAll:()=>cookies,setAll:(items)=>{cookies=items.map(({name,value})=>({name,value}));}}});
 const {error}=await client.auth.signInWithPassword({email:identities[as][0],password:identities[as][1]});
 assert.ifError(error);return cookies.map(({name,value})=>`${name}=${value}`).join('; ');
}
async function port(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const number=server.address().port;server.close();await once(server,'close');return number;}

test('05B CRM activities and shared follow-up Tasks retain exact authority and independent state', {timeout:180000}, async()=>{
 assert.ok(url&&key&&Object.values(identities).every((values)=>values[0]&&values[1]));
 const office=await signed('office'); const officeB=await signed('officeB');
 const admin=await signed('admin'); const staff=await signed('staff'); const operations=await signed('operations');
 const organisation=await rpc(office,'crm_create_organisation',{p_name:`Synthetic 05B ${Date.now()}`});
 const other=await rpc(office,'crm_create_organisation',{p_name:`Synthetic 05B other ${Date.now()}`});
 const contact=await rpc(office,'crm_create_contact',{p_organisation:organisation,p_first:'Synthetic',p_last:'Contact'});
 const opportunity=await rpc(office,'crm_create_opportunity',{p_organisation:organisation,p_title:'Synthetic operational CRM',p_type:'TENDER',p_owner:person.office});
 const activity=await rpc(office,'crm_record_activity',{p_organisation:organisation,p_opportunity:opportunity,p_contact:contact,p_type:'PHONE_CALL',p_subject:'Synthetic discovery call'});
 assert.equal((await office.from('crm_activities').select('actor_person_id').eq('id',activity).single()).data.actor_person_id,person.office);
 assert.ok((await office.rpc('crm_record_activity',{p_organisation:other,p_opportunity:opportunity,p_contact:contact,p_type:'PHONE_CALL',p_subject:'Wrong relationship'})).error);
 assert.ok((await office.from('crm_activities').update({subject:'Forged edit'}).eq('id',activity)).error);
 assert.ok((await office.from('crm_activities').delete().eq('id',activity)).error);
 assert.deepEqual((await staff.from('crm_activities').select('id')).data,[]);
 assert.deepEqual((await operations.from('crm_activities').select('id')).data,[]);
 const due=new Date(Date.now()+86400000).toISOString();
 const task=await rpc(office,'crm_create_follow_up',{p_source_kind:'CRM_OPPORTUNITY',p_source_id:opportunity,p_title:'Call synthetic buyer',p_assignee:person.officeB,p_due_at:due});
 const second=await rpc(office,'crm_create_follow_up',{p_source_kind:'CRM_OPPORTUNITY',p_source_id:opportunity,p_title:'Prepare synthetic tender note',p_assignee:person.office,p_due_at:null});
 assert.notEqual(task,second);
 assert.equal((await officeB.from('tasks').select('task_type,title').eq('id',task).single()).data.task_type,'CRM_FOLLOW_UP');
 assert.ok((await office.rpc('crm_create_follow_up',{p_source_kind:'DOCUMENT_VERSION',p_source_id:opportunity,p_title:'Forged document',p_assignee:person.office})).error);
 assert.ok((await office.rpc('crm_create_follow_up',{p_source_kind:'CRM_OPPORTUNITY',p_source_id:other,p_title:'Wrong source',p_assignee:person.office})).error);
 assert.ok((await office.rpc('crm_create_follow_up',{p_source_kind:'CRM_OPPORTUNITY',p_source_id:opportunity,p_title:'Wrong assignee',p_assignee:'10000000-0000-4000-8000-000000000003'})).error);
 assert.deepEqual((await staff.from('tasks').select('id').eq('id',task)).data,[]);
 assert.deepEqual((await operations.from('tasks').select('id').eq('id',task)).data,[]);
 assert.ok((await office.from('tasks').update({state:'DONE'}).eq('id',task)).error);
 assert.ok((await office.from('crm_task_events').insert({task_id:task,event_kind:'COMPLETE',actor_person_id:person.office})).error);
 await rpc(office,'crm_change_opportunity_owner',{p_id:opportunity,p_owner:person.officeB});
 assert.equal((await office.from('tasks').select('assignee_person_id').eq('id',second).single()).data.assignee_person_id,person.office);
 assert.ok((await office.rpc('crm_change_follow_up',{p_id:task,p_action:'COMPLETE'})).error);
 await rpc(officeB,'crm_change_follow_up',{p_id:task,p_action:'COMPLETE'});
 assert.equal((await office.from('tasks').select('state').eq('id',task).single()).data.state,'DONE');
 assert.equal((await office.from('crm_opportunities').select('stage').eq('id',opportunity).single()).data.stage,'NEW_LEAD');
 await rpc(office,'crm_transition_opportunity',{p_id:opportunity,p_stage:'PROPOSAL_TENDER'});
 assert.equal((await office.from('tasks').select('state').eq('id',second).single()).data.state,'OPEN');
 assert.ok((await office.rpc('crm_change_follow_up',{p_id:second,p_action:'REASSIGN',p_assignee:person.officeB})).error);
 await rpc(office,'crm_change_follow_up',{p_id:second,p_action:'REASSIGN',p_assignee:person.officeB,p_reason:'Workload handover'});
 assert.ok((await office.rpc('crm_change_follow_up',{p_id:second,p_action:'RESCHEDULE',p_due_at:due})).error);
 await rpc(office,'crm_change_follow_up',{p_id:second,p_action:'RESCHEDULE',p_due_at:due,p_reason:'Updated client schedule'});
 assert.ok((await office.rpc('crm_change_follow_up',{p_id:second,p_action:'CANCEL'})).error);
 await rpc(officeB,'crm_change_follow_up',{p_id:second,p_action:'CANCEL',p_reason:'Follow-up no longer needed'});
 assert.equal((await office.from('tasks').select('state').eq('id',second).single()).data.state,'CANCELLED');
 assert.equal((await office.from('crm_task_events').select('id').eq('task_id',second)).data.length,4);
 assert.ok((await officeB.rpc('crm_change_follow_up',{p_id:second,p_action:'COMPLETE'})).error);
 assert.ok((await staff.rpc('crm_record_activity',{p_organisation:organisation,p_type:'NOTE',p_subject:'Forged'})).error);
 assert.ok((await operations.rpc('crm_change_follow_up',{p_id:task,p_action:'COMPLETE'})).error);
 assert.ifError((await admin.from('crm_activities').select('id').eq('id',activity).single()).error);
});

test('05B CRM board, detail, My Work and role-scoped routes use real sources', {timeout:90000}, async()=>{
 const office=await signed('office');
 const organisation=await rpc(office,'crm_create_organisation',{p_name:`Synthetic 05B route ${Date.now()}`});
 const opportunity=await rpc(office,'crm_create_opportunity',{p_organisation:organisation,p_title:'Synthetic 05B route opportunity',p_type:'DIRECT_ENQUIRY',p_owner:person.office});
 const task=await rpc(office,'crm_create_follow_up',{p_source_kind:'CRM_OPPORTUNITY',p_source_id:opportunity,p_title:'Synthetic 05B route call',p_assignee:person.office});
 const base=`http://127.0.0.1:${await port()}`;
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',new URL(base).port],{cwd:process.cwd(),stdio:'ignore'});
 try{
  for(let i=0;i<100;i++){try{await fetch(base);break;}catch{await new Promise((resolve)=>setTimeout(resolve,200));}}
  const officeCookie=await cookie('office');const staffCookie=await cookie('staff');
  const get=(path,cookieValue)=>fetch(base+path,{redirect:'manual',headers:cookieValue?{cookie:cookieValue}:{}});
  assert.equal((await get('/crm?view=pipeline',officeCookie)).status,200);
  assert.equal((await get('/api/crm/work?view=pipeline',staffCookie)).status,403);
  assert.equal((await get('/api/crm/work?view=pipeline')).status,401);
  const board=await (await get(`/api/crm/work?view=pipeline&orgSearch=${encodeURIComponent('Synthetic 05B route')}`,officeCookie)).json();
  assert.ok(board.columns.find((column)=>column.stage==='NEW_LEAD').items.some((item)=>item.id===opportunity));
  const detail=await (await get(`/api/crm/work?view=opportunity&id=${opportunity}`,officeCookie)).json();
  assert.ok(detail.tasks.some((item)=>item.id===task));
  assert.equal((await get(`/api/crm/work?view=organisation&id=${organisation}`,officeCookie)).status,200);
  const work=await (await get('/api/tasks',officeCookie)).json();
  assert.ok(work.tasks.some((item)=>item.id===task&&item.sourceKind==='CRM_OPPORTUNITY'));
  assert.equal((await get(`/work/${task}`,officeCookie)).status,307);
  assert.equal((await get('/api/crm?view=overview',officeCookie)).status,200);
 }finally{server.kill('SIGTERM');if(server.exitCode===null)await once(server,'exit');}
});
