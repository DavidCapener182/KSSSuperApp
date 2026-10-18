import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {test} from 'node:test';
const root=resolve(import.meta.dirname,'..'),nativeRequire=createRequire(import.meta.url),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const person={id:id(10),display_name:'Synthetic candidate',role:'STEWARD',check:{result:'SYNTHETIC_CHECKS_PASSED_WITH_WARNINGS',availability:'NOT_DECLARED',reasons:[],policy_version:1}};
const allocation={id:id(40),person_id:person.id,person_name:'Synthetic allocated person',status:'ALLOCATED',revision:1,allocated_at:'2026-10-18T09:00:00Z',availability_conflict:null};
const detail=(allocations=[])=>({required:2,allocated:allocations.filter(a=>['ALLOCATED','ACCEPTED'].includes(a.status)).length,accepted:0,remaining:2-allocations.filter(a=>['ALLOCATED','ACCEPTED'].includes(a.status)).length,allocations});
const response=(body,ok=true)=>({ok,json:async()=>body});
function harness(fetcher,{onChanged=async()=>true,principal={roles:['OPERATIONS']},rpc=()=>({data:null,error:null}),client='DeploymentLineClient'}={}){
 let cursor=0;const hooks=[],effects=[],calls=[],cache=new Map();const same=(a,b)=>a?.length===b?.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={useState(v){const i=cursor++;if(!(i in hooks))hooks[i]=v;return[hooks[i],n=>hooks[i]=typeof n==='function'?n(hooks[i]):n];},useRef(v){const i=cursor++;return hooks[i]??(hooks[i]={current:v});},useCallback(fn,deps){const i=cursor++;if(!same(hooks[i]?.deps,deps))hooks[i]={fn,deps};return hooks[i].fn;},useEffect(fn,deps){const i=cursor++;if(!same(hooks[i]?.deps,deps)){const previous=hooks[i];hooks[i]={deps};effects.push(()=>{previous?.cleanup?.();hooks[i].cleanup=fn();});}}};
 const element=(type,props,key)=>({type,key,props});
 const mocks={react,'react/jsx-runtime':{jsx:element,jsxs:element,Fragment:'fragment'},'@/components/ui/button':{Button:'button'},'@/components/ui/input':{Input:'input'},'@/components/ui/sheet':{Sheet:'sheet',SheetContent:'content',SheetTitle:'title'},'@/components/leave-reconciliation':{LeaveReconciliation:'leave'},'next/link':{default:'a',__esModule:true},'@/components/deployment-line-client':{DeploymentLineClient:'deployment'},
 '@/lib/auth/principal':{getPrincipal:async()=>principal,isUuid:s=>typeof s==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)},'@/lib/supabase/server':{createServerSupabase:async()=>({rpc:(name,args)=>{calls.push([name,args]);return rpc(name,args);}})}};
 function load(file){const path=resolve(root,file);if(cache.has(path))return cache.get(path).exports;const mod={exports:{}};cache.set(path,mod);const js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new vm.Script(js).runInNewContext({module:mod,exports:mod.exports,require:n=>n in mocks?mocks[n]:n.endsWith('.css')?{default:{},__esModule:true}:n==='next/server'?nativeRequire(n):n.startsWith('@/')?load('src/'+n.slice(2)+'.ts'):(()=>{throw Error(n)})(),fetch:fetcher,setTimeout,clearTimeout,AbortController,Request,Response,URL,URLSearchParams});return mod.exports;}
 const props={eventId:id(1),requirementId:id(2),revision:1,roleName:'Synthetic role',area:'Gate A',disabled:false,open:true,onClose(){},onChanged};
 const render=()=>{cursor=0;return load(client==='MyDeploymentsClient'?'src/components/my-deployments-client.tsx':client==='StaffingPlanClient'?'src/components/staffing-plan-client.tsx':'src/components/deployment-line-client.tsx')[client](props);};
 const settle=async()=>{for(let n=0;n<8;n++)await new Promise(r=>setTimeout(r,1));};
 return{props,calls,load,render,settle,async commit(){const tree=render();effects.splice(0).forEach(f=>f());await settle();return tree;},async mount(){await this.commit();return render();},unmount(){for(const h of hooks)h?.cleanup?.();}};
}
function nodes(t){return Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];}
function text(t){return Array.isArray(t)?t.map(text).join(' '):t&&typeof t==='object'?text(t.props?.children):t==null||typeof t==='boolean'?'':String(t);}
const button=(tree,name)=>nodes(tree).filter(n=>n.type==='button'&&text(n)===name).at(-1);

test('denied fresh Event read removes old allocations and candidates',async()=>{
 let denied=false;const h=harness(async path=>denied?response({error:'Source revoked'},false):response(path.includes('/candidates')?{candidates:{total:1,items:[person]}}:{deployment:detail([allocation])}));await h.mount();assert.match(text(h.render()),/Synthetic allocated person/);denied=true;nodes(h.render()).find(n=>n.type==='input').props.onChange({target:{value:'new'}});await h.commit();assert.doesNotMatch(text(h.render()),/Synthetic allocated person|Synthetic candidate/);assert.equal(button(h.render(),'Select'),undefined);
});
test('late noncooperative candidate A cannot replace newer candidate B',async()=>{
 let release;const h=harness(async path=>{if(!path.includes('/candidates'))return response({deployment:detail()});const query=new URL(path,'http://local').searchParams.get('search');if(query==='A')return new Promise(r=>release=r);return response({candidates:{total:1,items:[{...person,display_name:query==='B'?'LATEST B':'Initial'}]}});});await h.mount();nodes(h.render()).find(n=>n.type==='input').props.onChange({target:{value:'A'}});await h.commit();nodes(h.render()).find(n=>n.type==='input').props.onChange({target:{value:'B'}});await h.commit();release(response({candidates:{total:1,items:[{...person,display_name:'STALE A'}]}}));await h.settle();assert.match(text(h.render()),/LATEST B/);assert.doesNotMatch(text(h.render()),/STALE A/);
});
for(const variant of ['missing','wrong-person','inactive','missing-receipt','correct'])test(`allocation requires exact receipt/person/active source readback: ${variant}`,async()=>{
 let posted=false,changed=0,posts=0;const h=harness(async(path,options)=>{
  if(options?.method==='POST'){posted=true;posts++;return response(variant==='missing-receipt'?{}:{id:allocation.id});}
  if(path.includes('/candidates'))return response({candidates:{total:1,items:[person]}});
  const rows=!posted||variant==='missing'?[]:[{...allocation,...(variant==='wrong-person'?{person_id:id(99)}:variant==='inactive'?{status:'CANCELLED',revision:2}:{})}];return response({deployment:detail(rows)});
 },{onChanged:async()=>{changed++;return true;}});await h.mount();button(h.render(),'Select').props.onClick();button(h.render(),'Allocate').props.onClick();await h.settle();assert.equal(posts,1);assert.equal(changed,variant==='correct'?1:0);if(variant!=='correct')assert.match(text(h.render()),/could not be confirmed/);
});
for(const variant of ['unchanged','missing','correct'])test(`cancellation requires exact historical allocation readback: ${variant}`,async()=>{
 let patched=false,changed=0;const h=harness(async(path,options)=>{if(options?.method==='PATCH'){patched=true;return response({revision:2});}if(path.includes('/candidates'))return response({candidates:{total:0,items:[]}});return response({deployment:detail(patched&&variant==='missing'?[]:[{...allocation,...(patched&&variant==='correct'?{status:'CANCELLED',revision:2}:{})}])});},{onChanged:async()=>{changed++;return true;}});await h.mount();button(h.render(),'Cancel allocation').props.onClick();nodes(h.render()).find(n=>n.type==='textarea').props.onChange({target:{value:'Synthetic cancellation'}});button(h.render(),'Cancel allocation').props.onClick();await h.settle();assert.equal(changed,variant==='correct'?1:0);if(variant!=='correct')assert.match(text(h.render()),/could not be confirmed/);
});


test('a pending allocation cannot send a duplicate POST before repaint',async()=>{
 let release,posts=0;const h=harness(async(path,options)=>{if(options?.method==='POST'){posts++;return new Promise(r=>release=r);}return response(path.includes('/candidates')?{candidates:{total:1,items:[person]}}:{deployment:detail(posts?[allocation]:[])});});await h.mount();button(h.render(),'Select').props.onClick();const click=button(h.render(),'Allocate').props.onClick;click();click();assert.equal(posts,1);release(response({id:allocation.id}));await h.settle();
});

for(const variant of ['correct','wrong-id','wrong-source','cancelled','denied','page-denied'])test(`Staff response requires two exact source readbacks and retains Schedule return: ${variant}`,async()=>{
 let patched=false,checks=0,posts=0;const row={...allocation,source:'EVENT',event_name:'Synthetic Event',event_status:'CONFIRMED',site_name:'Synthetic Site',role_name:'Steward',report_at:'2026-10-18T09:00:00Z',shift_starts_at:'2026-10-18T10:00:00Z',shift_ends_at:'2026-10-18T18:00:00Z',area_label:'Gate',service_date:'2026-10-18'};
 const h=harness(async(path,options)=>{if(options?.method==='PATCH'){patched=true;posts++;assert.equal(path,`/api/deployments/me/${allocation.id}`);const body=JSON.parse(options.body);assert.equal(body.expectedRevision,1);assert.equal(body.response,'ACCEPTED');return response({revision:2});}
 if(patched)checks++;if(patched&&(variant==='denied'||variant==='page-denied'&&checks===2))return response({error:'Source revoked'},false);
 const checked={...row,status:patched?'ACCEPTED':'ALLOCATED',...(patched&&variant==='wrong-id'?{id:id(99)}:patched&&variant==='wrong-source'?{source:'SITE_SHIFT'}:patched&&variant==='cancelled'?{status:'CANCELLED'}:{})};return response({deployments:{items:[checked],total:1}});},{client:'MyDeploymentsClient'});h.props.returnWeek='2026-10-12';await h.mount();const link=nodes(h.render()).find(n=>n.type==='a'&&text(n)==='Return to My Schedule');assert.equal(link.props.href,'/my-schedule?week=2026-10-12');button(h.render(),'Accept allocation').props.onClick();await h.settle();assert.equal(posts,1);if(variant==='correct')assert.match(text(h.render()),/Accepted allocation confirmed/);else{assert.doesNotMatch(text(h.render()),/Accepted allocation confirmed/);assert.match(text(h.render()),/could not be confirmed/);}
});

for(const role of [null,'SECURITY_STAFF','OFFICE_ADMIN','OPERATIONS'])test(`Event route rechecks role and exact source identity: ${role}`,async()=>{
 const h=harness(()=>{throw Error('Network forbidden');},{principal:role?{roles:[role]}:null,rpc:()=>({data:null,error:{message:'private-record-sentinel'}})});
 const route=h.load('src/app/api/events/[id]/staffing-requirements/[requirementId]/allocations/route.ts'),params={params:Promise.resolve({id:id(1),requirementId:id(2)})};
 const result=await route.GET(null,params);assert.equal(result.status,role==='OFFICE_ADMIN'||role==='OPERATIONS'?404:role?403:401);assert.doesNotMatch(await result.text(),/private-record-sentinel/);assert.equal(h.calls.length,role==='OFFICE_ADMIN'||role==='OPERATIONS'?1:0);
 if(h.calls.length){assert.equal(h.calls[0][1].p_event,id(1));assert.equal(h.calls[0][1].p_requirement,id(2));}
});

for(const result of ['BLOCKED','REVIEW_REQUIRED'])test(`accepted warning and Time Away boundaries remain explicit: ${result}`,async()=>{
 let posted=false;const candidate={...person,check:{...person.check,result,reasons:[result==='BLOCKED'?'APPROVED_TIME_AWAY_CONFLICT':'AVAILABILITY_NOT_DECLARED']}};
 const h=harness(async(path,options)=>{if(options?.method==='POST'){const body=JSON.parse(options.body);assert.equal(body.acknowledgeWarnings,true);assert.equal(body.reason,'Reviewed synthetic warnings');posted=true;return response({id:allocation.id});}return response(path.includes('/candidates')?{candidates:{total:1,items:[candidate]}}:{deployment:detail(posted?[allocation]:[])});});await h.mount();
 if(result==='BLOCKED'){assert.equal(button(h.render(),'Select').props.disabled,true);assert.match(text(h.render()),/Approved time away overlaps/);}
 else{button(h.render(),'Select').props.onClick();assert.equal(button(h.render(),'Allocate').props.disabled,true);nodes(h.render()).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});assert.equal(button(h.render(),'Allocate').props.disabled,true);nodes(h.render()).find(n=>n.type==='textarea').props.onChange({target:{value:'Reviewed synthetic warnings'}});assert.equal(button(h.render(),'Allocate').props.disabled,false);button(h.render(),'Allocate').props.onClick();await h.settle();assert.equal(posted,true);}
});

test('source allocation RPC conflict is mapped without leaking private details',async()=>{
 const h=harness(()=>{throw Error('Network forbidden');},{rpc:()=>({data:null,error:{message:'APPROVED_TIME_AWAY_CONFLICT private-record-sentinel'}})});
 const route=h.load('src/app/api/events/[id]/staffing-requirements/[requirementId]/allocations/route.ts');
 const result=await route.POST(new Request('http://localhost/api/synthetic',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({personId:person.id,expectedRevision:1,acknowledgeWarnings:false,reason:null})}),{params:Promise.resolve({id:id(1),requirementId:id(2)})});assert.equal(result.status,409);const body=await result.text();assert.match(body,/APPROVED_TIME_AWAY_CONFLICT/);assert.doesNotMatch(body,/private-record-sentinel/);
});

for(const source of ['EVENT','SITE_SHIFT'])test(`Staff explicit decline retains reason, revision and typed source: ${source}`,async()=>{
 let declined=false,writes=0;const own={...allocation,source,event_name:'Synthetic offer',event_status:'CONFIRMED',site_name:'Synthetic Site',role_name:'Steward',report_at:'2026-10-18T09:00:00Z',shift_starts_at:'2026-10-18T10:00:00Z',shift_ends_at:'2026-10-18T18:00:00Z',area_label:'Gate'};
 const h=harness(async(path,options)=>{if(options?.method==='PATCH'){assert.equal(path,source==='EVENT'?`/api/deployments/me/${own.id}`:`/api/deployments/site-shifts/me/${own.id}`);const body=JSON.parse(options.body);assert.equal(body.response,'DECLINED');assert.equal(body.expectedRevision,1);assert.equal(body.reasonCode,'TIMING_CONFLICT');assert.equal(body.note,'Synthetic scheduling conflict');declined=true;writes++;return response({revision:2});}return response({deployments:{items:[{...own,status:declined?'DECLINED':'ALLOCATED'}],total:1}});},{client:'MyDeploymentsClient'});
 await h.mount();button(h.render(),'Decline').props.onClick({currentTarget:{isConnected:true,focus(){}}});nodes(h.render()).find(n=>n.type==='select').props.onChange({target:{value:'TIMING_CONFLICT'}});nodes(h.render()).find(n=>n.type==='textarea').props.onChange({target:{value:'Synthetic scheduling conflict'}});button(h.render(),'Confirm decline').props.onClick();await h.settle();assert.equal(writes,1);assert.match(text(h.render()),/Declined allocation confirmed/);assert.equal(nodes(h.render()).some(n=>n.type==='a'&&text(n)==='Next: open attendance'),false);
});

for(const action of ['allocate','cancel'])test(`a ${action} write resolving after unmount starts no old-source read or parent refresh`,async()=>{
 let release,gets=0,writes=0,changed=0;const h=harness(async(path,options)=>{if(options?.method==='POST'||options?.method==='PATCH'){writes++;return new Promise(r=>release=r);}gets++;return response(path.includes('/candidates')?{candidates:{total:1,items:[person]}}:{deployment:detail(action==='cancel'?[allocation]:[])});},{onChanged:async()=>{changed++;return true;}});
 await h.mount();if(action==='allocate'){button(h.render(),'Select').props.onClick();button(h.render(),'Allocate').props.onClick();}else{button(h.render(),'Cancel allocation').props.onClick();nodes(h.render()).find(n=>n.type==='textarea').props.onChange({target:{value:'Synthetic reason'}});button(h.render(),'Cancel allocation').props.onClick();}
 const before=gets;h.unmount();release(response(action==='allocate'?{id:allocation.id}:{revision:2}));await h.settle();assert.equal(writes,1);assert.equal(gets,before);assert.equal(changed,0);
});

for(const action of ['allocate','cancel'])test(`a ${action} source readback resolving after unmount invokes no parent refresh`,async()=>{
 let posted=false,release,changed=0;const h=harness(async(path,options)=>{if(options?.method==='POST'||options?.method==='PATCH'){posted=true;return response(action==='allocate'?{id:allocation.id}:{revision:2});}if(posted&&!path.includes('/candidates'))return new Promise(r=>release=r);return response(path.includes('/candidates')?{candidates:{total:1,items:[person]}}:{deployment:detail(action==='cancel'?[allocation]:[])});},{onChanged:async()=>{changed++;return true;}});
 await h.mount();if(action==='allocate'){button(h.render(),'Select').props.onClick();button(h.render(),'Allocate').props.onClick();}else{button(h.render(),'Cancel allocation').props.onClick();nodes(h.render()).find(n=>n.type==='textarea').props.onChange({target:{value:'Synthetic reason'}});button(h.render(),'Cancel allocation').props.onClick();}
 await h.settle();h.unmount();release(response({deployment:detail([{...allocation,...(action==='cancel'?{status:'CANCELLED',revision:2}:{})}])}));await h.settle();assert.equal(changed,0);
});


test('an old drawer callback cannot start a parent plan read after Event context changes',async()=>{
 let gets=0;const planned={id:id(2),role_id:id(3),role_name:'Steward',service_date:'2026-10-18',required_quantity:2,report_at:'2026-10-18T09:00:00Z',shift_starts_at:'2026-10-18T10:00:00Z',shift_ends_at:'2026-10-18T18:00:00Z',area_label:'Gate',instructions:'',state:'PLANNED',revision:1};
 const h=harness(async path=>{gets++;return response(path.endsWith('/deployment-summary')?{summary:{...detail(),lines:{}}}:path.endsWith('staffing-roles')?{roles:[]}:{plan:{items:[planned],required_total:2}});},{client:'StaffingPlanClient'});h.props.eventStatus='CONFIRMED';h.props.eventStarts='2026-10-18T08:00:00Z';h.props.eventEnds='2026-10-18T20:00:00Z';h.props.focusRequirement=id(2);await h.mount();await h.commit();const old=nodes(h.render()).find(n=>n.type==='deployment').props.onChanged;h.props.eventId=id(99);await h.commit();const before=gets;assert.equal(await old(),false);assert.equal(gets,before);
});
