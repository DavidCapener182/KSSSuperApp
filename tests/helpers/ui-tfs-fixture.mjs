import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import {STATUSES} from '../../src/lib/client-workspaces/types.ts';
import {assignmentReceipt} from '../../src/lib/client-workspaces/assignment-receipt.ts';
const root=process.env.KSS_UI_SOURCE_ROOT||resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const all=n=>Array.isArray(n)?n.flatMap(all):n&&typeof n==='object'?[n,...all(n.props?.children)]:[];
export const nodes=(tree,type)=>all(tree).filter(n=>n.type===type);
export const text=n=>n==null||typeof n==='boolean'?'':Array.isArray(n)?n.map(text).join(' '):typeof n==='object'?text(n.props?.children):String(n);
export const response=(body,ok=true)=>({ok,status:ok?200:403,json:async()=>body});
export const settle=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
// Real source; isolated synthetic hooks/HTTP/Sheet projections, not React DOM/auth/RLS/persistence.
export function fixture(file,name,props,handler=()=>{throw Error('No HTTP expected');}){
 let cursor=0,tree;const slots=[],timers=[],calls=[],navigation=[];
 const same=(a,b)=>a?.length===b?.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={useState(value){const i=cursor++;if(!(i in slots))slots[i]={value:typeof value==='function'?value():value,set(next){slots[i].value=typeof next==='function'?next(slots[i].value):next;}};return [slots[i].value,slots[i].set];},useRef(value){const i=cursor++;return slots[i]??(slots[i]={current:value});},useMemo(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},useEffect(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};}}};
 const jsx=(type,props)=>({type,props:props??{}}),loaded={exports:{}};
 const mocks={react,'react-dom':{flushSync:fn=>fn()},'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'next/link':{__esModule:true,default:'a'},'next/navigation':{useRouter:()=>({refresh:()=>navigation.push('refresh'),push:href=>navigation.push(href)})},'@/lib/client-workspaces/types':{STATUSES},'@/lib/client-workspaces/assignment-receipt':{assignmentReceipt},'@/components/ui/sheet':Object.fromEntries(['Sheet','SheetContent','SheetHeader','SheetTitle','SheetDescription','SheetTrigger'].map(k=>[k,k]))};
 const source=readFileSync(resolve(root,file),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new vm.Script(js,{filename:file}).runInNewContext({module:loaded,exports:loaded.exports,require:name=>{if(name.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};assert.ok(Object.hasOwn(mocks,name),'Unexpected import '+name);return mocks[name];},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},fetch:async(url,init={})=>{const call={url,method:init.method??'GET',body:init.body?JSON.parse(init.body):null};calls.push(call);return handler(call,calls);}});
 function render(){cursor=0;tree=loaded.exports[name](props);return tree;}
 return {calls,navigation,render,get tree(){return tree;},async ready(){render();timers.splice(0).forEach(fn=>fn());await settle();return render();},unmount(){slots.forEach(slot=>slot?.cleanup?.());}};
}
