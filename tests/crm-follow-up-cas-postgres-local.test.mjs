import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const proposal=readFileSync(join(root,'docs/delivery/proposals/CRM-FOLLOW-UP-CAS-20261019.sql'),'utf8');
const baseSource='supabase/migrations/20260923183905_operational_crm_05b.sql';
const original=readFileSync(join(root,baseSource),'utf8');
const foundation=readFileSync(join(root,'supabase/migrations/20260923173348_crm_foundation_05a.sql'),'utf8');
const tasksSource=readFileSync(join(root,'supabase/migrations/20260923003042_connected_tasks_02c.sql'),'utf8');
const extract=(source,start,end='$$;')=>{const a=source.indexOf(start);assert.ok(a>=0,start);const b=source.indexOf(end,a);assert.ok(b>=0,end);return source.slice(a,b+end.length);};
const sha=s=>createHash('sha256').update(s).digest('hex');
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const due='2026-10-20T09:00:00.000Z',later='2026-10-21T09:00:00.000Z',last='2026-10-22T09:00:00.000Z';
const evidence={baseline:'a95d85079c33a3fd352bd190599864a79240c27c',sourceSha256:sha(original),proposalSha256:sha(proposal),cases:[],boundary:'Actual PostgreSQL; source-derived task schema and unchanged CRM writer/triggers/helpers; synthetic session/role prerequisites. Not hosted Auth/RLS.'};
const output=join(root,'output/crm-cas-20261019');

test('CAS proposal is staged separately and does not replace existing write authority',()=>{
 assert.doesNotMatch(proposal,/alter table|create or replace|drop function|disable trigger|bypassrls/i);
 assert.match(proposal,/for update;/i);assert.match(proposal,/perform public\.crm_change_follow_up\(/);
 assert.match(proposal,/PT409/);assert.match(proposal,/9223372036854775807/);
 assert.match(proposal,/expected_due is distinct from t\.due_at/);
 assert.match(proposal,/expected_n<>n/);assert.match(proposal,/revoke all on function.*from public,anon,authenticated/);
});

test('actual local PostgreSQL baseline race and atomic opt-in CAS', {skip:!process.env.KSS_CRM_PG_BIN||!process.env.KSS_CRM_PG_MODULE,timeout:120000},async t=>{
 const bin=resolve(process.env.KSS_CRM_PG_BIN),{Client}=createRequire(import.meta.url)(process.env.KSS_CRM_PG_MODULE);
 const scratch=mkdtempSync(join(tmpdir(),'kss-crm-cas-')),db=join(scratch,'db'),socket=join(scratch,'socket');mkdirSync(socket,{mode:0o700});
 const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const run=(name,args)=>{const r=spawnSync(join(bin,name),args,{env,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});assert.equal(r.status,0,`${name}: ${r.stderr||r.error||r.stdout}`);return r.stdout;};
 const clients=[];let started=false,admin;const port=6543;
 const connect=async(actor=1,asAuth=true)=>{const c=new Client({host:socket,port,user:'fixture_admin',database:'postgres',password:'synthetic-unused-local-fixture',options:'-c statement_timeout=5000',ssl:false,connectionTimeoutMillis:5000,query_timeout:10000,application_name:`kss-cas-fixture-${clients.length}`});await c.connect();clients.push(c);if(asAuth){await c.query('set role authenticated');await c.query("select set_config('fixture.person',$1,false)",[uuid(actor)]);}return c;};
 let taskNumber=100;
 const create=async(c,d=due,assignee=1)=>{taskNumber++;const r=await c.query('select public.crm_create_follow_up($1,$2,$3,$4,$5) as id',['CRM_ORGANISATION',uuid(20),`Synthetic CAS task ${taskNumber}`,uuid(assignee),d]);return r.rows[0].id;};
 const snapshot=async(c,id)=>(await c.query('select public.crm_follow_up_cas_snapshot($1) as value',[id])).rows[0].value;
 const counts=async id=>(await admin.query('select (select count(*)::int from public.crm_task_events where task_id=$1) as events,(select count(*)::int from public.audit_events where entity_id=$1) as audit',( [id] ))).rows[0];
 const call=async(c,id,expected,action='RESCHEDULE',newDue=later,reason='Synthetic reviewed change',assignee=null)=>(await c.query('select public.crm_change_follow_up_cas($1,$2::jsonb,$3,$4,$5,$6) as value',[id,JSON.stringify(expected),action,assignee,newDue,reason])).rows[0].value;
 const legacy=async(c,id,newDue=later,action='RESCHEDULE',assignee=null)=>c.query('select public.crm_change_follow_up($1,$2,$3,$4,$5)',[id,action,assignee,newDue,'Synthetic reviewed change']);
 const reject=async(c,id,expected,action='RESCHEDULE',newDue=later,reason='Synthetic reviewed change',assignee=null)=>{const before=await counts(id);let code;try{await call(c,id,expected,action,newDue,reason,assignee);}catch(e){code=e.code;}assert.ok(code,'Expected rejection');assert.deepEqual(await counts(id),before,'Rejected change has no event/audit');return code;};
 const blocked=async c=>{for(let i=0;i<200;i++){await admin.query('select pg_stat_clear_snapshot()');const r=await admin.query("select wait_event_type from pg_stat_activity where pid=$1",[c.processID]);if(r.rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,10));}throw new Error('Second database session did not block on row lock');};
 async function scenario(name,fn){await t.test(name,async()=>{await fn();evidence.cases.push({name,passed:true});});}
 try{
  run('initdb',['-D',db,'-U','fixture_admin','-A','trust','--no-locale','-E','UTF8']);
  run('pg_ctl',['-D',db,'-l',join(scratch,'server.log'),'-o',`-c listen_addresses='' -c unix_socket_directories='${socket}' -c unix_socket_permissions=0700 -p ${port}`,'-w','start']);started=true;
  admin=await connect(1,false);evidence.version=(await admin.query('select version() as value')).rows[0].value;evidence.listenAddresses=(await admin.query('show listen_addresses')).rows[0].listen_addresses;assert.equal(evidence.listenAddresses,'');
  await admin.query(readFileSync(join(root,'tests/fixtures/crm-cas-prerequisites.sql'),'utf8'));
  for(const name of ['crm_authorised','crm_owner_eligible','crm_audit'])await admin.query(extract(foundation,`create function private.${name}(`));
  await admin.query(extract(tasksSource,'create table public.tasks (',');'));
  await admin.query("alter table public.tasks drop constraint tasks_state_check;alter table public.tasks add constraint tasks_state_check check(state in ('OPEN','DONE','CANCELLED'));alter table public.tasks add column cancelled_at timestamptz,add column cancellation_case_id uuid,add column cancellation_reason text;alter table public.tasks enable row level security;revoke all on public.tasks from public,anon,authenticated;grant select on public.tasks to authenticated;");
  const a=original.indexOf('alter table public.tasks add column created_by_person_id'),b=original.indexOf('alter table public.audit_events drop constraint');assert.ok(a>=0&&b>a);await admin.query(original.slice(a,b));
  const originalDefinition=(await admin.query("select pg_get_functiondef('public.crm_change_follow_up(uuid,text,uuid,timestamptz,text)'::regprocedure) as value")).rows[0].value;
  await admin.query(proposal);
  assert.equal((await admin.query("select pg_get_functiondef('public.crm_change_follow_up(uuid,text,uuid,timestamptz,text)'::regprocedure) as value")).rows[0].value,originalDefinition);
  for(let i=1;i<=5;i++)await admin.query('insert into public.people(id)values($1);',[uuid(i)]);
  for(const [person,role] of [[1,'OFFICE_ADMIN'],[2,'OFFICE_ADMIN'],[3,'SECURITY_STAFF'],[4,'SUPER_ADMIN'],[5,'OPERATIONS']])await admin.query('insert into public.role_assignments(person_id,role_code)values($1,$2)',[uuid(person),role]);
  await admin.query('insert into public.crm_organisations values($1)',[uuid(20)]);
  const one=await connect(1),two=await connect(1);
  await scenario('baseline: two stale reschedules both succeed despite the row lock',async()=>{
   const id=await create(one),before=await snapshot(one,id);assert.equal(before.eventCount,'1');
   await one.query('begin');await legacy(one,id,later);const waiting=legacy(two,id,last).then(()=>({ok:true}),e=>({error:e.code}));await blocked(two);await one.query('commit');assert.equal((await waiting).ok,true);
   const final=await snapshot(one,id);assert.equal(final.eventCount,'3');assert.equal(Date.parse(final.dueAt),Date.parse(last));assert.deepEqual(await counts(id),{events:3,audit:3});
  });
  for(const [win,lose] of [[later,last],[last,later]])await scenario(`CAS: only one stale reschedule wins (${win.slice(0,10)})`,async()=>{
   const id=await create(one),before=await snapshot(one,id);await one.query('begin');const receipt=await call(one,id,before,'RESCHEDULE',win);assert.equal(receipt.eventCount,'2');assert.ok(receipt.eventId);
   const waiting=call(two,id,before,'RESCHEDULE',lose).then(()=>({ok:true}),e=>({error:e.code}));await blocked(two);await one.query('commit');assert.equal((await waiting).error,'PT409');assert.equal(Date.parse((await snapshot(one,id)).dueAt),Date.parse(win));assert.deepEqual(await counts(id),{events:2,audit:2});
  });
  for(const first of ['RESCHEDULE','COMPLETE','CANCEL'])await scenario(`CAS: stale completion/reschedule rejected after ${first}`,async()=>{
   const id=await create(one),before=await snapshot(one,id);await call(one,id,before,first);assert.equal(await reject(two,id,before,first==='RESCHEDULE'?'COMPLETE':'RESCHEDULE'),'PT409');
  });
  await scenario('NULL deadlines use SQL distinctness; removing a deadline is exact',async()=>{
   const id=await create(one,null),before=await snapshot(one,id);assert.equal(before.dueAt,null);await call(one,id,before);assert.equal(await reject(two,id,before),'PT409');const current=await snapshot(one,id);await call(one,id,current,'RESCHEDULE',null);assert.equal((await snapshot(one,id)).dueAt,null);
  });
  await scenario('same-transaction ABA is rejected even when due/assignee/updated_at match',async()=>{
   // The unchanged source guard orders same-timestamp events by UUID. Ordered
   // synthetic event IDs avoid a random tie-order fixture failure in this case.
   await admin.query('alter table public.crm_task_events alter column id set default private.fixture_ordered_event_uuid()');
   try {
    await one.query('begin');const id=await create(one),before=await snapshot(one,id);
    const originalTime=(await one.query('select updated_at from public.tasks where id=$1',[id])).rows[0].updated_at;
    await legacy(one,id,later);await legacy(one,id,due);assert.equal(String((await one.query('select updated_at from public.tasks where id=$1',[id])).rows[0].updated_at),String(originalTime));
    await one.query('savepoint before_stale');let code;try{await call(one,id,before);}catch(e){code=e.code;}assert.equal(code,'PT409');await one.query('rollback to before_stale');assert.equal((await snapshot(one,id)).eventCount,'3');await one.query('commit');
   } finally {
    await one.query('rollback');await admin.query('alter table public.crm_task_events alter column id set default gen_random_uuid()');
   }
  });
  await scenario('no-op and invalid action do not add history/audit',async()=>{
   const id=await create(one),before=await snapshot(one,id);assert.equal(await reject(one,id,before,'RESCHEDULE',due),'P0001');assert.equal(await reject(one,id,before,'OTHER'),'P0001');
  });
  for(const value of [null,{},'not-object',[],{eventCount:'0'},{eventCount:'01'},{eventCount:'-1'},{eventCount:'1.5'},{eventCount:'9223372036854775808'},{eventCount:1},{eventCount:null},{state:null},{sourceKind:null},{extra:true},{dueAt:'2026-10-20'},{dueAt:'infinity'},{dueAt:'2026-02-30T09:00:00Z'},{id:'bad-uuid'}])await scenario(`malformed expectation rejected: ${JSON.stringify(value)}`,async()=>{
   const id=await create(one),before=await snapshot(one,id),expected=value&&typeof value==='object'&&!Array.isArray(value)?{...before,...value}:value;
   if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===0)delete expected.eventCount;
   assert.ok(['22023','22P02','22008'].includes(await reject(one,id,expected)));
  });
  await scenario('wrong identity/source/assignee conflicts before mutation',async()=>{
   const id=await create(one),before=await snapshot(one,id);for(const delta of [{id:uuid(99)},{sourceId:uuid(99)},{sourceKind:'CRM_OPPORTUNITY'},{assigneePersonId:uuid(2)}])assert.equal(await reject(one,id,{...before,...delta}),'PT409');
  });
  await scenario('fresh reassignment preserves existing owner and completion authority',async()=>{
   const id=await create(one),before=await snapshot(one,id);await call(one,id,before,'REASSIGN',null,'Synthetic handover',uuid(2));const fresh=await snapshot(one,id);assert.equal(fresh.assigneePersonId,uuid(2));assert.equal(await reject(one,id,fresh,'COMPLETE'),'P0001');const owner=await connect(2);await call(owner,id,fresh,'COMPLETE');assert.equal((await snapshot(owner,id)).state,'DONE');
  });
  await scenario('role loss and non-CRM personas denied without event/audit',async()=>{
   const id=await create(one),before=await snapshot(one,id);for(const actor of [3,5])assert.equal(await reject(await connect(actor),id,before),'42501');
   await admin.query('update public.role_assignments set revoked_at=now() where person_id=$1',[uuid(1)]);assert.equal(await reject(one,id,before),'42501');await admin.query('update public.role_assignments set revoked_at=null where person_id=$1',[uuid(1)]);
  });
  await scenario('role revoked while CAS waits for the row lock is denied by the existing writer',async()=>{
   const id=await create(one),before=await snapshot(one,id),initial=await counts(id);
   await admin.query('begin');await admin.query('select id from public.tasks where id=$1 for update',[id]);
   const waiting=call(two,id,before).then(()=>({ok:true}),e=>({error:e.code}));await blocked(two);
   await admin.query('update public.role_assignments set revoked_at=now() where person_id=$1',[uuid(1)]);await admin.query('commit');
   assert.ok(['42501','P0001'].includes((await waiting).error));assert.deepEqual(await counts(id),initial);
   await admin.query('update public.role_assignments set revoked_at=null where person_id=$1',[uuid(1)]);
  });
  await scenario('audit failure rolls back task and history atomically',async()=>{
   const id=await create(one),before=await snapshot(one,id);await one.query("set fixture.audit_fail='on'");assert.equal(await reject(one,id,before),'P0001');await one.query("set fixture.audit_fail='off'");assert.deepEqual(await snapshot(one,id),before);
  });
  await scenario('new function ACLs deny anon/PUBLIC; original writer definition remains exact',async()=>{
   const rows=(await admin.query("select p.proname,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as auth,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('crm_follow_up_cas_snapshot','crm_change_follow_up_cas')")).rows;assert.equal(rows.length,2);for(const r of rows){assert.equal(r.anon,false);assert.equal(r.auth,true);assert.equal(r.prosecdef,true);assert.ok(r.proconfig.some(v=>v==='search_path=""'));}
   assert.equal((await admin.query("select pg_get_functiondef('public.crm_change_follow_up(uuid,text,uuid,timestamptz,text)'::regprocedure) as value")).rows[0].value,originalDefinition);
  });
 }finally{
  for(const c of clients)await c.end().catch(()=>{});
  if(started){run('pg_ctl',['-D',db,'-m','fast','-w','stop']);evidence.stopped=true;}
  rmSync(scratch,{recursive:true,force:true});evidence.clusterDeleted=!existsSync(scratch);mkdirSync(output,{recursive:true});writeFileSync(join(output,'postgres-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 }
});
