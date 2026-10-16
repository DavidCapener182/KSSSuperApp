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
const evidence = join(root, 'output/crm-task-actions-20261016');
const { chromium } = createRequire(import.meta.url)(process.env.KSS_PLAYWRIGHT_MODULE || 'playwright');
import { londonDueToIso } from '../src/lib/crm/due-time.ts';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const initial = { id: uuid(1), title: 'Synthetic exact follow-up with a deliberately long commercial task title for mobile wrapping', state: 'OPEN',
  sourceKind: 'CRM_OPPORTUNITY', sourceId: uuid(2), sourceTitle: 'Synthetic commercial source with a long organisation and opportunity label',
  sourceHref: `/crm/opportunities/${uuid(2)}`, dueAt: '2026-10-16T09:00:00Z', completedAt: null };
const fixtures = [initial,
  { ...initial, id: uuid(3), sourceKind: 'CRM_ORGANISATION', sourceId: uuid(4), sourceHref: `/crm/organisations/${uuid(4)}` },
  { ...initial, id: uuid(5), state: 'DONE', completedAt: '2026-10-16T12:00:00Z' },
  { ...initial, id: uuid(7), state: 'CANCELLED' },
];
async function prepare() {
  const runtime = await mkdtemp(join(tmpdir(), 'kss-crm-task-fixture-'));
  const files = ['src/components/crm-task-actions.tsx', 'src/components/crm-task-actions.module.css', 'src/lib/tasks/crm-action-readback.ts',
    'src/lib/tasks/calendar.ts', 'src/lib/crm/due-time.ts', 'src/app/globals.css', 'postcss.config.mjs'];
  const manifest = [];
  for (const file of files) {
    await mkdir(dirname(join(runtime, file)), { recursive: true }); await cp(join(root, file), join(runtime, file));
    manifest.push({ file, sha256: createHash('sha256').update(await readFile(join(root, file))).digest('hex') });
  }
  await symlink(join(root, 'node_modules'), join(runtime, 'node_modules'), 'dir');
  await writeFile(join(runtime, 'package.json'), JSON.stringify({ private: true, name: 'kss-work-filter-local-fixture' }));
  await writeFile(join(runtime, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', jsx: 'react-jsx', module: 'esnext', moduleResolution: 'bundler', esModuleInterop: true, skipLibCheck: true, paths: { '@/*': ['./src/*'] } } }));
  await writeFile(join(runtime, 'next.config.mjs'), 'export default { devIndicators: false };');
  await writeFile(join(runtime, 'src/app/layout.tsx'), `import './globals.css';export default function Layout({children}){return <html lang="en"><body><div className="enterprise-shell"><aside style={{padding:16}}>Synthetic local fixture · no authentication</aside>{children}</div></body></html>}`);
  await mkdir(join(runtime, 'src/app/[[...path]]'), { recursive: true });
  await writeFile(join(runtime, 'src/app/[[...path]]/page.tsx'), `import {CrmTaskActions} from '@/components/crm-task-actions';
const fixtures=${JSON.stringify(fixtures)};export default async function Page({params}){const p=await params;const task=fixtures.find(t=>t.id===p.path?.[1]);return task ? <CrmTaskActions key={task.id} initialTask={task}/> : <main>Local synthetic destination</main>}`);
  await mkdir(evidence, { recursive: true });
  await writeFile(join(evidence, 'source-manifest.json'), JSON.stringify({ baseline: '1139203851a025eb6cb9c7bb35126fa5794002c2', manifest }, null, 2));
  return runtime;
}
async function port() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const value = server.address().port; await new Promise(r => server.close(r)); return value;
}
async function capture(page, name, results) {
  const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    outside: [...document.querySelectorAll('main input,main select,main button,main a')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }).map(el => el.tagName) }));
  results.push({ name, ...layout }); await page.screenshot({ path: join(evidence, `${name}.png`), fullPage: true });
  assert.ok(layout.scrollWidth <= layout.width + 1, JSON.stringify(layout)); assert.deepEqual(layout.outside, []);
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) {
    const position = await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, viewport: innerWidth }; });
    assert.ok(Math.abs(position.left - (position.viewport - position.width) / 2) < 2, JSON.stringify(position));
  }
}
async function simulation(context) {
  const state = { task: structuredClone(initial), mode: 'normal', calls: [], posts: [], release: null, external: [] };
  let notePost;
  state.postObserved = new Promise(resolve => { notePost = resolve; });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url()), method = route.request().method();
    if (url.hostname !== '127.0.0.1') { state.external.push(url.origin); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    state.calls.push([url.pathname, method]); assert.equal(url.search, '');
    if (method === 'GET') {
      assert.equal(url.pathname, `/api/tasks/${state.task.id}`);
      if (state.mode === 'slow-refresh' || (state.mode === 'readback-pending' && state.posts.length)) await new Promise(r => { state.release = r; });
      if (state.mode === 'lost-access' || (state.mode === 'unavailable-readback' && state.posts.length)) return route.fulfill({ status: 404, json: { error: 'Not available' } });
      let task = structuredClone(state.task);
      if (state.mode === 'stale-preflight') task.dueAt = '2026-10-20T09:00:00Z';
      if (state.posts.length) {
        if (state.mode === 'wrong-id') task.id = uuid(99);
        if (state.mode === 'wrong-source') { task.sourceId = uuid(99); task.sourceHref = `/crm/opportunities/${uuid(99)}`; }
        if (state.mode === 'wrong-state') { task.state = 'OPEN'; task.completedAt = null; }
        if (state.mode === 'wrong-due') task.dueAt = '2026-10-20T09:00:00Z';
      }
      return route.fulfill({ json: { task } });
    }
    assert.equal(url.pathname, '/api/crm/work'); assert.equal(method, 'POST');
    const body = route.request().postDataJSON(); state.posts.push(body); notePost(); assert.equal(body.action, 'changeTask'); assert.equal(body.id, state.task.id);
    assert.ok(['COMPLETE', 'RESCHEDULE'].includes(body.kind));
    if (state.mode === 'slow-post') await new Promise(r => { state.release = r; });
    if (state.mode === 'server-error') return route.fulfill({ status: 503, json: { error: 'Synthetic server error' } });
    if (state.mode === 'denied') return route.fulfill({ status: 403, json: { error: 'CRM action denied' } });
    if (state.mode === 'lost-response') return route.abort();
    if (body.kind === 'COMPLETE') { state.task.state = 'DONE'; state.task.completedAt = '2026-10-16T12:00:00Z'; }
    else { const due = londonDueToIso(body.dueLocal); assert.notEqual(due, undefined); assert.ok(body.reason.trim().length >= 3); state.task.dueAt = due; }
    return route.fulfill({ json: { id: state.mode === 'wrong-receipt' ? uuid(99) : state.task.id } });
  });
  return state;
}
test('exact CRM task actions real Chromium with synthetic guarded API boundaries', { timeout: 180000 }, async t => {
  const runtime = await prepare(), base = `http://127.0.0.1:${await port()}`, log = [], results = [];
  const server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', new URL(base).port], {
    cwd: runtime, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', c => log.push(c.toString())); server.stderr.on('data', c => log.push(c.toString())); let browser;
  try {
    for (let i = 0; i < 150; i++) { if (server.exitCode !== null) throw new Error(log.join('')); try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
    browser = await chromium.launch({ headless: true });
    for (const width of [390, 1280]) {
      await t.test(`explicit completion, pending duplicates, cancel, keyboard/focus and exact source at ${width}px`, async () => {
        const context = await browser.newContext({ viewport: { width, height: 844 } }), page = await context.newPage(); page.setDefaultTimeout(8000);
        const state = await simulation(context), errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(`${base}/work/${initial.id}`); await page.getByRole('heading', { name: initial.title, exact: true }).waitFor();
        assert.equal(await page.getByRole('link', { name: 'Open CRM source' }).getAttribute('href'), initial.sourceHref);
        assert.equal(await page.getByRole('link', { name: 'Back to My Work' }).getAttribute('href'), '/work'); assert.equal(state.calls.length, 0);
        const complete = page.getByRole('button', { name: 'Complete follow-up', exact: true }); await complete.focus(); await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog'); await dialog.waitFor(); assert.match(await dialog.innerText(), new RegExp(initial.title));
        assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).evaluate(el => el === document.activeElement), true);
        for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true); }
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); assert.equal(await complete.evaluate(el => el === document.activeElement), true); assert.equal(state.posts.length, 0);
        await complete.click(); state.mode = 'slow-post'; await dialog.getByRole('button', { name: 'Confirm completion', exact: true }).click();
        await dialog.getByRole('button', { name: 'Saving…', exact: true }).waitFor(); assert.equal(await dialog.getByRole('button', { name: 'Cancel' }).isDisabled(), true);
        await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); }); await page.keyboard.press('Escape');
        await state.postObserved;
        assert.equal(await dialog.isVisible(), true); assert.equal(state.posts.length, 1); assert.equal(await page.getByRole('status').count(), 0);
        await capture(page, `complete-pending-${width}`, results); state.release();
        const success = page.getByRole('status').filter({ hasText: 'Follow-up is Done. Current state verified.' }); await success.waitFor();
        await dialog.waitFor({ state: 'hidden' }); assert.equal(await success.evaluate(el => el === document.activeElement), true);
        assert.equal(await page.getByRole('button', { name: 'Complete follow-up', exact: true }).count(), 0);
        assert.deepEqual(state.calls.map(c => c[1]), ['GET', 'POST', 'GET']); assert.equal(state.posts[0].id, initial.id);
        await capture(page, `complete-verified-${width}`, results); assert.deepEqual(errors, []); assert.deepEqual(state.external, []); await context.close();
      });
      await t.test(`reschedule London validation, POST-alone uncertainty, exact readback and deadline removal at ${width}px`, async () => {
        const context = await browser.newContext({ viewport: { width, height: 844 } }), page = await context.newPage(); page.setDefaultTimeout(8000);
        const state = await simulation(context); state.task = structuredClone(fixtures[1]);
        await page.goto(`${base}/work/${state.task.id}`); await page.getByRole('button', { name: 'Reschedule follow-up', exact: true }).click();
        const dialog = page.getByRole('dialog'), due = dialog.getByLabel('New deadline · Europe/London', { exact: true }), reason = dialog.getByLabel('Reason · 3 to 300 characters', { exact: true });
        const save = dialog.getByRole('button', { name: 'Confirm reschedule', exact: true }); assert.equal(await save.isDisabled(), true);
        assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).isEnabled(), true);
        await reason.fill('Synthetic revised plan');
        for (const value of ['2026-03-29T01:30', '2026-10-25T01:30']) { await due.fill(value); assert.equal(await save.isDisabled(), true); }
        assert.equal(state.posts.length, 0); await due.fill('2026-10-17T10:00'); await reason.fill('x'); assert.equal(await save.isDisabled(), true);
        await reason.fill('Synthetic revised plan'); await capture(page, `reschedule-review-${width}`, results);
        state.mode = 'readback-pending'; const posted = page.waitForResponse(response => response.url().endsWith('/api/crm/work')); await save.click(); await posted; await dialog.getByRole('button', { name: 'Saving…', exact: true }).waitFor();
        await page.waitForFunction(() => document.querySelector('dialog button[type="submit"]')?.disabled === true);
        assert.equal(state.posts.length, 1); assert.equal(await page.getByRole('status').count(), 0); await capture(page, `reschedule-readback-pending-${width}`, results);
        // The POST has replied; confirmation is still blocked on the exact task GET.
        for (let i = 0; !state.release && i < 30; i++) await new Promise(r => setTimeout(r, 20)); assert.ok(state.release); state.release();
        await page.getByRole('status').filter({ hasText: 'Current deadline verified.' }).waitFor(); await dialog.waitFor({ state: 'hidden' });
        assert.equal(state.task.dueAt, '2026-10-17T09:00:00.000Z'); assert.equal(state.posts[0].id, fixtures[1].id);
        assert.equal(await page.getByRole('link', { name: 'Open CRM source' }).getAttribute('href'), fixtures[1].sourceHref);
        state.mode = 'normal'; await page.getByRole('button', { name: 'Reschedule follow-up', exact: true }).click(); await due.fill(''); await reason.fill('Synthetic deadline removed');
        await dialog.getByText('The current deadline will be removed.', { exact: true }).waitFor(); await save.click();
        await dialog.waitFor({ state: 'hidden' }); assert.equal(state.posts.length, 2); assert.equal(state.posts[1].dueLocal, null); assert.equal(state.task.dueAt, null);
        await capture(page, `deadline-removed-${width}`, results); assert.deepEqual(state.external, []); await context.close();
      });
      await t.test(`stale/denied/wrong/unavailable results clear facts and require safe refresh at ${width}px`, async () => {
        const context = await browser.newContext({ viewport: { width, height: 844 } }), page = await context.newPage(); page.setDefaultTimeout(8000); const state = await simulation(context);
        for (const mode of ['stale-preflight', 'lost-access', 'denied', 'server-error', 'wrong-id', 'wrong-source', 'wrong-state', 'wrong-due', 'wrong-receipt', 'unavailable-readback', 'lost-response']) {
          state.task = structuredClone(initial); state.posts = []; state.calls = []; state.mode = mode;
          await page.goto(`${base}/work/${initial.id}`); await page.getByRole('button', { name: 'Complete follow-up', exact: true }).click();
          await page.getByRole('dialog').getByRole('button', { name: 'Confirm completion', exact: true }).click(); await page.locator('main').getByRole('alert').waitFor();
          assert.equal(await page.getByRole('status').count(), 0);
          if (mode === 'stale-preflight') { assert.equal(state.posts.length, 0); await page.getByText('This follow-up changed.', { exact: false }).waitFor(); }
          else {
            assert.equal(state.posts.length, mode === 'lost-access' ? 0 : 1, mode);
            assert.equal(await page.getByRole('heading', { name: initial.title, exact: true }).count(), 0, `${mode}: ${await page.locator('main').innerText()}`); assert.equal(await page.getByRole('link', { name: 'Open CRM source' }).count(), 0);
            assert.equal(await page.getByRole('button', { name: 'Complete follow-up', exact: true }).count(), 0);
            if (mode === 'server-error') assert.match(await page.locator('main').innerText(), /Update not confirmed/);
          }
          if (mode === 'wrong-due' || mode === 'denied' || mode === 'stale-preflight') await capture(page, `${mode}-${width}`, results);
          const posts = state.posts.length; state.mode = 'normal'; await page.getByRole('button', { name: 'Refresh follow-up', exact: true }).click();
          await page.getByRole('status').filter({ hasText: 'Current follow-up loaded.' }).waitFor(); assert.equal(state.posts.length, posts);
        }
        state.mode = 'slow-refresh'; await page.getByRole('button', { name: 'Refresh follow-up', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Loading current follow-up' }).waitFor();
        assert.equal(await page.getByRole('link', { name: 'Open CRM source' }).count(), 0); await capture(page, `refresh-loading-${width}`, results); state.mode = 'normal'; state.release();
        await page.getByRole('status').filter({ hasText: 'Current follow-up loaded.' }).waitFor(); assert.deepEqual(state.external, []); await context.close();
      });
    }
    await t.test('historical exact routes expose canonical navigation without action controls or writes', async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage(); page.setDefaultTimeout(8000); const state = await simulation(context);
      for (const item of fixtures.slice(2)) {
        await page.goto(`${base}/work/${item.id}`); await page.getByText('This follow-up is historical.', { exact: false }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Complete follow-up', exact: true }).count(), 0); assert.equal(await page.getByRole('button', { name: 'Reschedule follow-up', exact: true }).count(), 0);
        await capture(page, `historical-${item.state.toLowerCase()}-390`, results);
      }
      assert.deepEqual(state.calls, []); assert.deepEqual(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })), { local: [], session: [] }); await context.close();
    });
  } finally {
    await browser?.close(); server.kill('SIGTERM'); await Promise.race([once(server, 'exit'), new Promise(r => setTimeout(r, 2000))]);
    await writeFile(join(evidence, 'layout-results.json'), JSON.stringify(results, null, 2) + '\n');
    await writeFile(join(evidence, 'fixture-server.log'), log.join('').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\t/g, '  ').trimEnd() + '\n');
  }
});
