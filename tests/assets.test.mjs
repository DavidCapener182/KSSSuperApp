import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const creds={admin:[process.env.KSS_TEST_ADMIN_EMAIL,process.env.KSS_TEST_ADMIN_PASSWORD],
 office:[process.env.KSS_TEST_OFFICE_EMAIL,process.env.KSS_TEST_OFFICE_PASSWORD],
 operations:[process.env.KSS_TEST_OPERATIONS_EMAIL,process.env.KSS_TEST_OPERATIONS_PASSWORD],
 staffA:[process.env.KSS_TEST_STAFF_A_EMAIL,process.env.KSS_TEST_STAFF_A_PASSWORD],
 staffB:[process.env.KSS_TEST_STAFF_B_EMAIL,process.env.KSS_TEST_STAFF_B_PASSWORD]};
const person={operations:'10000000-0000-4000-8000-000000000007',
 staffA:'10000000-0000-4000-8000-000000000003',staffB:'10000000-0000-4000-8000-000000000004'};
async function signed(name){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await signInWithTestSession(client,{email:creds[name][0],password:creds[name][1]});assert.ifError(error);return client;}
async function rpc(client,name,args={}){const {data,error}=await client.rpc(name,args);assert.ifError(error,name+' failed: '+error?.message);return data;}
const act=(client,id,action,revision,extra={})=>rpc(client,'asset_act',{
 p_asset:id,p_action:action,p_expected_revision:revision,p_request_key:crypto.randomUUID(),
 p_holder_kind:null,p_holder_id:null,p_condition:null,p_expected_return_at:null,p_reason:null,...extra});

test('TASK-15A synthetic custody, condition and quantity stock',{timeout:180000},async()=>{
 assert.ok(url&&key&&Object.values(creds).every(([email,password])=>email&&password));
 const [admin,office,ops,staffA,staffB]=await Promise.all(Object.keys(creds).map(signed));
 const before=await rpc(admin,'asset_admin_choices');
 const store=before.scopes.find(x=>x.kind==='STORE');
 const site=before.scopes.find(x=>x.kind==='SITE');
 const event=before.scopes.find(x=>x.kind==='EVENT');
 assert.ok(store&&site&&event,'synthetic Site, Event and controlled store exist');
 assert.ok((await staffA.from('asset_items').select('id')).error,'Staff direct table read denied');
 assert.ok((await ops.from('asset_events').insert({asset_id:crypto.randomUUID()})).error,'direct history write denied');
 assert.ok((await office.rpc('asset_grant',{p_person:person.operations,p_scope_kind:'STORE',p_scope_id:store.id,
   p_until:new Date(Date.now()+86400000).toISOString(),p_reason:'Office must not grant assets'})).error);
 const suffix=Date.now().toString(36).toUpperCase();
 const radio=await rpc(office,'asset_register',{p_reference:'R-'+suffix,p_class:'RADIO',
   p_description:'15A synthetic radio',p_serial:'SER-'+suffix,p_store:store.id,p_condition:'GOOD',p_request_key:crypto.randomUUID()});
 assert.ok((await office.rpc('asset_act',{p_asset:radio.id,p_action:'INSPECT',p_expected_revision:1,
   p_request_key:crypto.randomUUID(),p_condition:'GOOD'})).error,
   'Office register administration is not physical inspection authority');
 assert.ok((await ops.rpc('asset_act',{p_asset:radio.id,p_action:'ISSUE',p_expected_revision:1,
   p_request_key:crypto.randomUUID(),p_holder_kind:'PERSON',p_holder_id:person.staffA})).error,
   'Operations role alone is not asset issue authority');
 const grant=await rpc(admin,'asset_grant',{p_person:person.operations,p_scope_kind:'STORE',p_scope_id:store.id,
   p_until:new Date(Date.now()+7*86400000).toISOString(),p_reason:'Synthetic 15A controlled store pilot'});
 let siteGrant,eventGrant;
 try {
  siteGrant=await rpc(admin,'asset_grant',{p_person:person.operations,p_scope_kind:'SITE',p_scope_id:site.id,
   p_until:new Date(Date.now()+7*86400000).toISOString(),p_reason:'Synthetic 15A Site pilot'});
  eventGrant=await rpc(admin,'asset_grant',{p_person:person.operations,p_scope_kind:'EVENT',p_scope_id:event.id,
   p_until:new Date(Date.now()+7*86400000).toISOString(),p_reason:'Synthetic 15A Event pilot'});
  const key0=crypto.randomUUID(),issueArgs={p_asset:radio.id,p_action:'ISSUE',p_expected_revision:1,
   p_request_key:key0,p_holder_kind:'PERSON',p_holder_id:person.staffA,p_condition:null,
   p_expected_return_at:new Date(Date.now()+86400000).toISOString(),p_reason:null};
  const issued=await rpc(ops,'asset_act',issueArgs);
  const replay=await rpc(ops,'asset_act',issueArgs);assert.equal(replay.eventId,issued.eventId);
  assert.ok((await ops.rpc('asset_act',{...issueArgs,p_holder_id:person.staffB})).error,'changed-payload retry denied');
  assert.ok((await staffB.rpc('asset_history',{p_asset:radio.id})).error,'peer cannot read radio history');
  assert.ok((await staffB.rpc('asset_act',{p_asset:radio.id,p_action:'ACK_ISSUE',
   p_expected_revision:2,p_request_key:crypto.randomUUID()})).error,'peer acknowledgement denied');
  const own=await rpc(staffA,'asset_workspace');assert.ok(own.items.some(x=>x.id===radio.id&&x.pendingAck==='ISSUE'));
  const selfOnly=await rpc(staffA,'asset_my_workspace');
  assert.ok(selfOnly.items.some(x=>x.id===radio.id));
  assert.equal(selfOnly.stock.length,0);assert.equal(selfOnly.stores.length,0);
  await act(staffA,radio.id,'ACK_ISSUE',2);
  const returned=await act(ops,radio.id,'RETURN',3,{p_holder_kind:'STORE',p_holder_id:store.id,p_condition:'DAMAGED',
   p_reason:'Damaged aerial observed at return'});
  assert.equal(returned.revision,4);
  const damaged=(await rpc(office,'asset_workspace')).items.find(x=>x.id===radio.id);
  assert.equal(damaged.condition,'DAMAGED');assert.equal(damaged.maintenanceState,'QUARANTINED');
  assert.equal(damaged.pendingAck,'RETURN');
  assert.ok((await ops.rpc('asset_act',{p_asset:radio.id,p_action:'ISSUE',p_expected_revision:4,
   p_request_key:crypto.randomUUID(),p_holder_kind:'PERSON',p_holder_id:person.staffB})).error,
   'damaged radio cannot be issued');
  await act(ops,radio.id,'ACK_RETURN',4);
  await act(ops,radio.id,'REPAIR_START',5,{p_reason:'Aerial repair sent'});
  await act(ops,radio.id,'REPAIR_COMPLETE',6,{p_reason:'Aerial repair returned'});
  await act(ops,radio.id,'INSPECT',7,{p_condition:'GOOD',p_reason:'Radio passed function check'});
  const recovered=(await rpc(office,'asset_workspace')).items.find(x=>x.id===radio.id);
  assert.equal(recovered.maintenanceState,'NONE');assert.equal(recovered.condition,'GOOD');
  assert.ok((await ops.rpc('asset_act',{p_asset:radio.id,p_action:'INSPECT',p_expected_revision:null,
   p_request_key:crypto.randomUUID(),p_condition:'GOOD'})).error,'null expected revision cannot bypass concurrency');
  const history=await rpc(office,'asset_history',{p_asset:radio.id});
  assert.deepEqual(history.events.map(x=>x.action),['REGISTER','ISSUE','ACK_ISSUE','RETURN','ACK_RETURN','REPAIR_START','REPAIR_COMPLETE','INSPECT']);
  assert.ok((await staffA.rpc('asset_history',{p_asset:radio.id})).error,'former holder cannot see later history');

  const keyAsset=await rpc(office,'asset_register',{p_reference:'K-'+suffix,p_class:'KEY_CARD',
   p_description:'15A synthetic key card',p_serial:'KEYSER-'+suffix,p_store:store.id,p_condition:'GOOD',p_request_key:crypto.randomUUID()});
  await act(ops,keyAsset.id,'ISSUE',1,{p_holder_kind:'PERSON',p_holder_id:person.staffA,
   p_expected_return_at:new Date(Date.now()+86400000).toISOString()});
  await act(staffA,keyAsset.id,'ACK_ISSUE',2);
  await act(ops,keyAsset.id,'RETURN',3,{p_holder_kind:'STORE',p_holder_id:store.id,p_condition:'GOOD'});
  await act(ops,keyAsset.id,'ACK_RETURN',4);
  assert.deepEqual((await rpc(office,'asset_history',{p_asset:keyAsset.id})).events.map(x=>x.action),
   ['REGISTER','ISSUE','ACK_ISSUE','RETURN','ACK_RETURN'],'key has two sided custody evidence');
  assert.equal((await rpc(ops,'asset_history',{p_asset:keyAsset.id})).serial,null,
   'restricted key serial is not exposed to Operations history');

  const device=await rpc(office,'asset_register',{p_reference:'D-'+suffix,p_class:'PHONE',
   p_description:'15A synthetic phone',p_serial:null,p_store:store.id,p_condition:'SERVICEABLE',p_request_key:crypto.randomUUID()});
  await act(ops,device.id,'ISSUE',1,{p_holder_kind:'SITE',p_holder_id:site.id});
  await act(ops,device.id,'TRANSFER',2,{p_holder_kind:'EVENT',p_holder_id:event.id});
  const eventHeld=(await rpc(office,'asset_workspace')).items.find(x=>x.id===device.id);
  assert.equal(eventHeld.holderKind,'EVENT');assert.ok(eventHeld.holderLabel);
  assert.equal(eventHeld.locationLabel,eventHeld.holderLabel);

  const race=await rpc(office,'asset_register',{p_reference:'C-'+suffix,p_class:'BODYCAM',
   p_description:'15A synthetic bodycam',p_serial:null,p_store:store.id,p_condition:'GOOD',p_request_key:crypto.randomUUID()});
  const concurrent=await Promise.all([person.staffA,person.staffB].map((candidate)=>ops.rpc('asset_act',{
   p_asset:race.id,p_action:'ISSUE',p_expected_revision:1,p_request_key:crypto.randomUUID(),
   p_holder_kind:'PERSON',p_holder_id:candidate,p_condition:null,p_expected_return_at:null,p_reason:null})));
  assert.equal(concurrent.filter(x=>!x.error).length,1,'concurrent issues yield one winner');
  assert.deepEqual((await rpc(office,'asset_history',{p_asset:race.id})).events.map(x=>x.action),['REGISTER','ISSUE']);

  const lost=await rpc(office,'asset_register',{p_reference:'L-'+suffix,p_class:'LAPTOP_TABLET',
   p_description:'15A synthetic tablet',p_serial:null,p_store:store.id,p_condition:'GOOD',p_request_key:crypto.randomUUID()});
  await act(ops,lost.id,'ISSUE',1,{p_holder_kind:'PERSON',p_holder_id:person.staffA});
  await act(staffA,lost.id,'ACK_ISSUE',2);
  await act(staffA,lost.id,'REPORT_LOSS',3,{p_reason:'Tablet not located at end of synthetic duty'});
  assert.ok((await ops.rpc('asset_act',{p_asset:lost.id,p_action:'RETURN',p_expected_revision:4,
   p_request_key:crypto.randomUUID(),p_holder_kind:'STORE',p_holder_id:store.id})).error,
   'reported loss needs reasoned recovery');
  await act(ops,lost.id,'RECOVER',4,{p_reason:'Synthetic tablet located in labelled equipment bag'});
  assert.equal((await rpc(office,'asset_workspace')).items.find(x=>x.id===lost.id).maintenanceState,'QUARANTINED');
  await act(ops,lost.id,'RETURN',5,{p_holder_kind:'STORE',p_holder_id:store.id,p_condition:'UNKNOWN'});
  await act(ops,lost.id,'ACK_RETURN',6);
  await act(ops,lost.id,'INSPECT',7,{p_condition:'GOOD',p_reason:'Tablet checked after recovery'});

  const stock=await rpc(office,'asset_stock_create',{p_sku:'POLO-M-'+suffix,p_garment:'Polo Shirt',
   p_size:'Medium '+suffix,p_store:store.id,p_opening:20,p_reason:'Verified synthetic opening count',p_request_key:crypto.randomUUID()});
  const stockIssued=await rpc(ops,'asset_stock_move',{p_stock:stock.id,p_action:'ISSUE',p_quantity:2,
   p_person:person.staffA,p_issue:null,p_expected_revision:1,p_request_key:crypto.randomUUID(),p_reason:null});
  assert.equal((await rpc(office,'asset_workspace')).stock.find(x=>x.id===stock.id).available,18);
  assert.ok((await staffA.rpc('asset_stock_ack',{p_issue:stockIssued.issueId,p_dispute:null,
   p_request_key:crypto.randomUUID()})).error,'null acknowledgement choice is denied');
  assert.ok((await office.rpc('asset_stock_move',{p_stock:stock.id,p_action:'ADJUST',p_quantity:1,
   p_person:null,p_issue:null,p_expected_revision:null,p_request_key:crypto.randomUUID(),p_reason:'Invalid null revision'})).error);
  assert.ok((await ops.rpc('asset_stock_move',{p_stock:stock.id,p_action:'ISSUE',p_quantity:19,
   p_person:person.staffB,p_issue:null,p_expected_revision:2,p_request_key:crypto.randomUUID()})).error,'stock cannot overdraw');
  const ackKey=crypto.randomUUID(),ackPayload={p_issue:stockIssued.issueId,p_dispute:false,p_reason:null,p_request_key:ackKey};
  const ack=await rpc(staffA,'asset_stock_ack',ackPayload);
  assert.deepEqual(await rpc(staffA,'asset_stock_ack',ackPayload),ack,'uniform acknowledgement retry is stable');
  assert.ok((await staffA.rpc('asset_stock_ack',{...ackPayload,p_dispute:true,p_reason:'Changed acknowledgement'})).error,
   'changed stock acknowledgement payload conflicts');
  await rpc(ops,'asset_stock_move',{p_stock:stock.id,p_action:'RETURN',p_quantity:1,
   p_person:person.staffA,p_issue:stockIssued.issueId,p_expected_revision:3,p_request_key:crypto.randomUUID(),p_reason:'Size exchange'});
  assert.equal((await rpc(office,'asset_workspace')).stock.find(x=>x.id===stock.id).available,19);
  assert.deepEqual((await rpc(office,'asset_stock_history',{p_stock:stock.id})).events.map(x=>x.action),
   ['OPENING','ISSUE','ACK_ISSUE','RETURN']);
  await rpc(office,'asset_stock_move',{p_stock:stock.id,p_action:'ADJUST',p_quantity:-1,
   p_person:null,p_issue:null,p_expected_revision:4,p_request_key:crypto.randomUUID(),p_reason:'Controlled recount of synthetic stock'});
  assert.equal((await rpc(office,'asset_workspace')).stock.find(x=>x.id===stock.id).available,18);
  assert.ok((await staffB.rpc('asset_stock_ack',{p_issue:stockIssued.issueId,p_dispute:false,
   p_request_key:crypto.randomUUID()})).error,'peer cannot acknowledge uniform');
 } finally {
  for(const id of [eventGrant,siteGrant,grant].filter(Boolean))
   await rpc(admin,'asset_revoke_grant',{p_grant:id,p_reason:'Synthetic pilot check complete'});
 }
 assert.ok(!(await rpc(ops,'asset_workspace')).items.some(x=>x.id===radio.id),
  'revoked Operations grants remove asset visibility');
 assert.ok((await ops.rpc('asset_holder_choices')).error,'ungranted Operations cannot list recipient choices');
 const audit=await rpc(admin,'asset_admin_choices');
 assert.ok(audit.grantEvents.some(x=>x.grantId===grant&&x.kind==='REVOKED'),
  'Super Admin can inspect attributable grant and revocation history');
});
