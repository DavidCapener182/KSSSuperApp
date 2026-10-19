import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const root=process.env.KSS_UI_SOURCE_ROOT||resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const ts=createRequire(resolve(root,'package.json'))('typescript');
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const nodes=(n,t)=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(x=>nodes(x,t)):[...(n.type===t?[n]:[]),...nodes(n.props?.children,t)];
export const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(' '):n&&typeof n==='object'?text(n.props?.children):'';
export const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
export const response=(data,ok=true)=>({ok,status:ok?200:403,json:async()=>data});
export const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
// Actual source executes with explicit synthetic hooks/DOM/HTTP boundaries. No real authentication/RLS/persistence.
export function fixture(file,name,props,handle){let cursor=0,slots=[],tree,timers=[],uuid=90;const calls=[];
 const hooks={useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v});},useCallback(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={deps,fn};return slots[i].fn;},useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j])){slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};}}};
 const jsx=(type,props)=>({type,props:props??{}}),m={exports:{}};
 const mocks={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'next/link':{default:'a',__esModule:true},'next/navigation':{useRouter:()=>({push:href=>calls.push({navigation:href}),refresh(){}})},'@/components/ui/button':{Button:'button'},'@/components/ui/input':{Input:'input'},'@/lib/crm/due-status':{crmDueStatus:()=> 'No due date'},'./record-section-tracker':{RecordSectionTracker:'tracker'},'@/components/crm-operational':{CrmPipeline:'pipeline',CrmRecordWork:'record-work'},'@/components/crm-operational-links':{CrmOperationalLinks:'source-links'},'@/components/crm-attention':{CrmAttention:'attention'},'./incident-focus-panel':{IncidentFocusPanel:'incident-panel'},'@/components/ui/sheet':Object.fromEntries(['Sheet','SheetContent','SheetHeader','SheetTitle','SheetDescription','SheetTrigger'].map(n=>[n,n]))};
 const js=ts.transpileModule(readFileSync(resolve(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new vm.Script(js+(name==='CorrectionForm'?'\nexports.CorrectionForm=CorrectionForm;':''),{filename:file}).runInNewContext({module:m,exports:m.exports,require:n=>{if(n.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})};if(mocks[n])return mocks[n];throw Error('Unmocked module '+n);},Date,Intl,URLSearchParams,crypto:{randomUUID:()=>id(uuid++)},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(id){timers[id-1]=null;},clearInterval(){},window:{setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},setInterval(){},addEventListener(){},removeEventListener(){}},HTMLElement:class{},document:{querySelector:()=>null,visibilityState:'visible',getElementById:()=>({scrollIntoView(){}}),addEventListener(){},removeEventListener(){}},fetch:async(url,init={})=>{const call={url,method:init.method??'GET',body:init.body?JSON.parse(init.body):null};calls.push(call);return handle(call,calls);}});
 function render(){cursor=0;tree=m.exports[name](props);while(typeof tree?.type==='function')tree=tree.type(tree.props);return tree;}
 return {calls,render,reload:()=>slots.find(s=>s?.fn)?.fn(),get tree(){return tree;},async ready(){render();timers.splice(0).forEach(f=>f?.());await tick();render();},unmount(){slots.forEach(s=>s?.cleanup?.());},change(label,value,index=0){const field=nodes(tree,'label').filter(n=>text(n).startsWith(label))[index];assert.ok(field,label);const c=nodes(field,'input')[0]??nodes(field,'textarea')[0]??nodes(field,'select')[0];c.props.onChange({target:{value,checked:value}});render();},click(label){const b=nodes(tree,'button').find(n=>text(n)===label);assert.ok(b,label);b.props.onClick({currentTarget:{isConnected:true,focus(){}}});render();},async submit(needle=''){const f=nodes(tree,'form').find(n=>text(n).includes(needle));assert.ok(f,needle);f.props.onSubmit({preventDefault(){}});await tick();render();}};
}
