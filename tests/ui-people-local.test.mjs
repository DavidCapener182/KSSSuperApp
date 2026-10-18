import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {test} from 'node:test';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{renderToStaticMarkup:render}=require('react-dom/server');
const root='src/app/(enterprise)/people/',baseline='tests/fixtures/ui-people-baseline/';
const person={id:'00000000-0000-4000-8000-000000000101',displayName:'Synthetic Person',roles:['SECURITY_STAFF'],sites:['Synthetic permitted Site'],onboardingState:'NONE',completed:null,totalRequirements:null,onboardingCaseId:null};
const principal={personId:'00000000-0000-4000-8000-000000000001',roles:['OFFICE_ADMIN']};
function query(table){const q={then:resolve=>Promise.resolve(resolve({data:table==='person_work_positions'?[{person_id:person.id,position_name:'Door Supervisor'}]:[],error:null}))};for(const k of ['select','eq','in','order'])q[k]=()=>q;return q;}
async function load(file,{reads=[],identity=principal,allowed=true,detail}={}){
 const calls=[],client={from:query,rpc:async()=>({data:null})};
 const stubs={react:React,'react/jsx-runtime':require('react/jsx-runtime'),'next/link':{default:({children,...props})=>React.createElement('a',props,children)},'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');},redirect:path=>{throw Error('REDIRECT:'+path);}},'@/lib/auth/principal':{getPrincipal:async()=>identity,isUuid:x=>/^[a-f0-9-]{36}$/.test(x)},'@/lib/auth/capabilities':{hasCapability:()=>allowed},'@/lib/supabase/server':{createServerSupabase:async()=>client},'@/lib/people/directory':{parseDirectoryFilters:p=>({search:p.get('search')||'',role:p.get('role')||'',offset:Number(p.get('offset')||0),limit:Number(p.get('limit')||25)}),readDirectory:async(...args)=>{calls.push(args);return reads.shift()??null;}},'@/lib/people/record':{readStaffRecordSections:async()=>detail},'@/lib/profile/policy':{requiredProfileMatches:()=>true,SIA_LABELS:{}},'@/lib/credentials/state':{credentialState:()=> 'DRAFT'},'./people-live-search':{PeopleLiveSearch:({initialValue})=>React.createElement('input',{name:'search',defaultValue:initialValue})}};
 const source=await readFile(root+file,'utf8'),code=ts.transpileModule(source+'\nexport { StaffRecordBody };'.replace('export { StaffRecordBody };',file.startsWith('[id]')?'export { StaffRecordBody };':''),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const loaded={exports:{}};new Function('require','module','exports',code)(name=>name.endsWith('.module.css')?{default:new Proxy({},{get:(_,k)=>String(k)})}:stubs[name]??(()=>{throw Error('Unexpected import '+name);})(),loaded,loaded.exports);return {...loaded.exports,calls,client};
}
test('register keeps ongoing pagination and capped drafts separate, with independent counts',async()=>{
 const m=await load('page.tsx',{reads:[{total:80,items:[{...person,onboardingState:'IN_PROGRESS'}]},{total:60,items:[{...person,id:person.id+'d',onboardingState:'DRAFT'}]}]});const html=render(await m.default({searchParams:Promise.resolve({view:'onboarding',search:'Synthetic',role:'SECURITY_STAFF',offset:'25'})}));
 assert.match(html,/Ongoing onboarding cases/);assert.match(html,/80 people matching this list/);assert.match(html,/1 returned of 60 matching drafts/);assert.doesNotMatch(html,/140 people/);assert.equal(m.calls[0][2].onboarding,'IN_PROGRESS');assert.equal(m.calls[0][2].offset,25);assert.equal(m.calls[1][2].onboarding,'DRAFT');assert.equal(m.calls[1][2].offset,0);assert.equal(m.calls[1][2].limit,50);assert.match(html,/offset=50/);assert.match(html,/search=Synthetic/);assert.match(html,/PARiM positions/);assert.match(html,/KSS access role/);
});
test('draft source unavailable is independent from a factual ongoing list',async()=>{
 const m=await load('page.tsx',{reads:[{total:1,items:[person]},null]});const html=render(await m.default({searchParams:Promise.resolve({view:'onboarding'})}));assert.match(html,/Synthetic Person/);assert.match(html,/Draft list unavailable/);assert.match(html,/Drafts could not be loaded/);assert.doesNotMatch(html,/0 matching drafts/);
});
test('existing view does not query or fabricate onboarding draft totals',async()=>{
 const m=await load('page.tsx',{reads:[{total:0,items:[]}]});const html=render(await m.default({searchParams:Promise.resolve({view:'existing'})}));assert.equal(m.calls.length,1);assert.equal(m.calls[0][2].onboarding,'NONE');assert.match(html,/No matching people/);assert.doesNotMatch(html,/Onboarding drafts/);
});
test('directory unavailable and capability denied do not render records',async()=>{
 const m=await load('page.tsx');assert.match(render(await m.default({searchParams:Promise.resolve({})})),/directory is temporarily unavailable/);const denied=await load('page.tsx',{allowed:false});await assert.rejects(denied.default({searchParams:Promise.resolve({})}),/NOT_FOUND/);assert.equal(denied.calls.length,0);
});
const restricted={cases:[],profile:null,submittedProfile:null,documents:null,sites:null,canReadPrivate:false,importedExistingStaff:false};
test('actual person sections retain restricted personal/evidence states and honest provider/activity gaps',async()=>{
 const m=await load('[id]/page.tsx',{detail:restricted});const html=render(await m.StaffRecordBody({client:m.client,principal:{...principal,roles:['OPERATIONS']},person}));assert.match(html,/Personal details restricted/);assert.match(html,/Documents restricted/);assert.match(html,/provider not connected/);assert.match(html,/Activity timeline not yet available/);assert.doesNotMatch(html,/contact_email|example\.invalid/);assert.match(html,/id="credentials"/);assert.match(html,/Historical onboarding evidence/);
});
test('imported existing staff stay distinct from new starters; private facts stay in their authorised section',async()=>{
 const m=await load('[id]/page.tsx',{detail:{...restricted,canReadPrivate:true,importedExistingStaff:true,profile:{contact_email:'synthetic@example.invalid'},documents:[],sites:[]}});const html=render(await m.StaffRecordBody({client:m.client,principal,person}));assert.match(html,/Existing working staff\. No starter case is required/);assert.match(html,/synthetic@example.invalid/);assert.doesNotMatch(html.split('id="personal-details"')[0],/synthetic@example.invalid/);
});
test('source readers, APIs and live search remain byte-identical to the pre-edit baseline',async()=>{
 for(const file of ['src/lib/people/directory.ts','src/lib/people/record.ts','src/app/api/people/route.ts','src/app/api/people/directory/[id]/route.ts','src/app/api/people/[id]/route.ts',root+'people-live-search.tsx'])assert.deepEqual(await readFile(file),await readFile(baseline+file),file);
});
test('directory server read/role/positions logic and person section reads remain unchanged',async()=>{
 const before=await readFile(baseline+root+'page.tsx','utf8'),after=await readFile(root+'page.tsx','utf8');assert.equal(after.split('  const renderRegister')[0],before.split('  const displayed')[0]);const rb=await readFile(baseline+root+'[id]/page.tsx','utf8'),ra=await readFile(root+'[id]/page.tsx','utf8');assert.equal(ra.split('  return <div className="people-record-grid">')[0],rb.split('  return <div className="people-record-grid">')[0]);
});
