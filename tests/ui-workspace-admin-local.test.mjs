import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,nodes,text,response,settle,id} from './helpers/ui-tfs-fixture.mjs';
const file='src/components/workspace-access-admin.tsx';
const reason='Synthetic creation reason';
const existingGrant={id:id(4),personId:id(3),personName:'Synthetic Person',permission:'VIEW',effectiveFrom:'2026-01-01T00:00:00Z',effectiveUntil:null,revokedAt:null,reason:'Existing synthetic grant'};
const workspace={id:id(2),organisationId:id(1),name:'Synthetic Client',status:'ACTIVE',creationReason:reason,grants:[]};
const props=(registry=[])=>({registry,choices:{organisations:[{id:id(1),name:'Synthetic Client'}],people:[{id:id(3),name:'Synthetic Person'}]}});
const button=(f,label)=>nodes(f.tree,'button').find(n=>text(n).replace(/\s+/g,' ').trim()===label);
function review(f,mode='create',values={}){
 f.render();button(f,mode==='create'?'Create workspace':mode==='grant'?'Grant exact access':'Review revocation').props.onClick({currentTarget:{focus(){}}});f.render();
 const data={organisationId:id(1),personId:id(3),permission:'VIEW',reason,...values};
 nodes(f.tree,'form')[0].props.action({get:key=>data[key]});f.render();
 return button(f,mode==='create'?'Confirm workspace creation':mode==='grant'?'Confirm exact grant':'Confirm revocation');
}
test('creation is separate from grants and review names exact Organisation before any POST',()=>{
 const f=fixture(file,'WorkspaceAccessAdmin',props());f.render();assert.equal(nodes(f.tree,'form').length,0);review(f);
 assert.equal(f.calls.length,0);assert.match(text(f.tree),/Review before saving/);assert.match(text(f.tree),new RegExp(id(1)));assert.match(text(f.tree),/Synthetic creation reason/);
});
test('empty or wrong Organisation registry cannot confirm creation; clears facts without auto retry',async()=>{
 for(const registry of [[],[{...workspace,organisationId:id(99)}],[{...workspace,creationReason:'Another reason'}]]){
  const f=fixture(file,'WorkspaceAccessAdmin',props(),()=>response({registry}));const confirm=review(f);await confirm.props.onClick({currentTarget:{focus(){}}});await settle();f.render();
  assert.match(text(f.tree),/may have been saved/);assert.doesNotMatch(text(f.tree),/Current registry confirms/);assert.equal(nodes(f.tree,'form').length,1);assert.equal(f.calls.length,1);assert.equal(nodes(f.tree,'form')[0].props.action,'/client-workspaces/manage');assert.equal(nodes(f.tree,'form')[0].props.method,'get');
 }
});
test('exact newly created Organisation/readback confirms current state and opens selected identity',async()=>{
 const f=fixture(file,'WorkspaceAccessAdmin',props(),()=>response({registry:[workspace]}));review(f).props.onClick({currentTarget:{focus(){}}});await settle();f.render();
 assert.match(text(f.tree),/Current registry confirms the requested workspace/);assert.match(text(f.tree),new RegExp(workspace.id));assert.equal(f.calls[0].body.organisationId,id(1));assert.deepEqual(Object.keys(f.calls[0].body).sort(),['action','organisationId','reason']);
});
test('synchronous duplicate confirmation events issue exactly one POST and lock view controls',async()=>{
 let release;const gate=new Promise(r=>release=r);const f=fixture(file,'WorkspaceAccessAdmin',props(),()=>gate);const confirm=review(f);confirm.props.onClick({currentTarget:{focus(){}}});confirm.props.onClick({currentTarget:{focus(){}}});await settle();f.render();
 assert.equal(f.calls.length,1);assert.ok(nodes(f.tree,'button').every(n=>n.props.disabled));release(response({registry:[workspace]}));await settle();f.render();assert.match(text(f.tree),/Current registry confirms/);
});
test('POST resolving after unmount performs no JSON read, confirmation or further request',async()=>{
 let release,jsonReads=0;const gate=new Promise(r=>release=r);const f=fixture(file,'WorkspaceAccessAdmin',props(),()=>gate);review(f).props.onClick({currentTarget:{focus(){}}});f.unmount();release({ok:true,json:async()=>{jsonReads++;return {registry:[workspace]};}});await settle();f.render();
 assert.equal(jsonReads,0);assert.equal(f.calls.length,1);assert.doesNotMatch(text(f.tree),/Current registry confirms/);
});
test('unmount while JSON readback pending also suppresses confirmation',async()=>{
 let release;const json=new Promise(r=>release=r);const f=fixture(file,'WorkspaceAccessAdmin',props(),()=>({ok:true,json:()=>json}));review(f).props.onClick({currentTarget:{focus(){}}});await settle();f.unmount();release({registry:[workspace]});await settle();f.render();assert.doesNotMatch(text(f.tree),/Current registry confirms/);
});
test('grant review identifies exact Person, workspace, module and permission; exact new current grant confirms',async()=>{
 const granted={...existingGrant,reason};const f=fixture(file,'WorkspaceAccessAdmin',props([workspace]),()=>response({registry:[{...workspace,grants:[granted]}]}));review(f,'grant');
 assert.match(text(f.tree),new RegExp(id(3)));assert.match(text(f.tree),new RegExp(workspace.id));assert.match(text(f.tree),/Loss Prevention/);assert.equal(f.calls.length,0);
 button(f,'Confirm exact grant').props.onClick({currentTarget:{focus(){}}});await settle();f.render();assert.match(text(f.tree),/Current registry confirms the requested Loss Prevention grant/);assert.deepEqual({...f.calls[0].body},{action:'grant',workspaceId:workspace.id,personId:id(3),permission:'VIEW',reason});
});
test('stale existing grant, wrong Person/permission, revoked, future, finite or malformed grant cannot confirm a new grant',async()=>{
 const old={...workspace,grants:[existingGrant]};
 for(const [before,grant] of [[old,existingGrant],[workspace,{...existingGrant,personId:id(9)}],[workspace,{...existingGrant,permission:'OPERATE'}],[workspace,{...existingGrant,revokedAt:'2026-10-18T00:00:00Z'}],[workspace,{...existingGrant,effectiveFrom:'2099-01-01T00:00:00Z'}],[workspace,{...existingGrant,effectiveUntil:'2099-01-01T00:00:00Z'}],[workspace,{...existingGrant,effectiveFrom:'invalid'}]]){
  const f=fixture(file,'WorkspaceAccessAdmin',props([before]),()=>response({registry:[{...workspace,grants:[{...grant,reason}]}]}));review(f,'grant').props.onClick({currentTarget:{focus(){}}});await settle();f.render();assert.doesNotMatch(text(f.tree),/Current registry confirms/);assert.match(text(f.tree),/may have been saved/);
 }
});
test('revocation requires exact grant current-state readback, not another grant or disappearance',async()=>{
 const original={...workspace,grants:[existingGrant]};
 for(const grants of [[],[existingGrant],[{...existingGrant,id:id(99),revokedAt:'2026-10-18T00:00:00Z'}],[{...existingGrant,personId:id(99),revokedAt:'2026-10-18T00:00:00Z'}]]){
  const f=fixture(file,'WorkspaceAccessAdmin',props([original]),()=>response({registry:[{...workspace,grants}]}));review(f,'revoke').props.onClick({currentTarget:{focus(){}}});await settle();f.render();assert.match(text(f.tree),/may have been saved/);
 }
 const f=fixture(file,'WorkspaceAccessAdmin',props([original]),()=>response({registry:[{...workspace,grants:[{...existingGrant,revokedAt:'2026-10-18T00:00:00Z'}]}]}));review(f,'revoke').props.onClick({currentTarget:{focus(){}}});await settle();f.render();assert.match(text(f.tree),/Current registry confirms the requested revocation/);assert.equal(f.calls[0].body.grantId,existingGrant.id);assert.equal(button(f,'Review revocation'),undefined);
});
test('denied, failed readback and lost connection clear inaccessible facts and never expose returned errors or retry',async()=>{
 for(const handler of [()=>response({error:'private secret error'},false),()=>response({error:'Changed, but readback unavailable'},false),()=>{throw Error('network');}]){
  const f=fixture(file,'WorkspaceAccessAdmin',props([workspace]),handler);review(f,'grant').props.onClick({currentTarget:{focus(){}}});await settle();f.render();assert.match(text(f.tree),/Previous workspace and grant facts have been cleared/);assert.doesNotMatch(text(f.tree),/Synthetic Client|private secret error|Current registry confirms/);assert.equal(f.calls.length,1);assert.equal(nodes(f.tree,'button').length,1);assert.ok(button(f,'Reload current registry'));
 }
});
test('invalid review source or reason issues no write, and selecting another workspace clears a pending review',()=>{
 const second={...workspace,id:id(6),organisationId:id(7),name:'Second synthetic workspace'};const f=fixture(file,'WorkspaceAccessAdmin',props([workspace,second]));f.render();button(f,'Grant exact access').props.onClick({currentTarget:{focus(){}}});f.render();const form=nodes(f.tree,'form')[0];form.props.action({get:key=>({personId:id(99),permission:'VIEW',reason})[key]});f.render();assert.equal(button(f,'Confirm exact grant'),undefined);
 form.props.action({get:key=>({personId:id(3),permission:'ADMIN',reason})[key]});f.render();assert.equal(button(f,'Confirm exact grant'),undefined);
 form.props.action({get:key=>({personId:id(3),permission:'VIEW',reason:'short'})[key]});f.render();assert.equal(button(f,'Confirm exact grant'),undefined);
 form.props.action({get:key=>({personId:id(3),permission:'VIEW',reason})[key]});f.render();assert.ok(button(f,'Confirm exact grant'));nodes(f.tree,'button').find(n=>text(n).includes('Second synthetic workspace')).props.onClick({currentTarget:{focus(){}}});f.render();assert.equal(button(f,'Confirm exact grant'),undefined);assert.equal(f.calls.length,0);
});
test('read-only grant rows distinguish future/expired/revoked scope and preserve independent open-if-granted navigation',()=>{
 const f=fixture(file,'WorkspaceAccessAdmin',props([{...workspace,grants:[existingGrant,{...existingGrant,id:id(8),effectiveFrom:'2099-01-01T00:00:00Z'},{...existingGrant,id:id(9),effectiveUntil:'2020-01-01T00:00:00Z'},{...existingGrant,id:id(10),revokedAt:'2026-01-01T00:00:00Z'}]}]));f.render();const rendered=text(f.tree);for(const value of ['Current','Not yet effective','Expired','Revoked','no end date recorded','Existing synthetic grant'])assert.ok(rendered.includes(value));assert.equal(nodes(f.tree,'a')[0].props.href,`/client-workspaces/${workspace.id}`);assert.match(rendered,/Open workspace if granted/);assert.equal(f.calls.length,0);
});
