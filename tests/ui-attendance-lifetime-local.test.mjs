import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const row = {allocation_id:id(30),person_name:'Synthetic officer',status:'ACCEPTED',service_date:'2026-10-18',report_at:'2026-10-18T16:00:00Z',shift_starts_at:'2026-10-18T16:15:00Z',shift_ends_at:'2026-10-18T22:15:00Z',area_label:'Gatehouse',role_name:'Security',site_name:'Synthetic Site',reporting_point:'Gate',attendance:{revision:0,state:'EXPECTED',check_in_at:null,check_out_at:null,no_show_recorded:false,review_required:false,events:[]}};
const pending = () => {let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const tick = async () => {for(let i=0;i<12;i++)await Promise.resolve();};
const response = (items=[structuredClone(row)],ok=true) => ({ok,json:async()=>ok?{attendance:{items,total:items.length,counts:{expected:items.length}}}:{error:'Synthetic scope revoked'}});
function fixture(source) {
  let cursor=0,slots=[],effectTimers=[],tree;const calls=[],post=pending(),readback=pending();let reads=0;
  const hooks={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
    useCallback(fn,deps){const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j]))slots[i]={fn,deps};return slots[i].fn;},
    useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j])){slots[i]={deps,cleanup:fn()};}},
  };
  const jsx=(type,props)=>({type,props:props??{}}),loaded={exports:{}};
  const mocks={'react':hooks,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'@/components/ui/button':{Button:'button'},'next/link':{default:'a',__esModule:true},'./attendance-desk':{AttendanceDesk:'attendance-desk'}};
  const filename=resolve(root,`src/components/${source==='EVENT'?'event':'site'}-attendance-client.tsx`);
  const js=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new vm.Script(js,{filename}).runInNewContext({module:loaded,exports:loaded.exports,require:name=>{if(name.endsWith('.css'))return {default:new Proxy({},{get:(_,key)=>String(key)}),__esModule:true};if(mocks[name])return mocks[name];throw Error(`Unapproved module ${name}`);},
    setTimeout:fn=>{effectTimers.push(fn);return effectTimers.length;},clearTimeout:()=>{},Date,Intl,URLSearchParams,crypto:{randomUUID:()=>id(99)},
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    fetch:async(url,init={})=>{calls.push({url,...init});if(init.method==='POST'||init.method==='PATCH')return post.promise;if(++reads===1)return response();return readback.promise;},
  });
  const Component=loaded.exports[source==='EVENT'?'EventAttendanceClient':'SiteAttendanceClient'];
  const props=source==='EVENT'?{eventId:id(1)}:{siteId:id(10),serviceId:id(11)};
  function render(){cursor=0;tree=Component(props);while(typeof tree?.type==='function')tree=tree.type(tree.props);return tree;}
  const nodes=(node,type)=>{if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(x=>nodes(x,type));return [...(node.type===type?[node]:[]),...nodes(node.props?.children,type)];};
  async function ready(){render();effectTimers.splice(0).forEach(fn=>fn());await tick();render();}
  function desk(){return nodes(tree,'attendance-desk')[0];}
  function clickCheckIn(){const article=desk().props.renderDetail(desk().props.rows[0]);const button=nodes(article,'button').find(b=>b.props.children==='Record observed check-in');assert.ok(button);button.props.onClick();}
  return {ready,render,desk,clickCheckIn,post,readback,calls,unmount:()=>slots.forEach(slot=>slot?.cleanup?.())};
}

for(const source of ['EVENT','SITE_SHIFT']) {
  test(`${source}: selected desk remains mounted and disabled throughout actual write readback`,async()=>{
    const f=fixture(source);await f.ready();assert.equal(f.desk().props.rows.length,1);f.clickCheckIn();await tick();
    f.post.resolve({ok:true,json:async()=>({result:{recorded:true}})});await tick();f.render();
    assert.ok(f.desk(),'The selected desk was unmounted during source readback');
    assert.equal(f.desk().props.loading,true);assert.equal(f.desk().props.busy,true);
    const next=structuredClone(row);next.attendance.revision=1;next.attendance.check_in_at='2026-10-18T16:05:00Z';
    f.readback.resolve(response([next]));await tick();f.render();assert.equal(f.desk().props.rows[0].attendance.revision,1);assert.equal(f.desk().props.busy,false);
    assert.equal(f.calls.filter(c=>c.method==='POST'||c.method==='PATCH').length,1);
  });
  test(`${source}: denied readback clears current facts instead of restoring cached attendance`,async()=>{
    const f=fixture(source);await f.ready();f.clickCheckIn();await tick();f.post.resolve({ok:true,json:async()=>({})});await tick();
    f.readback.resolve(response([],false));await tick();f.render();assert.ok(!f.desk()||f.desk().props.rows.length===0,'Inaccessible cached facts remained available');
  });
}

for(const source of ['EVENT','SITE_SHIFT'])test(`${source}: held write resolving after unmount starts no old source read or new write`,async()=>{const f=fixture(source);await f.ready();f.clickCheckIn();await tick();f.unmount();f.post.resolve({ok:true,json:async()=>({})});await tick();assert.equal(f.calls.length,2);});
