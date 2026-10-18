import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {test} from 'node:test';
const nativeRequire=createRequire(import.meta.url),root=resolve(import.meta.dirname,'..');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const context={personId:id(1),serviceId:id(2),roleId:id(3),asOf:'2026-10-18',personName:'Synthetic learner',serviceName:'Synthetic Service',roleName:'Synthetic role'};
const matrix=(extra={})=>({...context,policy:'SYNTHETIC_TRAINING_PILOT',rows:[],...extra});
function harness({fetcher=()=>{throw Error('Unexpected network');},props={},entry='TrainingRequirementEvidence',principal={personId:id(1),roles:['SECURITY_STAFF']},rpc=()=>({data:null,error:null}),caseRow=null}={}){
 let cursor=0;const hooks=[],effects=[],cleanups=[],calls=[],cache=new Map();
 const react={useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v;}];},useRef(value){const i=cursor++;return hooks[i]??(hooks[i]={current:value});},useEffect(fn){const i=cursor++;if(!(i in hooks)){hooks[i]=true;effects.push(fn);}}};
 const element=(type,props,key)=>({type,key,props});
 const mocks={react,'react/jsx-runtime':{jsx:element,jsxs:element,Fragment:'fragment'},'next/link':{default:'a',__esModule:true},
 '@/lib/auth/principal':{getPrincipal:async()=>principal,isUuid:s=>typeof s==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)},
 '@/lib/supabase/server':{createServerSupabase:async()=>({rpc:(name,args)=>{calls.push([name,args]);return rpc(name,args);}})},
 '@/lib/documents/policy':{},'@/lib/profile/policy':{}};
 function load(file){const absolute=resolve(root,file);if(cache.has(absolute))return cache.get(absolute).exports;const mod={exports:{}};cache.set(absolute,mod);
 const js=ts.transpileModule(readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const req=n=>{if(n.endsWith('.module.css'))return {__esModule:true,default:{}};if(n in mocks)return mocks[n];if(n==='next/server')return nativeRequire(n);if(n.startsWith('@/')){const path=`src/${n.slice(2)}`;return load(path+(path.includes('components/')?'.tsx':'.ts'));}throw Error(n);};
 new vm.Script(js).runInNewContext({module:mod,exports:mod.exports,require:req,fetch:fetcher,URLSearchParams,URL,AbortController,Request,Response});return mod.exports;}
 const source=entry==='TrainingRequirementPilot'?'src/components/training-requirement-pilot.tsx':'src/components/training-requirement-evidence.tsx';
 const render=()=>{cursor=0;return load(source)[entry](props);};
 const client={from(table){calls.push(['table',table]);const query={select(){return query;},eq(){return query;},maybeSingle(){return Promise.resolve({data:caseRow,error:null});}};return query;},rpc:async(...args)=>{calls.push(args);return rpc(...args);}};
 return {render,load,props,calls,client,mount(){const tree=render();effects.splice(0).forEach(fn=>cleanups.push(fn()));return tree;},unmount(){cleanups.forEach(fn=>fn?.());},settle:async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);}};
}
function nodes(t){return Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];}
function text(t){return Array.isArray(t)?t.map(text).join(' '):t&&typeof t==='object'?text(t.props?.children):t==null||typeof t==='boolean'?'':String(t);}
const response=(data,ok=true)=>({ok,json:async()=>({data})});

test('matrix read sends exact context and renders no deployment or credential verdict',async()=>{
 const calls=[];const h=harness({props:{context,staffLinks:true,canReviewCompletions:false},fetcher:async(path,options)=>{calls.push([path,options]);return response(matrix());}});
 nodes(h.mount()).find(n=>n.type==='button').props.onClick();await h.settle();
 const query=new URL(calls[0][0],'http://localhost').searchParams;for(const key of ['person','service','role','asOf'])assert.equal(query.get(key),context[{person:'personId',service:'serviceId',role:'roleId',asOf:'asOf'}[key]]);
 assert.equal(calls[0][1].cache,'no-store');assert.match(text(h.render()),/NOT_APPLICABLE/);assert.doesNotMatch(text(h.render()),/ready|eligible|compliant/i);
});
for(const [field,value] of [['personId',id(9)],['serviceId',id(9)],['roleId',id(9)],['asOf','2026-10-19'],['policy','LIVE_POLICY'],['rows',null],['rows',[{label:'Wrong status',versionId:id(8),courseVersionId:id(7),status:'READY'}]]])test(`wrong matrix ${field} cannot become evidence`,async()=>{
 const h=harness({props:{context,staffLinks:false,canReviewCompletions:false},fetcher:async()=>response(matrix({[field]:value}))});nodes(h.mount()).find(n=>n.type==='button').props.onClick();await h.settle();assert.match(text(h.render()),/SOURCE_UNAVAILABLE/);assert.doesNotMatch(text(h.render()),/NOT_APPLICABLE|Wrong status/);
});
test('unmounted context ignores late noncooperative fetch completion',async()=>{
 let release;const h=harness({props:{context,staffLinks:false,canReviewCompletions:false},fetcher:()=>new Promise(r=>release=r)});
 nodes(h.mount()).find(n=>n.type==='button').props.onClick();h.unmount();release(response(matrix({rows:[{label:'STALE CONTEXT A',versionId:id(5),courseVersionId:id(6),status:'COMPLETED'}]})));await h.settle();assert.doesNotMatch(text(h.render()),/STALE CONTEXT A/);
});
test('selected context and source-review authority key evidence lifecycle; lost viewer hides it',()=>{
 const rights={viewer:true,staff:false};const h=harness({entry:'TrainingRequirementPilot',props:{rights,contexts:[context,{...context,serviceId:id(4)}],initial:null}});
 const child=tree=>nodes(tree).find(n=>typeof n.type==='function');let tree=h.render(),first=child(tree);nodes(tree).find(n=>n.type==='select').props.onChange({target:{value:'1'}});tree=h.render();assert.notEqual(child(tree).key,first.key);
 h.props.canReviewCompletions=true;assert.notEqual(child(h.render()).key,child(tree).key);rights.viewer=false;assert.equal(child(h.render()),undefined);assert.match(text(h.render()),/No authorised/);
});
for(const role of [null,'OPERATIONS','SECURITY_STAFF'])test(`matrix API preserves principal and denied-source boundary for ${role}`,async()=>{
 const h=harness({principal:role?{personId:id(1),roles:[role]}:null,rpc:()=>({data:null,error:{message:'private-sentinel'}})});
 const route=h.load('src/app/api/training-requirements/route.ts');const response=await route.GET(new Request(`http://localhost/api/training-requirements?view=matrix&person=${context.personId}&service=${context.serviceId}&role=${context.roleId}&asOf=${context.asOf}`));assert.equal(response.status,role?403:401);assert.doesNotMatch(await response.text(),/private-sentinel/);assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal(h.calls.length,role?1:0);
});
test('onboarding foreign Staff and lost Office source grant stop before private evidence reads',async()=>{
 for(const role of ['SECURITY_STAFF','OFFICE_ADMIN','OPERATIONS']){
  const h=harness({caseRow:{id:id(20),person_id:id(2),owner_person_id:id(3)},rpc:()=>({data:null,error:{message:'revoked'}})});
  const policy=h.load('src/lib/onboarding/policy.ts');const result=await policy.readOnboardingCase(h.client,{personId:id(1),roles:[role]},id(20));assert.equal(result,null);assert.ok(!h.calls.some(c=>c[0]==='table'&&c[1]!=='onboarding_cases'));
 }
});

for(const [staffLinks,canReviewCompletions,href] of [[true,false,`/training/my-learning/${id(40)}`],[false,true,`/training-admin/completions?assignment=${id(40)}`],[false,false,null]])test(`exact source assignment link respects Staff/reviewer display authority ${staffLinks}/${canReviewCompletions}`,async()=>{
 const row={requirementId:id(30),versionId:id(31),version:2,label:'Synthetic completion evidence',status:'COMPLETED',courseVersionId:id(32),assignmentId:id(40),completionId:id(41),completionRuleVersionId:id(42),completedAt:'2026-10-17T12:00:00Z',certificateIssueId:null};
 const h=harness({props:{context,staffLinks,canReviewCompletions},fetcher:async()=>response(matrix({rows:[row]}))});nodes(h.mount()).find(n=>n.type==='button').props.onClick();await h.settle();
 const links=nodes(h.render()).filter(n=>n.props?.href);assert.deepEqual(links.map(n=>n.props.href),href?[href]:[]);assert.match(text(h.render()),new RegExp(id(41)));assert.doesNotMatch(text(h.render()),/Separate certificate issue/);
});

test('removed selected context resets the reader to the visibly selected remaining context',()=>{
 const h=harness({entry:'TrainingRequirementPilot',props:{rights:{viewer:true,staff:false},contexts:[context,{...context,serviceId:id(4)}],initial:null}});
 let tree=h.render();nodes(tree).find(n=>n.type==='select').props.onChange({target:{value:'1'}});tree=h.render();const oldKey=nodes(tree).find(n=>typeof n.type==='function').key;
 h.props.contexts=[context];tree=h.render();const child=nodes(tree).find(n=>typeof n.type==='function');assert.equal(child.props.context.serviceId,context.serviceId);assert.notEqual(child.key,oldKey);assert.equal(nodes(tree).find(n=>n.type==='select').props.value,0);
});

test('matrix read keeps existing shared action busy lock and releases it on unmount',async()=>{
 let release;const states=[];const h=harness({props:{context,staffLinks:false,canReviewCompletions:false,actionBusy:true,onBusyChange:value=>states.push(value)},fetcher:()=>new Promise(r=>release=r)});
 assert.equal(nodes(h.mount()).find(n=>n.type==='button').props.disabled,true);h.props.actionBusy=false;nodes(h.render()).find(n=>n.type==='button').props.onClick();assert.deepEqual(states,[true]);h.unmount();assert.deepEqual(states,[true,false]);release(response(matrix()));await h.settle();assert.deepEqual(states,[true,false]);
});
