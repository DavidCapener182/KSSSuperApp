// Isolated presentation fixture. This never changes or bypasses product authentication.
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,symlink,writeFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const baseline='baff9dc1285cc06778dd2346d90424089c1d5ed3';
const before=process.argv.includes('--baseline');
const port=Number(process.env.KSS_PREVIEW_PORT||3108);
const runtime=await mkdtemp(join(tmpdir(),'kss-redesign-fixture-'));
const output=process.env.KSS_PREVIEW_OUTPUT||join(root,'output/redesign-20261017-v3');
const mocked=new Set(['src/lib/auth/principal.ts','src/lib/supabase/browser.ts','src/lib/supabase/server.ts','src/lib/tasks/policy.ts']);
const manifest=[],seen=new Set();
async function save(file,value){await mkdir(dirname(join(runtime,file)),{recursive:true});await writeFile(join(runtime,file),value);}
async function source(file){return before?execFileSync('git',['show',`${baseline}:${file}`],{cwd:root}):readFile(join(root,file));}
async function copy(file){
 if(seen.has(file)||mocked.has(file))return;seen.add(file);
 const bytes=await source(file);await save(file,bytes);manifest.push({file,sha256:createHash('sha256').update(bytes).digest('hex')});
 if(!/\.[jt]sx?$/.test(file))return;
 for(const match of bytes.toString().matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)){
  const spec=match[1];if(!spec.startsWith('@/')&&!spec.startsWith('.'))continue;
  const path=spec.startsWith('@/')?'src/'+spec.slice(2):join(dirname(file),spec);
  for(const candidate of extname(path)?[path]:[path+'.tsx',path+'.ts',path+'/index.tsx',path+'/index.ts']){
   try{await access(join(root,candidate));await copy(candidate);break;}catch(error){if(error.code!=='ENOENT')throw error;}
  }
 }
}
for(const file of ['src/app/(enterprise)/app/page.tsx','src/components/enterprise-shell.tsx','src/components/work-client.tsx','src/components/crm-client.tsx','src/components/my-schedule-client.tsx','src/components/my-duty-client.tsx','src/components/sign-in-entry.tsx','src/app/globals.css','postcss.config.mjs'])await copy(file);
await symlink(join(root,'node_modules'),join(runtime,'node_modules'),'dir');
await save('package.json',JSON.stringify({private:true,name:'kss-redesign-synthetic-preview'}));
await save('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',lib:['dom','esnext'],jsx:'react-jsx',module:'esnext',moduleResolution:'bundler',esModuleInterop:true,skipLibCheck:true,paths:{'@/*':['./src/*']}}}));
await save('next.config.mjs','export default {devIndicators:false};');
await save('src/lib/auth/principal.ts',`import {cookies} from 'next/headers';export async function getPrincipal(){const c=await cookies();return {personId:c.get('fixtureAccount')?.value||'00000000-0000-4000-8000-000000000001',displayName:'Synthetic Home Reviewer',roles:[c.get('fixtureRole')?.value||'OFFICE_ADMIN'],incidentReviewer:false}}`);
await save('src/lib/supabase/server.ts',`export const createServerSupabase=async()=>({rpc:async()=>({data:{}})});`);
await save('src/lib/supabase/browser.ts',`export const createBrowserSupabase=()=>({auth:{getUser:async()=>({data:{user:null},error:null}),signInWithPassword:async()=>({error:{message:'Synthetic failure'}}),signOut:async()=>({error:null})}});`);
await save('src/lib/tasks/policy.ts',`export const listTasks=async()=>[{id:'synthetic-task-1',state:'OPEN',sourceKind:'CRM_ORGANISATION',sourceTitle:'Demo client',title:'Confirm site visit arrangements',dueAt:'2026-10-16',createdAt:'2026-10-15',sourceHref:'/work/synthetic-task-1'},{id:'synthetic-task-2',state:'OPEN',sourceKind:'DOCUMENT_VERSION',title:'Review operational instructions',createdAt:'2026-10-15',sourceHref:'/documents/synthetic-version'}];`);
await save('src/app/layout.tsx',`import './globals.css';export default function Layout({children}){return <html lang="en"><body>{children}</body></html>}`);
await save('src/app/(enterprise)/layout.tsx',`import {EnterpriseShell} from '@/components/enterprise-shell';import {getPrincipal} from '@/lib/auth/principal';import {navigationFor} from '@/lib/auth/capabilities';export default async function Layout({children}){const p=await getPrincipal();return <EnterpriseShell person={{id:p.personId,name:p.displayName}} roles={p.roles} incidentReviewer={false} navigation={navigationFor(p)}><aside style={{padding:8,background:'#fff1d7',color:'#182334'}}>Local synthetic identity and task/training boundaries · no live authentication</aside>{children}</EnterpriseShell>}`);
await save('src/app/page.tsx',`import {SignInEntry} from '@/components/sign-in-entry';export default function Page(){return <><aside style={{padding:8,background:'#fff1d7'}}>Local synthetic sign-in demonstration. No credentials or live authentication.</aside><SignInEntry returnTarget='/app'/></>}`);
for(const [slug,component,props]of [['work','WorkClient',''],['crm','CrmClient',` view="organisations" currentPersonId="00000000-0000-4000-8000-000000000001"`],['my-schedule','MyScheduleClient',` initialWeek="2026-10-12"`]])await save(`src/app/(enterprise)/${slug}/page.tsx`,`import {${component}} from '@/components/${slug==='crm'?'crm-client':slug==='work'?'work-client':'my-schedule-client'}';export default function Page(){return <${component}${props}/>}`);
await save('src/app/(enterprise)/my-duty/page.tsx',`import Link from 'next/link';import {MyDutyClient} from '@/components/my-duty-client';export default async function Page({searchParams}){const q=await searchParams;const focus=q.allocationId?{id:q.allocationId,source:q.source}:undefined;return <><Link href="/my-duty?allocationId=00000000-0000-4000-8000-000000000002&source=SITE_SHIFT">Synthetic open duty B</Link><MyDutyClient focus={focus}/></>}`);
await save('src/app/api/deployments/me/route.ts',`export async function GET(request){const p=new URL(request.url).searchParams;return Response.json({deployments:{items:[{id:p.get('allocationId'),source:p.get('source')||'EVENT',status:'ALLOCATED',event_status:'CONFIRMED',event_name:'Synthetic review duty',site_name:'Synthetic review venue',role_name:'Security Officer',area_label:'Entrance',reporting_point:'Reception',service_date:'2099-01-01',report_at:'2099-01-01T08:00:00Z',shift_starts_at:'2099-01-01T09:00:00Z',shift_ends_at:'2099-01-01T17:00:00Z',availability_conflict:null}]}})}`);
await save('src/app/api/attendance/me/route.ts',`export async function GET(request){const p=new URL(request.url).searchParams;return Response.json({attendance:{items:[{source:p.get('source'),allocation_id:p.get('allocationId'),attendance:{state:'NONE',check_in_at:null,check_out_at:null}}]}})}`);
await save('src/app/api/me/route.ts',`import {getPrincipal} from '@/lib/auth/principal';export async function GET(){const p=await getPrincipal();return Response.json({person:{id:p.personId,name:p.displayName},roles:p.roles,incidentReviewer:false})}`);
await save('src/app/api/tasks/route.ts',`import {listTasks} from '@/lib/tasks/policy';export async function GET(){return Response.json({tasks:await listTasks()})}`);
await save('src/app/api/crm/route.ts',`export async function GET(){return Response.json({items:[{id:'synthetic-client',name:'Demo Retail Group',relationship:'CLIENT',sector:'Retail',owner_name:'Synthetic Office'},{id:'synthetic-prospect',name:'Demo Events Company',relationship:'PROSPECT',sector:'Events'}],total:2})}`);
await save('src/app/api/people/route.ts',`export async function GET(){return Response.json({people:[]})}`);
await save('src/app/api/my-schedule/route.ts',`export async function GET(request){const week=new URL(request.url).searchParams.get('week')||'2026-10-12';return Response.json({schedule:{week_start:week,work_total:1,work:[{source:'EVENT',id:'synthetic-allocation',status:'ALLOCATED',service_date:week,report_at:week+'T09:00:00Z',shift_starts_at:week+'T09:00:00Z',shift_ends_at:week+'T17:00:00Z',area_label:'Visitor entrance',role_name:'Security Officer',event_name:'Demo autumn event',site_name:'Demo Arena',reporting_point:'Reception',availability:'NOT_DECLARED',availability_conflict:null}],availability:[]}})}`);
await save('src/app/(enterprise)/my-duty/page.tsx',`import {MyDutyClient} from '@/components/my-duty-client';export default function Page(){return <MyDutyClient focus={{id:'synthetic-allocation',source:'EVENT'}}/>}`);
await save('src/app/api/deployments/me/route.ts',`export async function GET(){return Response.json({deployments:{items:[{source:'EVENT',id:'synthetic-allocation',status:'ALLOCATED',event_status:'CONFIRMED',service_date:'2026-10-17',report_at:'2026-10-17T09:00:00Z',shift_starts_at:'2026-10-17T09:00:00Z',shift_ends_at:'2026-10-17T17:00:00Z',event_name:'Demo autumn event',site_name:'Demo Arena',role_name:'Security Officer',area_label:'Visitor entrance',reporting_point:'Reception',availability_conflict:null}]}})}`);
await mkdir(output,{recursive:true});await writeFile(join(output,`source-manifest-${before?'before':'after'}.json`),JSON.stringify({baseline,stage:before?'before':'after',runtime,manifest,mocked:[...mocked,'all API read fixtures'],limitations:['No live authentication/RPC/database acceptance','Only Home/Work/CRM/Schedule/Duty fixture destinations implemented','Synthetic read-only data; no actual product writes']},null,2));
await writeFile(join(output,'runtime.txt'),runtime);
console.log(`Synthetic ${before?'baseline':'redesign'} preview: http://127.0.0.1:${port}/app\nRuntime: ${runtime}`);
const server=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:runtime,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:tmpdir(),NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1'},stdio:'inherit'});
process.on('SIGTERM',()=>server.kill('SIGTERM'));process.on('SIGINT',()=>server.kill('SIGINT'));
const [code]=await once(server,'exit');process.exitCode=code||0;
