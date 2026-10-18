import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const card={source:'EVENT',source_id:id(1),site_id:id(2),service_date:null,name:'Synthetic Event',site_name:'Synthetic Site',source_state:'PUBLISHED',kind:'EVENT_SECURITY',starts_at:'2026-10-18T08:00:00Z',ends_at:'2026-10-18T20:00:00Z',area:'Gate',required:4,allocated:2,accepted:1,awaiting_response:1,conflicts:0,checked_in:1,attendance_reviews:1,recorded_no_shows:0};
const snapshot={as_of:'2026-10-18T08:00:00Z',today:'2026-10-18',upcoming_until:'2026-10-25',recent_from:'2026-10-17',total:1,attention_total:1,attention:[card],cards:[card],sites:[{id:id(2),name:'Synthetic Site'}],incidents:null,horizon:null};
const nodes=(n,t)=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(x=>nodes(x,t)):[...(n.type===t?[n]:[]),...nodes(n.props?.children,t)];
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(' '):n&&typeof n==='object'?text(n.props?.children):'';
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function fixture(initial={},options={}){
 let cursor=0,slots=[],timers=[],tree;const calls=[];
 const hooks={useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v});},useCallback(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={deps,fn};return slots[i].fn;},useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={deps,cleanup:fn()};}};
 const jsx=(type,props)=>({type,props:props??{}}),m={exports:{}};
 new vm.Script(ts.transpileModule(readFileSync(resolve(root,'src/components/control-room-client.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText).runInNewContext({module:m,exports:m.exports,require:n=>n.endsWith('.css')?{}:{react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'next/link':{default:'a',__esModule:true},'@/components/ui/button':{Button:'button'}}[n],Date,Intl,URLSearchParams,setTimeout:fn=>{timers.push(fn);},clearTimeout(){},setInterval(){},clearInterval(){},document:{hidden:false,addEventListener(){},removeEventListener(){}},fetch:async(url,init={})=>{calls.push({url,...init});if(options.denyRefresh&&calls.length>1)return {ok:false,status:403,json:async()=>({error:"Synthetic role removed"})};return {ok:true,json:async()=>({snapshot})};}});
 function render(){cursor=0;tree=m.exports.ControlRoomClient({initial});return tree;}
 return {calls,render,get tree(){return tree;},async ready(){render();timers.splice(0).forEach(f=>f());await tick();render();},click(label){const b=nodes(tree,'button').find(n=>text(n)===label);assert.ok(b,label);b.props.onClick();render();}};
}
test('source and attendance links preserve exact record plus bounded desk return filters',async()=>{const f=fixture({tab:'attendance',source:'EVENT',site:id(2),offset:30,focus:`EVENT:${id(1)}:`});await f.ready();assert.match(text(f.tree),/Today\s+18 Oct 2026/);const link=nodes(f.tree,'a').find(n=>n.props['aria-label']==='Review attendance: Synthetic Event');assert.ok(link);const parsed=new URL(link.props.href,'http://synthetic.invalid');assert.equal(parsed.pathname,`/events/${id(1)}/attendance`);const back=new URL(parsed.searchParams.get('returnTo'),'http://synthetic.invalid');assert.equal(back.pathname,'/control-room');for(const [key,value]of Object.entries({tab:'attendance',source:'EVENT',site:id(2),offset:'30',focus:`EVENT:${id(1)}:`}))assert.equal(back.searchParams.get(key),value);assert.equal(f.calls.some(c=>c.method&&c.method!=='GET'),false);});
test('unavailable incident authority remains separate from staffing facts',async()=>{const f=fixture();await f.ready();f.click('Incidents');assert.match(text(f.tree),/Incident review is unavailable under your current authority/);assert.equal(nodes(f.tree,'a').some(n=>n.props.href.startsWith('/incidents/')),false);});
test('handover uses its authorised source rather than inventing a count or ready label',async()=>{const f=fixture();await f.ready();f.click('Handover');assert.match(text(f.tree),/cannot show a current duty-level count/);assert.ok(nodes(f.tree,'a').some(n=>n.props.href==='/site-book'));});
test('large display removes individual source actions while retaining source facts',async()=>{const f=fixture();await f.ready();f.click('Large display');assert.match(text(f.tree),/Synthetic Event/);assert.equal(nodes(f.tree,'a').some(n=>n.props.href.startsWith('/events/')),false);assert.equal(nodes(f.tree,'button').find(n=>text(n)==='Standard view').props['aria-pressed'],true);});

test('denied Control Room refresh removes cached operational and incident references',async()=>{const f=fixture({}, {denyRefresh:true});await f.ready();f.click('Refresh');await tick();f.render();assert.doesNotMatch(text(f.tree),/Synthetic Event/);assert.match(text(f.tree),/unavailable/);assert.equal(nodes(f.tree,'a').some(n=>n.props.href.startsWith('/events/')),false);});
