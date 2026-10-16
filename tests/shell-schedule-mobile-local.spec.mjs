import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {cp,mkdir,mkdtemp,readFile,symlink,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=join(root,'output/shell-schedule-mobile-20261016');
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.KSS_PLAYWRIGHT_MODULE||'playwright');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const person={id:id(1),name:'Synthetic Staff with a deliberately long name for shell layout'};
const week='2026-10-12';
async function prepare(){
 const runtime=await mkdtemp(join(tmpdir(),'kss-shell-schedule-fixture-'));
 const files=['src/components/enterprise-shell.tsx','src/components/my-schedule-client.tsx','src/components/my-shift-entry.module.css','src/components/ui/button.tsx','src/components/ui/input.tsx','src/components/ui/sheet.tsx','src/lib/events/workforce-week.ts','src/lib/crm/due-time.ts','src/lib/environment-label.ts','src/app/globals.css','postcss.config.mjs'];
 const manifest=[];
 for(const file of files){const target=join(runtime,file);await mkdir(dirname(target),{recursive:true});await cp(join(root,file),target);manifest.push({file,sha256:createHash('sha256').update(await readFile(join(root,file))).digest('hex')});}
 await mkdir(join(runtime,'src/lib/supabase'),{recursive:true});
 await writeFile(join(runtime,'src/lib/supabase/browser.ts'),`// Local-only boundary: no actual Auth client or credentials.\nexport function createBrowserSupabase(){return {auth:{signOut:async()=>({error:null})}};}`);
 await symlink(join(root,'node_modules'),join(runtime,'node_modules'),'dir');
 await writeFile(join(runtime,'package.json'),JSON.stringify({private:true,name:'kss-shell-schedule-local'}));
 await writeFile(join(runtime,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',lib:['dom','esnext'],jsx:'react-jsx',module:'esnext',moduleResolution:'bundler',esModuleInterop:true,skipLibCheck:true,paths:{'@/*':['./src/*']}}}));
 await writeFile(join(runtime,'next.config.mjs'),'export default { devIndicators:false };');
 await writeFile(join(runtime,'src/app/layout.tsx'),`import './globals.css';export default function Layout({children}){return <html lang="en"><body>{children}</body></html>}`);
 await mkdir(join(runtime,'src/app/[[...path]]'),{recursive:true});
 await writeFile(join(runtime,'src/app/[[...path]]/page.tsx'),`import {EnterpriseShell} from '@/components/enterprise-shell';import {MyScheduleClient} from '@/components/my-schedule-client';
const navigation=[{href:'/app',label:'Home'},{href:'/my-duty',label:'Today’s Duty'},{href:'/my-schedule',label:'My Schedule'},{href:'/my-deployments',label:'My Deployments'},{href:'/my-availability',label:'My Availability'},{href:'/profile',label:'Profile'}];
export default async function Page({params}){const p=await params;if(!(p.path||[]).length)return <main><h1>Local synthetic sign-in destination</h1></main>;return <EnterpriseShell person={${JSON.stringify(person)}} roles={['SECURITY_STAFF']} incidentReviewer={false} navigation={navigation}><aside style={{padding:'8px',background:'#fff1d7',color:'#182334'}}>Local simulated identity and schedule · no authentication</aside><MyScheduleClient initialWeek="${week}"/></EnterpriseShell>;}`);
 await mkdir(output,{recursive:true});await writeFile(join(output,'source-manifest.json'),JSON.stringify({baseline:'13cce15060f0c561e43e71cfcf9aeecc7094ba16',runtime,manifest},null,2));
 return runtime;
}
function rows(selectedWeek){return ['EVENT','SITE_SHIFT'].map((source,i)=>({source,id:id(i+10),status:i?'ACCEPTED':'ALLOCATED',service_date:selectedWeek,report_at:`${selectedWeek}T09:00:00Z`,shift_starts_at:`${selectedWeek}T09:00:00Z`,shift_ends_at:`${selectedWeek}T17:00:00Z`,area_label:'Synthetic long duty area and visitor entrance',role_name:'Synthetic Security Officer',event_name:`Synthetic ${source} work`,site_name:'Synthetic Site',reporting_point:'Synthetic reception with an instruction that must wrap',availability:'NOT_DECLARED',availability_conflict:null}));}
async function mock(page){const state={mode:'normal',calls:[],external:[]};await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1'){state.external.push(url.origin);return route.abort();}if(!url.pathname.startsWith('/api/'))return route.continue();state.calls.push({path:url.pathname,query:url.search});const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 if(url.pathname==='/api/me')return send(state.mode==='unauthorised'?{error:'Unauthorised'}:{person,roles:['SECURITY_STAFF'],incidentReviewer:false},state.mode==='unauthorised'?401:200);
 if(url.pathname==='/api/my-schedule'){if(state.mode==='error')return send({error:'Synthetic schedule unavailable'},503);const selectedWeek=url.searchParams.get('week');return send({schedule:{week_start:selectedWeek,work_total:2,work:rows(selectedWeek),availability:[]}});}return send({error:'Unimplemented fixture'},500);});return state;}
async function capture(page,name,results){const layout=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));results.push({name,...layout});await page.screenshot({path:join(output,name+'.png'),fullPage:true});assert.equal(layout.scrollWidth,layout.viewport,name+' has page overflow');}

test('real EnterpriseShell and MySchedule synthetic browser journeys',{timeout:180000},async t=>{
 const runtime=await prepare(),socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));const base=`http://127.0.0.1:${port}`;
 const log=[],results=[];let browser;
 const server=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:runtime,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:tmpdir(),NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>log.push(data.toString()));server.stderr.on('data',data=>log.push(data.toString()));
 try{let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error(log.join(''));try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}assert.ok(ready,'Local fixture server failed');browser=await chromium.launch({headless:true});
 for(const width of [390,1280])await t.test(`real shell, own schedule navigation and denial at ${width}px`,async()=>{
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',error=>errors.push(error.message));const state=await mock(page);
  await page.goto(base+'/my-schedule');await page.getByRole('heading',{name:'Synthetic EVENT work'}).waitFor();
  const schedule=page.getByRole('main');assert.equal(await schedule.locator('.my-schedule-day:visible').count(),width===390?1:7);
  assert.equal(await schedule.getByLabel('Go to date').inputValue(),week);
  const offer=page.getByRole('link',{name:'View and respond to allocation'});assert.equal(await offer.getAttribute('href'),`/my-deployments?allocationId=${id(10)}&source=EVENT&returnWeek=${week}`);
  assert.equal(await page.getByRole('link',{name:'Open attendance',exact:true}).getAttribute('href'),`/my-attendance?source=SITE_SHIFT&allocationId=${id(11)}`);
  assert.equal(await page.getByRole('link',{name:'Open worked time',exact:true}).count(),0,'Site Shift must not offer Event worked time');
  await capture(page,`shell-schedule-${width}-initial`,results);
  await page.getByRole('link',{name:'Skip to content'}).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'enterprise-content');
  if(width===390){const picker=page.getByRole('navigation',{name:'Choose schedule day'}),tuesday=picker.getByRole('button',{name:'Tuesday 13 October'});await tuesday.focus();await page.keyboard.press('Enter');assert.equal(await tuesday.getAttribute('aria-current'),'date');assert.equal(await schedule.getByRole('heading',{name:'Monday 12 October'}).isVisible(),false);assert.equal(await schedule.getByRole('heading',{name:'Tuesday 13 October'}).isVisible(),true);
   const trigger=page.getByRole('button',{name:'Open navigation',exact:true});await trigger.focus();await page.keyboard.press('Enter');const dialog=page.getByRole('dialog');await dialog.waitFor();for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>Boolean(document.activeElement?.closest('[role="dialog"]'))),true);}await capture(page,`shell-schedule-${width}-drawer`,results);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  }else{const button=page.getByRole('button',{name:'Collapse navigation',exact:true});await button.click();assert.equal(await page.getByRole('button',{name:'Expand navigation',exact:true}).getAttribute('aria-expanded'),'false');await page.reload();await page.getByRole('button',{name:'Expand navigation',exact:true}).waitFor();await page.getByRole('button',{name:'Expand navigation',exact:true}).click();}
  await schedule.getByLabel('Go to date').fill('2026-10-16');assert.equal(await schedule.getByLabel('Go to date').inputValue(),'2026-10-16');
  await schedule.getByRole('button',{name:'Next week',exact:true}).click();await page.getByRole('heading',{name:'Synthetic EVENT work'}).waitFor();assert.equal(await schedule.getByLabel('Go to date').inputValue(),'2026-10-19');assert.ok(state.calls.some(call=>call.query.includes('week=2026-10-19')));assert.match(await page.getByRole('link',{name:'View and respond to allocation'}).getAttribute('href'),/returnWeek=2026-10-19$/);
  await capture(page,`shell-schedule-${width}-next-week`,results);
  state.mode='error';await schedule.getByRole('button',{name:'Previous week',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic schedule unavailable'}).waitFor();assert.equal(await schedule.getByRole('heading',{name:'Synthetic EVENT work'}).count(),0);await capture(page,`shell-schedule-${width}-error`,results);
  state.mode='normal';await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('heading',{name:'Synthetic EVENT work'}).waitFor();
  state.mode='unauthorised';await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForURL(base+'/?next=%2Fmy-schedule');await page.getByRole('heading',{name:'Local synthetic sign-in destination'}).waitFor();assert.equal(await page.getByRole('heading',{name:'My Schedule',exact:true}).count(),0);
  assert.deepEqual(state.external,[]);assert.deepEqual(errors,[]);await context.close();
 });
 }finally{await browser?.close();server.kill('SIGTERM');if(server.exitCode===null)await once(server,'exit');await writeFile(join(output,'layout-results.json'),JSON.stringify(results,null,2));await writeFile(join(output,'fixture-server.log'),log.join(''));}
});
