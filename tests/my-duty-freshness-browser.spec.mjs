import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.KSS_PLAYWRIGHT_MODULE || '/Users/davidcapener/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = 'http://127.0.0.1:3108';
const output = new URL('../output/duty-freshness-20261017/', import.meta.url);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const duty = (n,status='ALLOCATED') => ({ id:id(n),source:n===1?'EVENT':'SITE_SHIFT',status,event_status:'CONFIRMED',event_name:`Synthetic duty ${n}`,site_name:'Synthetic review venue',role_name:'Security Officer',area_label:'Entrance',reporting_point:'Reception',service_date:'2099-01-01',report_at:'2099-01-01T08:00:00Z',shift_starts_at:'2099-01-01T09:00:00Z',shift_ends_at:'2099-01-01T17:00:00Z',availability_conflict:null });
const deferred = () => { let resolve; const promise = new Promise(r=>{resolve=r;}); return {promise,resolve}; };
const browser = await chromium.launch({headless:true,executablePath:process.env.KSS_CHROMIUM_PATH || '/Users/davidcapener/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
await mkdir(output,{recursive:true});
const results=[];
async function run(name,width,scenario) {
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await context.addCookies([{name:'fixtureRole',value:'SECURITY_STAFF',url:base}]);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try { await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname!=='127.0.0.1')return route.abort();
    if(u.pathname==='/api/my-schedule')return route.fulfill({json:{schedule:{work:[duty(1),duty(2)],work_total:2}}});
    if(u.pathname==='/api/deployments/me'||u.pathname==='/api/attendance/me')return scenario.api(route,u);
    return route.continue();
  });
  await scenario.check(page);
  const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert.equal(layout.width,layout.scrollWidth,'page overflow');assert.deepEqual(errors,[]);
  await page.screenshot({path:new URL(`${name}-${width}.png`,output).pathname,fullPage:true});
  results.push({name,...layout,status:'passed'});
  } finally { await context.close(); }
}
try {
for(const width of [1440,390]) {
  const held=deferred(),seen=deferred();
  await run('late-allocation',width,{
    api:async(route,u)=>{const n=u.searchParams.get('allocationId')===id(1)?1:2;if(n===1){seen.resolve();await held.promise;}return route.fulfill({json:{deployments:{items:[duty(n)]}}});},
    check:async p=>{await p.goto(`${base}/my-duty?allocationId=${id(1)}&source=EVENT`);await seen.promise;await p.getByLabel('Choose duty').selectOption(`SITE_SHIFT:${id(2)}`);await p.getByRole('heading',{name:'Synthetic duty 2',exact:true}).waitFor();held.resolve();await p.waitForResponse(r=>r.url().includes('/api/deployments/me?')&&r.url().includes(id(1)));await p.waitForTimeout(100);assert.equal(await p.getByRole('heading',{name:'Synthetic duty 2',exact:true}).count(),1);assert.equal(await p.getByRole('heading',{name:'Synthetic duty 1',exact:true}).count(),0);}
  });
  const attendance=deferred(),attendanceSeen=deferred();
  await run('late-attendance',width,{
    api:async(route,u)=>{const n=u.searchParams.get('allocationId')===id(1)?1:2;if(u.pathname==='/api/deployments/me')return route.fulfill({json:{deployments:{items:[duty(n,'ACCEPTED')]}}});if(n===1){attendanceSeen.resolve();await attendance.promise;}return route.fulfill({json:{attendance:{items:[{source:n===1?'EVENT':'SITE_SHIFT',allocation_id:id(n),attendance:{state:n===1?'IN':'NONE',check_in_at:n===1?'2099-01-01T09:00:00Z':null,check_out_at:null}}]}}});},
    check:async p=>{await p.goto(`${base}/my-duty?allocationId=${id(1)}&source=EVENT`);await attendanceSeen.promise;await p.getByLabel('Choose duty').selectOption(`SITE_SHIFT:${id(2)}`);await p.getByRole('heading',{name:'Synthetic duty 2',exact:true}).waitFor();const response=p.waitForResponse(r=>r.url().includes('/api/attendance/me?')&&r.url().includes(id(1)));attendance.resolve();await response;await p.waitForTimeout(100);assert.equal(await p.getByRole('heading',{name:'Synthetic duty 2',exact:true}).count(),1);assert.equal(await p.getByText('On duty',{exact:true}).count(),0);await p.getByLabel('Choose duty').selectOption('');assert.equal(await p.getByRole('heading',{name:'Synthetic duty 2',exact:true}).count(),0);}
  });
  await run('exact-link-focus',width,{
    api:async(route,u)=>route.fulfill({json:{deployments:{items:[duty(u.searchParams.get('allocationId')===id(1)?1:2)]}}}),
    check:async p=>{await p.goto(`${base}/my-duty?allocationId=${id(1)}&source=EVENT`);await p.getByRole('heading',{name:'Synthetic duty 1',exact:true}).waitFor();await p.getByRole('link',{name:'Synthetic open duty B',exact:true}).click();await p.getByRole('heading',{name:'Synthetic duty 2',exact:true}).waitFor();assert.equal(await p.getByLabel('Choose duty').inputValue(),`SITE_SHIFT:${id(2)}`);}
  });
}
await writeFile(new URL('browser-results.json',output),JSON.stringify({results,boundary:'Actual MyDutyClient and CSS; synthetic role/read API fixtures, no hosted authentication or writes'},null,2));
console.log('PASS',JSON.stringify(results));
} finally {await browser.close();}
