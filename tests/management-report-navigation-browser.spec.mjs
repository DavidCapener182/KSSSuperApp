import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'output/report-context-20261016');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.KSS_PLAYWRIGHT_MODULE || 'playwright');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const person = { id: id(100), name: 'Synthetic Office Reviewer' }, roles = ['OFFICE_ADMIN'];
async function prepare() {
  const runtime = await mkdtemp(join(tmpdir(), 'kss-report-context-fixture-'));
  const files = ['src/components/management-reports-client.tsx', 'src/components/management-reports.module.css',
    'src/components/enterprise-shell.tsx', 'src/components/ui/button.tsx', 'src/components/ui/sheet.tsx',
    'src/components/ui13/operational.tsx', 'src/components/ui13/operational.module.css',
    'src/lib/reports/navigation.ts', 'src/lib/events/workforce-week.ts', 'src/lib/events/workforce-navigation.ts',
    'src/lib/environment-label.ts', 'src/lib/auth/capabilities.ts', 'src/lib/auth/return-target.ts',
    'src/app/(enterprise)/management-reports/page.tsx', 'src/app/(enterprise)/events/[id]/page.tsx',
    'src/app/(enterprise)/sites/[siteId]/services/[serviceId]/page.tsx', 'src/app/globals.css', 'postcss.config.mjs'];
  const manifest = [];
  for (const file of files) {
    await mkdir(dirname(join(runtime, file)), { recursive: true }); await cp(join(root, file), join(runtime, file));
    manifest.push({ file, sha256: createHash('sha256').update(await readFile(join(root, file))).digest('hex') });
  }
  const save = async (file, text) => { await mkdir(dirname(join(runtime, file)), { recursive: true }); await writeFile(join(runtime, file), text); };
  await symlink(join(root, 'node_modules'), join(runtime, 'node_modules'), 'dir');
  await save('package.json', JSON.stringify({ private: true, name: 'kss-report-context-fixture' }));
  await save('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['dom', 'esnext'], jsx: 'react-jsx', module: 'esnext', moduleResolution: 'bundler', esModuleInterop: true, paths: { '@/*': ['./src/*'] } } }));
  await save('next.config.mjs', 'export default { devIndicators:false };');
  await save('src/lib/supabase/browser.ts', 'export const createBrowserSupabase=()=>({auth:{signOut:async()=>({error:null})}});');
  await save('src/lib/supabase/server.ts', 'export const createServerSupabase=async()=>({});');
  await save('src/lib/auth/principal.ts', `export const getPrincipal=async()=>({personId:'${person.id}',displayName:'${person.name}',roles:['OFFICE_ADMIN'],incidentReviewer:false});export const isUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);`);
  const sourceStub = `'use client';import {useEffect,useState} from 'react';export function Source({id,exact}){const[state,setState]=useState('Loading synthetic source');useEffect(()=>{fetch('/api/fixture-source?id='+id).then(r=>setState(r.ok?'Synthetic source available':'Synthetic source denied; no source detail returned'));},[id]);return <main className="enterprise-main" data-exact-source={exact}><h1>Local source boundary</h1><p role="status">{state}</p></main>}`;
  await save('src/components/fixture-source.tsx', sourceStub);
  await save('src/components/events-client.tsx', `import {Source} from './fixture-source';export function EventsClient({id,focusRequirement}){return <Source id={id} exact={focusRequirement}/>}`);
  await save('src/components/site-service-detail-client.tsx', `import {Source} from './fixture-source';export function SiteServiceDetailClient({serviceId,initialDemandId}){return <Source id={serviceId} exact={initialDemandId}/>}`);
  await save('src/app/layout.tsx', `import './globals.css';export default function Layout({children}){return <html lang="en"><body><aside style={{padding:8,background:'#fff1d7'}}>Local synthetic identities and report/source APIs · no live authentication</aside>{children}</body></html>}`);
  await save('src/app/page.tsx', 'export default function Page(){return <h1>Local fixture ready</h1>}');
  await save('src/app/(enterprise)/layout.tsx', `import {EnterpriseShell} from '@/components/enterprise-shell';import {navigationFor} from '@/lib/auth/capabilities';const person=${JSON.stringify(person)},roles=['OFFICE_ADMIN'];export default function Layout({children}){return <EnterpriseShell person={person} roles={roles} incidentReviewer={false} navigation={navigationFor({roles,incidentReviewer:false})}>{children}</EnterpriseShell>}`);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'source-manifest.json'), JSON.stringify({ baseline: '13cce15060f0c561e43e71cfcf9aeecc7094ba16', runtime, manifest,
    mocked: ['server/browser Supabase clients', 'principal lookup', 'source detail clients', 'report and source API responses'] }, null, 2));
  return runtime;
}
async function freePort() { const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
function report(query, label = '') {
  const source = query.get('source');
  const all = Array.from({ length: 31 }, (_, index) => ({ source: index % 2 ? 'SITE_SHIFT' : 'EVENT', source_id: id(200 + index), parent_id: id(index % 2 ? 3 : 2), service_id: index % 2 ? id(3) : null,
    client_id: id(10), site_id: id(1), client_name: 'Synthetic Client', site_name: 'Synthetic Site', parent_name: `${label || 'Synthetic'} ${index % 2 ? 'Site Service' : 'Event'}`,
    service_date: '2026-10-16', source_state: 'PLANNED', required: 1, allocated: 1, accepted: 1, remaining: 0,
    unavailable_conflicts: 0, removed_coverage_conflicts: 0, missing_declarations: 1, partial_coverage: 0, definition_version: 1 })).filter(row => !source || row.source === source);
  return { mode: query.get('mode'), period_start: query.get('start') || '2026-10-10', period_end: query.get('end') || '2026-10-17', data_as_of: '2026-10-16T12:00:00Z', definitions: { REQUIRED: 1 },
    ...(query.get('mode') === 'HISTORICAL' ? { status: 'Historical snapshot unavailable', reason: 'Historical source facts are unavailable.' } : {}),
    totals: { required: all.length, allocated: all.length, accepted: all.length, remaining: 0, missing_declarations: all.length },
    total_lines: all.length, lines: all.slice(Number(query.get('offset')), Number(query.get('offset')) + 30), breakdowns: [],
    filters: { clients: [{ id: id(10), name: 'Synthetic Client' }], sites: [{ id: id(1), name: 'Synthetic Site' }], services: [{ id: id(3), name: 'Synthetic Site Service' }], events: [{ id: id(2), name: 'Synthetic Event' }] } };
}
async function fixtures(page) {
  const state = { calls: [], denied: false, error: false, delayEvent: false, delayed: [] };
  // Deliberately ignore fetch abort for report reads, proving the production
  // signal/sequence checks also reject late bodies from a non-cooperative fetch.
  await page.addInitScript(() => { const original = window.fetch; window.fetch = (input, init) => original(input, String(input).startsWith('/api/management-reports') ? { ...init, signal: undefined } : init); });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/api/me') return send({ person, roles, incidentReviewer: false });
    if (url.pathname === '/api/fixture-source') return send(state.denied ? { error: 'Synthetic source denied' } : {}, state.denied ? 403 : 200);
    if (url.pathname === '/api/management-reports') {
      state.calls.push(url.search);
      if (state.error) return send({ error: 'Synthetic denied report' }, 403);
      const stale = state.delayEvent && url.searchParams.get('source') === 'EVENT';
      if (stale) { const pending = new Promise(resolve => setTimeout(resolve, 400)); state.delayed.push(pending); await pending; }
      return send({ report: report(url.searchParams, stale ? 'STALE' : '') });
    }
    return send({ error: 'Unknown fixture endpoint' }, 500);
  });
  return state;
}
async function capture(page, name, results) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth }));
  assert.equal(size.pageWidth, size.viewport); results.push({ name, ...size });
  await page.screenshot({ path: join(output, `${name}.png`) });
}

test('report URL context and safe source return in genuine shell viewports', { timeout: 240000 }, async t => {
  const runtime = await prepare(), port = await freePort(), base = `http://127.0.0.1:${port}`, log = [], results = [];
  let browser;
  const server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: runtime,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', value => log.push(value.toString())); server.stderr.on('data', value => log.push(value.toString()));
  try {
    let ready = false;
    for (let n = 0; n < 150; n++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* local server startup */ } if (server.exitCode !== null) break; await new Promise(resolve => setTimeout(resolve, 200)); }
    assert.ok(ready, log.join('').slice(-2000)); browser = await chromium.launch({ headless: true });
    for (const width of [390, 1280]) await t.test(`${width}px URL reload/back/forward, exact source return, invalid/denied and stale responses`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage(); page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', error => errors.push(error.message));
      const state = await fixtures(page);
      const query = `preset=custom&mode=CURRENT&start=2026-10-01&end=2026-10-16&client=${id(10)}&site=${id(1)}&offset=0&measure=REQUIRED`;
      await page.goto(`${base}/management-reports?${query}`);
      await page.getByRole('heading', { name: 'Contributing source lines', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Through', { exact: true }).inputValue(), '2026-10-16');
      assert.equal(new URLSearchParams(state.calls.at(-1)).get('end'), '2026-10-17');
      await capture(page, `report-${width}-context`, results);
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.waitForURL(/offset=30/); await page.getByText('31 lines; page 2.', { exact: false }).waitFor();
      await page.reload(); await page.getByText('31 lines; page 2.', { exact: false }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('measure'), 'REQUIRED');
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      await page.waitForURL(/offset=0/); await page.getByRole('heading', { name: 'Contributing source lines', exact: true }).waitFor();
      await page.getByRole('link', { name: 'Inspect remaining lines', exact: true }).click();
      await page.waitForURL(/measure=REMAINING/);
      assert.equal(await page.locator('#lines-heading').evaluate(el => el === document.activeElement), true);
      await page.getByRole('combobox', { name: /^Report mode/ }).selectOption('HISTORICAL');
      await page.waitForURL(/mode=HISTORICAL/); await page.getByText('Historical snapshot unavailable', { exact: true }).waitFor();
      await page.goBack(); await page.waitForURL(/mode=CURRENT/); await page.getByRole('heading', { name: 'Contributing source lines', exact: true }).waitFor();
      await page.goForward(); await page.waitForURL(/mode=HISTORICAL/); await page.getByText('Historical snapshot unavailable', { exact: true }).waitFor();
      await page.getByRole('combobox', { name: /^Report mode/ }).selectOption('CURRENT');
      await page.getByRole('heading', { name: 'Contributing source lines', exact: true }).waitFor();
      for (const source of ['EVENT', 'SITE_SHIFT']) {
        const link = page.locator(`a[href^="${source === 'EVENT' ? '/events/' : '/sites/'}"]`).filter({ hasText: 'Open source record' }).filter({ visible: true }).first();
        const target = new URL(await link.getAttribute('href'), base), saved = target.searchParams.get('reportReturn');
        assert.equal(target.searchParams.get(source === 'EVENT' ? 'requirement' : 'demand'), id(source === 'EVENT' ? 200 : 201));
        state.denied = source === 'SITE_SHIFT'; await link.focus(); await page.keyboard.press('Enter');
        await page.getByRole('heading', { name: 'Local source boundary', exact: true }).waitFor();
        assert.equal(await page.locator('[data-exact-source]').getAttribute('data-exact-source'), target.searchParams.get(source === 'EVENT' ? 'requirement' : 'demand'));
        await page.getByRole('status').filter({ hasText: state.denied ? 'Synthetic source denied' : 'Synthetic source available' }).waitFor();
        const back = page.getByRole('link', { name: '← Return to Management Reports', exact: true });
        assert.equal(await back.getAttribute('href'), saved);
        await capture(page, `source-${source}-${width}`, results); await back.click();
        await page.getByRole('heading', { name: 'Contributing source lines', exact: true }).waitFor();
        assert.equal(new URL(page.url()).search, new URL(saved, base).search);
      }
      const filters = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^Filters/ }) });
      await filters.locator('summary').click(); state.delayEvent = true;
      const staleResponse = page.waitForResponse(response => response.url().includes('/api/management-reports?') && new URL(response.url()).searchParams.get('source') === 'EVENT');
      const eventRequest = page.waitForRequest(request => request.url().includes('/api/management-reports?') && new URL(request.url()).searchParams.get('source') === 'EVENT');
      await page.getByRole('combobox', { name: /^Source/ }).selectOption('EVENT'); await eventRequest;
      await page.getByRole('combobox', { name: /^Source/ }).selectOption('SITE_SHIFT');
      await page.getByText('15 lines; page 1.', { exact: false }).waitFor(); await Promise.all(state.delayed); await (await staleResponse).finished();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.getByText('15 lines; page 1.', { exact: false }).waitFor(); assert.equal(await page.getByText(/STALE/).count(), 0);
      state.error = true; await page.getByRole('combobox', { name: /^Reporting period/ }).selectOption('last7');
      await page.getByText('Management report unavailable. No totals can be shown.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Contributing source lines', exact: true }).count(), 0);
      await capture(page, `report-${width}-denied`, results);
      state.error = false; const before = state.calls.length;
      await page.goto(`${base}/management-reports?preset=custom&start=2026-02-30&end=2026-03-01`);
      await page.getByText('Invalid report context', { exact: true }).waitFor(); assert.equal(state.calls.length, before);
      await capture(page, `report-${width}-invalid`, results);
      await page.getByRole('link', { name: 'Reset report context', exact: true }).click();
      await page.getByRole('heading', { name: 'Contributing source lines', exact: true }).waitFor();
      assert.deepEqual(errors, []); await context.close();
    });
  } finally {
    await browser?.close(); server.kill('SIGTERM'); await Promise.race([once(server, 'exit'), new Promise(resolve => setTimeout(resolve, 2000))]);
    await writeFile(join(output, 'layout-results.json'), JSON.stringify(results, null, 2)); await writeFile(join(output, 'fixture-server.log'), log.join(''));
  }
});
