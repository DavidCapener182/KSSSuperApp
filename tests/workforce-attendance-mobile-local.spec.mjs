import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// This fixture app renders unchanged product components/CSS. Its API responses
// simulate guarded revision/idempotency behavior; they do not test remote RLS.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staffRoot = process.env.KSS_MOBILE_STAFF_ROOT ? resolve(process.env.KSS_MOBILE_STAFF_ROOT) : root;
const evidenceRoot = resolve(root, 'output/mobile-workforce-attendance-20261016');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.KSS_PLAYWRIGHT_MODULE || 'playwright');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = { event: uuid(1), site: uuid(2), service: uuid(3), demand: uuid(4), allocation: uuid(5), person: uuid(6), role: uuid(7) };
const day = '2026-10-16', week = '2026-10-12';
const at = `${day}T09:00:00Z`, until = `${day}T17:00:00Z`;
const title = 'Synthetic venue with a deliberately long operational title and collection point — north reception';
const attendance = () => ({ revision: 0, state: 'NOT_RECORDED', check_in_at: null, check_out_at: null, no_show_recorded: false, review_required: false, events: [] });
function fixture(source = 'EVENT') {
  return { source, allocation_id: ids.allocation, id: ids.allocation, requirement_id: ids.demand, demand_id: ids.demand,
    service_id: ids.service, service_name: 'Synthetic ongoing service', service_state: 'ACTIVE', demand_state: 'PLANNED',
    person_name: 'Synthetic Staff Person with a deliberately long name for mobile wrapping',
    status: 'ACCEPTED', revision: 1, event_status: 'LIVE', self_action_available: true, service_date: day,
    report_at: at, shift_starts_at: at, shift_ends_at: until, event_name: title, site_name: 'Synthetic Site',
    area_label: 'Synthetic north reception and visitor entrance', role_name: 'Synthetic Security Officer',
    reporting_point: 'Synthetic gate followed by a long instruction that must wrap within the viewport',
    availability: 'NOT_DECLARED', availability_conflict: null, attendance: attendance() };
}
function duty(row) {
  return { ...row, event_id: row.source === 'EVENT' ? ids.event : null, site_id: ids.site, requirement_id: ids.demand,
    required_quantity: 1, allocated: 1, accepted: 1, remaining: 0, awaiting_response: 0,
    unavailable_conflicts: 0, coverage_conflicts: 0, not_declared: 1, partial_coverage: 0, clashes: 0,
    approved_time_away_conflicts: 0, client_name: 'Synthetic Client',
    allocations: [{ id: ids.allocation, person_name: row.person_name, status: row.status, availability: 'NOT_DECLARED', availability_conflict: null, allocation_clash: false, approved_time_away_conflict: false }] };
}

async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
async function prepare() {
  const runtime = await mkdtemp(join(tmpdir(), 'kss-mobile-fixture-'));
  const files = ['src/components/my-attendance-client.tsx', 'src/components/event-attendance-client.tsx',
    'src/components/site-attendance-client.tsx', 'src/components/attendance.module.css',
    'src/components/workforce-client.tsx', 'src/components/workforce-planner.tsx',
    'src/components/workforce-duty-actions.tsx', 'src/components/workforce-planner.module.css',
    'src/components/my-deployments-client.tsx', 'src/components/my-schedule-client.tsx',
    'src/components/ui/button.tsx', 'src/components/ui/input.tsx', 'src/components/ui/sheet.tsx',
    'src/lib/events/workforce-week.ts', 'src/lib/events/workforce-navigation.ts', 'src/lib/crm/due-time.ts',
    'src/app/globals.css', 'postcss.config.mjs'];
  if (await stat(join(staffRoot, 'src/components/my-shift-entry.module.css')).then(info => info.isFile(), error => {
    if (error.code === 'ENOENT') return false;
    throw error;
  })) files.push('src/components/my-shift-entry.module.css');
  const manifest = [];
  for (const file of files) {
    const sourceRoot = /my-(deployments-client|schedule-client|shift-entry.module)/.test(file) ? staffRoot : root;
    const source = join(sourceRoot, file), target = join(runtime, file);
    await mkdir(dirname(target), { recursive: true }); await cp(source, target);
    manifest.push({ file, sourceRoot, sha256: createHash('sha256').update(await readFile(source)).digest('hex') });
  }
  await symlink(join(root, 'node_modules'), join(runtime, 'node_modules'), 'dir');
  await writeFile(join(runtime, 'package.json'), JSON.stringify({ private: true, name: 'kss-local-mobile-fixture' }));
  await writeFile(join(runtime, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['dom', 'esnext'], jsx: 'react-jsx', module: 'esnext', moduleResolution: 'bundler', esModuleInterop: true, skipLibCheck: true, paths: { '@/*': ['./src/*'] } } }));
  await writeFile(join(runtime, 'next.config.mjs'), 'export default { devIndicators: false };');
  await writeFile(join(runtime, 'src/app/layout.tsx'), `import './globals.css';export default function Layout({children}){return <html lang="en"><body><div className="enterprise-shell"><aside style={{padding:'8px 16px',background:'#fff1d7',color:'#182334'}}>Local simulated API · synthetic fixtures · no authentication</aside>{children}</div></body></html>}`);
  await mkdir(join(runtime, 'src/app/[[...path]]'), { recursive: true });
  await writeFile(join(runtime, 'src/app/[[...path]]/page.tsx'), `
import {MyDeploymentsClient} from '@/components/my-deployments-client';
import {MyScheduleClient} from '@/components/my-schedule-client';
import {MyAttendanceClient} from '@/components/my-attendance-client';
import {EventAttendanceClient} from '@/components/event-attendance-client';
import {SiteAttendanceClient} from '@/components/site-attendance-client';
import {WorkforceClient} from '@/components/workforce-client';
export default async function Page({params,searchParams}){const p=await params,q=await searchParams,path=(p.path||[]).join('/');
if(path==='my-deployments')return <MyDeploymentsClient focus={q.allocationId} focusSource={q.source} returnWeek="${week}"/>;
if(path==='my-schedule')return <MyScheduleClient initialWeek="${week}"/>;
if(path==='my-attendance')return <main className="enterprise-main"><MyAttendanceClient allocationId={q.allocationId} source={q.source==='SITE_SHIFT'?'SITE_SHIFT':'EVENT'}/></main>;
if(path==='event-attendance')return <main className="enterprise-main"><EventAttendanceClient eventId="${ids.event}"/></main>;
if(path==='site-attendance')return <SiteAttendanceClient siteId="${ids.site}" serviceId="${ids.service}" demandId="${ids.demand}"/>;
return <WorkforceClient initial={{week:'${week}',day:'${day}',view:'day'}}/>;}`);
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(join(evidenceRoot, 'source-manifest.json'), JSON.stringify({ baseline: 'ec463382352fb2bb56eed2d7873eedbd694f9ad6', runtime, manifest }, null, 2));
  return runtime;
}

async function simulation(page, row) {
  const state = { row, mode: 'normal', calls: [], processed: new Map(), external: [], failedOnce: false };
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') { state.external.push(url.origin); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const method = request.method(), path = url.pathname;
    const body = request.postDataJSON(); state.calls.push({ path, query: url.search, method, body });
    const send = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (state.mode === 'error' && method === 'GET') return send({ error: 'Synthetic source unavailable. Refresh to retry.' }, 503);
    const items = state.mode === 'empty' ? [] : [state.row];
    if (path === '/api/deployments/me' && method === 'GET') return send({ deployments: { total: items.length, items } });
    if (path === '/api/my-schedule') return send({ schedule: { week_start: week, work_total: items.length, work: items, availability: [] } });
    if (method === 'PATCH' && path.includes('/deployments/')) {
      if (body.expectedRevision !== state.row.revision) return send({ error: 'Synthetic stale revision' }, 409);
      state.row.status = body.response; state.row.revision++; state.row.self_action_available = body.response === 'ACCEPTED';
      return send({ saved: true });
    }
    if (path === '/api/workforce') return send({ schedule: { static_horizon_covered: true, total_lines: items.length,
      totals: { required: items.length, allocated: items.length, accepted: items.length, remaining: 0, availability_conflicts: 0, approved_time_away_conflicts: 0, allocation_clashes: 0 }, items: items.map(duty) } });
    if (path === '/api/workforce/choices') return send({ choices: { roles: [{ id: ids.role, name: row.role_name }], sites: [], events: [], clients: [] } });
    if (path === '/api/workforce/staff') return send(url.searchParams.has('person') ? { schedule: { total: items.length, items: items.map(x => ({ ...x, id: ids.allocation })) } } : { choices: { total: 1, items: [{ id: ids.person, display_name: row.person_name }] } });
    if (path.endsWith('/staffing-requirements')) return send({ plan: { items: [{ ...duty(row), id: ids.demand, state: 'PLANNED', revision: 1, role_id: ids.role }] } });
    if (path.endsWith('/allocations')) return send({ deployment: { remaining: 0, allocations: [{ ...row, id: ids.allocation }] } });
    const personal = path === '/api/attendance/me' || path.startsWith('/api/attendance/me/');
    const manager = path === `/api/events/${ids.event}/attendance` || path === `/api/site-services/${ids.service}/attendance`;
    if (personal || manager) {
      if (method === 'GET') return send({ attendance: { items, total: items.length, counts: { expected: items.length, checked_in: row.attendance.check_in_at ? 1 : 0, checked_out: row.attendance.check_out_at ? 1 : 0 } } });
      if (state.mode === 'retry' && !state.failedOnce) { state.failedOnce = true; return send({ error: 'Synthetic transport refusal; retry safely.' }, 503); }
      if (state.mode === 'stale-readback') return send({ accepted: true });
      if (state.processed.has(body.idempotencyKey)) return send({ accepted: true });
      if (body.expectedRevision !== row.attendance.revision || (personal && (row.status !== 'ACCEPTED' || !row.self_action_available || !path.includes(ids.allocation)))) return send({ error: 'Synthetic guard denied stale or unaccepted allocation' }, 409);
      if (manager && body.action !== 'CHECK_IN' && body.action !== 'CHECK_OUT' && (body.reason?.trim().length ?? 0) < 3) return send({ error: 'Synthetic operational reason requires at least three characters' }, 400);
      await new Promise(resolve => setTimeout(resolve, 150));
      row.attendance.revision++; row.attendance.state = body.action === 'CHECK_OUT' ? 'CHECKED_OUT' : 'CHECKED_IN';
      if (body.action === 'CHECK_IN') row.attendance.check_in_at = body.actualAt;
      if (body.action === 'CHECK_OUT') row.attendance.check_out_at = body.actualAt;
      row.attendance.events.push({ id: uuid(80 + row.attendance.revision), revision: row.attendance.revision, type: body.action,
        actual_at: body.actualAt, effective_actual_at: body.actualAt, recorded_at: body.actualAt, actor_name: 'Synthetic actor', reason: body.reason ?? null, correction_code: null, corrects_event_id: null });
      state.processed.set(body.idempotencyKey, true); return send({ accepted: true });
    }
    return send({ error: `Unimplemented local fixture: ${path}` }, 500);
  });
  return state;
}

async function noOverflow(page, name, results) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('button,input,article,h1,h2,[role="dialog"]')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(el => ({ tag: el.tagName, text: el.textContent?.slice(0, 70), width: el.getBoundingClientRect().width })) }));
  results.push({ name, ...dimensions });
  await page.screenshot({ path: join(evidenceRoot, `${name}.png`), fullPage: !name.endsWith('-dialog') });
  assert.ok(dimensions.scrollWidth <= dimensions.viewport + 1, `${name}: page scrollWidth ${dimensions.scrollWidth} exceeds ${dimensions.viewport}`);
}

test('local genuine viewport Workforce and Attendance journeys', { timeout: 240000 }, async t => {
  const runtime = await prepare(), port = await freePort(), base = `http://127.0.0.1:${port}`;
  const log = []; const results = []; let browser;
  const server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: runtime, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => log.push(chunk.toString())); server.stderr.on('data', chunk => log.push(chunk.toString()));
  try {
    let ready = false;
    for (let i = 0; i < 150; i++) { if (server.exitCode !== null) throw new Error(log.join('')); try { const response = await fetch(base); if (response.ok) { ready = true; break; } } catch { /* wait for local server */ } await new Promise(resolve => setTimeout(resolve, 200)); }
    assert.ok(ready, `Fixture server did not start: ${log.join('').slice(-2500)}`);
    browser = await chromium.launch({ headless: true });
    for (const width of [390, 1280]) {
      for (const source of ['EVENT', 'SITE_SHIFT']) await t.test(`Staff ${source} assigned work → exact attendance → action/readback/refresh at ${width}px`, async () => {
        const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
        const page = await context.newPage(); page.setDefaultTimeout(8000); const errors = []; page.on('pageerror', error => errors.push(error.message));
        const row = fixture(source), state = await simulation(page, row);
        await page.goto(`${base}/my-deployments`); await page.getByRole('link', { name: /^(Next: open attendance|Open attendance)$/ }).waitFor();
        await noOverflow(page, `staff-${source}-${width}-assigned`, results);
        const link = page.getByRole('link', { name: /^(Next: open attendance|Open attendance)$/ });
        const href = new URL(await link.getAttribute('href'), base);
        assert.equal(href.searchParams.get('allocationId'), ids.allocation);
        assert.equal(href.searchParams.get('source') ?? 'EVENT', source);
        await link.focus(); assert.equal(await link.evaluate(el => el === document.activeElement), true); await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Check In', exact: true }).waitFor();
        await noOverflow(page, `staff-${source}-${width}-attendance`, results);
        state.mode = 'retry'; await page.getByRole('button', { name: 'Check In', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'Synthetic transport refusal' }).waitFor();
        await page.getByRole('button', { name: 'Check In', exact: true }).click();
        await page.getByRole('button', { name: 'Recording…', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Recording…', exact: true }).isDisabled(), true);
        await page.getByRole('button', { name: 'Check Out', exact: true }).waitFor();
        const posts = state.calls.filter(x => x.method === 'POST'); assert.equal(posts.length, 2);
        assert.equal(posts[0].body.idempotencyKey, posts[1].body.idempotencyKey);
        assert.ok(posts.every(x => x.path.endsWith(ids.allocation) && new URLSearchParams(x.query).get('source') === source));
        await page.reload(); await page.getByRole('button', { name: 'Check Out', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Check Out', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Check-out recorded' }).waitFor();
        await page.reload(); await page.getByText('CHECKED OUT', { exact: true }).waitFor();
        assert.equal(row.attendance.events.length, 2); assert.equal(row.attendance.revision, 2);
        await noOverflow(page, `staff-${source}-${width}-history`, results);
        assert.deepEqual(errors, []); assert.deepEqual(state.external, []); await context.close();
      });

      await t.test(`Office Event/Site controls, validation and source readback at ${width}px`, async () => {
        for (const source of ['EVENT', 'SITE_SHIFT']) {
          const context = await browser.newContext({ viewport: { width, height: 844 } }); const page = await context.newPage();
          const state = await simulation(page, fixture(source));
          await page.goto(`${base}/${source === 'EVENT' ? 'event-attendance' : 'site-attendance'}`);
          await page.getByRole('button', { name: 'Record observed check-in', exact: true }).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Record no-show', exact: true }).isDisabled(), true);
          const reason = page.getByRole('textbox', { name: /Operational reason/ }); await reason.fill('Synthetic operational observation');
          assert.equal(await page.getByRole('button', { name: 'Record no-show', exact: true }).isDisabled(), false);
          await reason.focus(); assert.equal(await reason.evaluate(el => el === document.activeElement), true);
          await noOverflow(page, `office-${source}-${width}-actions`, results);
          await page.getByRole('button', { name: 'Record observed check-in', exact: true }).click();
          await page.getByRole('status').filter({ hasText: 'Attendance fact confirmed' }).waitFor();
          await page.reload(); await page.getByRole('button', { name: 'Record observed check-out', exact: true }).waitFor();
          assert.equal(state.row.attendance.revision, 1);
          await noOverflow(page, `office-${source}-${width}-readback`, results);
          await context.close();
        }
      });

      await t.test(`Workforce day/duty dialog keyboard and layout at ${width}px`, async () => {
        const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' }); const page = await context.newPage();
        await simulation(page, fixture()); await page.goto(`${base}/workforce`);
        const dutyButton = page.getByRole('button', { name: /Event, Synthetic Client.*view duty/ }); await dutyButton.waitFor();
        await noOverflow(page, `workforce-${width}-day`, results);
        await dutyButton.focus(); await page.keyboard.press('Enter'); const dialog = page.getByRole('dialog'); await dialog.waitFor();
        await dialog.getByRole('link', { name: 'Open full source record and history' }).waitFor();
        await dialog.evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))); });
        await noOverflow(page, `workforce-${width}-dialog`, results);
        const legibility = await dialog.evaluate(el => {
          const copy = el.querySelector('[aria-label="Manage exact duty here"] > p');
          const color = getComputedStyle(copy).color, background = getComputedStyle(el).backgroundColor;
          const luminance = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
          const fg = luminance(color), bg = luminance(background);
          const close = el.querySelector('[data-slot="sheet-close"]').getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(el.querySelector('[data-slot="sheet-title"]'));
          return { color, background, contrast: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
            titleOverlapsClose: [...range.getClientRects()].some(r => r.left < close.right && r.right > close.left && r.top < close.bottom && r.bottom > close.top) };
        });
        results.push({ name: `workforce-${width}-dialog-legibility`, ...legibility });
        assert.ok(legibility.contrast >= 4.5 && !legibility.titleOverlapsClose,
          `Dialog legibility: contrast ${legibility.contrast.toFixed(2)}:1; title overlaps close: ${legibility.titleOverlapsClose}`);
        const sourceHref = new URL(await dialog.getByRole('link', { name: 'Open full source record and history' }).getAttribute('href'), base);
        assert.equal(sourceHref.pathname, `/events/${ids.event}`); assert.equal(sourceHref.searchParams.get('requirement'), ids.demand);
        for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true); }
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
        await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
        await page.getByLabel('Staff search', { exact: false }).waitFor();
        await noOverflow(page, `workforce-${width}-schedule`, results);
        await page.getByRole('tab', { name: 'Coverage', exact: true }).click();
        await noOverflow(page, `workforce-${width}-coverage`, results);
        await context.close();
      });

      await t.test(`Office long resolution control and correction validation at ${width}px`, async () => {
        for (const source of ['EVENT', 'SITE_SHIFT']) {
          const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' }); const page = await context.newPage();
          const row = fixture(source); row.attendance.no_show_recorded = true;
          row.attendance.events = [{ id: uuid(90), revision: 1, type: 'NO_SHOW_RECORDED', actual_at: null, effective_actual_at: null, recorded_at: at,
            actor_name: 'Synthetic manager', reason: 'Synthetic no-show fact pending resolution', correction_code: null, corrects_event_id: null }];
          const state = await simulation(page, row);
          await page.goto(`${base}/${source === 'EVENT' ? 'event-attendance' : 'site-attendance'}`);
          const resolveButton = page.getByRole('button', { name: 'Resolve no-show and record observed check-in', exact: true }); await resolveButton.waitFor();
          assert.equal(await resolveButton.isDisabled(), true);
          await noOverflow(page, `office-${source}-${width}-long-resolution`, results);
          row.attendance.no_show_recorded = false; row.attendance.check_in_at = at; row.attendance.revision = 1;
          row.attendance.events = [{ ...row.attendance.events[0], type: 'CHECK_IN', actual_at: at, effective_actual_at: at }];
          await page.reload(); await page.getByRole('button', { name: /^Correct (recorded|actual) time$/ }).click();
          const save = page.getByRole('button', { name: 'Save correction', exact: true }); assert.equal(await save.isDisabled(), true);
          await page.getByRole('textbox', { name: /Operational reason/ }).fill('Synthetic correction rationale');
          const input = page.getByLabel(/^Correct actual time · (Europe\/London|London)$/);
          await input.fill('2026-10-25T01:30'); assert.equal(await save.isDisabled(), true);
          await input.fill('2026-03-29T01:30'); assert.equal(await save.isDisabled(), true);
          await input.fill('2026-10-16T10:05'); assert.equal(await save.isDisabled(), false);
          assert.equal(state.calls.filter(c => c.method !== 'GET').length, 0);
          await noOverflow(page, `office-${source}-${width}-correction-validation`, results);
          await context.close();
        }
      });
    }

    await t.test('390px empty/error and unaccepted Staff states; Office accepted-without-readback remains uncertain', async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await context.newPage();
      const row = fixture(); row.status = 'ALLOCATED'; row.self_action_available = false; const state = await simulation(page, row);
      await page.goto(`${base}/my-attendance?allocationId=${ids.allocation}`); await page.getByText('Respond to this allocation', { exact: false }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Check In', exact: true }).count(), 0);
      for (const mode of ['empty', 'error']) {
        state.mode = mode; await page.reload(); await page.getByText(mode === 'empty' ? 'This allocation is not available in your own attendance view.' : 'Attendance is unavailable. Retry to refresh.', { exact: false }).waitFor();
        await noOverflow(page, `staff-390-${mode}`, results);
      }
      state.mode = 'stale-readback'; row.status = 'ACCEPTED'; row.self_action_available = true;
      await page.goto(`${base}/event-attendance`); await page.getByRole('button', { name: 'Record observed check-in', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'could not be confirmed' }).waitFor();
      assert.equal(await page.getByRole('status').filter({ hasText: 'Attendance fact confirmed' }).count(), 0);
      await noOverflow(page, 'office-390-uncertain-readback', results); await context.close();
    });
  } finally {
    await browser?.close(); server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), new Promise(resolve => setTimeout(resolve, 2000))]);
    await writeFile(join(evidenceRoot, 'layout-results.json'), JSON.stringify(results, null, 2));
    await writeFile(join(evidenceRoot, 'fixture-server.log'), log.join(''));
  }
});
