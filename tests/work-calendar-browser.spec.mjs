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
const evidence = join(root, 'output/work-calendar-20261016');
const { chromium } = createRequire(import.meta.url)(process.env.KSS_PLAYWRIGHT_MODULE || 'playwright');
const rows = [
  { id: 'crm-early', title: 'Synthetic early follow-up', sourceKind: 'CRM_OPPORTUNITY', state: 'OPEN', dueAt: '2026-10-15T23:30:00Z' },
  { id: 'crm-open', title: 'Synthetic current follow-up', sourceKind: 'CRM_OPPORTUNITY', state: 'OPEN', dueAt: '2026-10-16T09:00:00Z' },
  { id: 'crm-done', title: 'Synthetic completed follow-up', sourceKind: 'CRM_ORGANISATION', state: 'DONE', dueAt: '2026-10-16T10:00:00Z' },
  { id: 'crm-cancelled', title: 'Synthetic cancelled follow-up', sourceKind: 'CRM_OPPORTUNITY', state: 'CANCELLED', dueAt: '2026-10-16T11:00:00Z' },
  { id: 'crm-bst', title: 'Synthetic repeated-hour first', sourceKind: 'CRM_OPPORTUNITY', state: 'OPEN', dueAt: '2026-10-25T00:30:00Z' },
  { id: 'crm-gmt', title: 'Synthetic repeated-hour second', sourceKind: 'CRM_ORGANISATION', state: 'OPEN', dueAt: '2026-10-25T01:30:00Z' },
  { id: 'crm-november', title: 'Synthetic next-month follow-up', sourceKind: 'CRM_OPPORTUNITY', state: 'OPEN', dueAt: '2026-11-01T00:30:00Z' },
  { id: 'crm-invalid', title: 'Synthetic invalid deadline', sourceKind: 'CRM_OPPORTUNITY', state: 'OPEN', dueAt: '2026-02-30T09:00:00Z' },
  { id: 'doc-open', title: 'Review synthetic document with a deliberately long personnel evidence title for mobile wrapping', sourceKind: 'DOCUMENT_VERSION', state: 'OPEN', requestTitle: 'Synthetic request', subjectName: 'Synthetic Person', versionNumber: 2 },
  { id: 'doc-cover', title: 'Synthetic covering review', sourceKind: 'DOCUMENT_VERSION', state: 'OPEN', covering: true, requestTitle: 'Synthetic cover request', versionNumber: 3 },
  { id: 'tfs-visit', title: 'Synthetic requested visit', sourceKind: 'TFS_LP_ISSUE', state: 'OPEN', sourceStatus: 'Visit needed', priority: 'Review' },
  { id: 'tfs-investigate', title: 'Synthetic urgent investigation', sourceKind: 'TFS_LP_ISSUE', state: 'OPEN', sourceStatus: 'Investigating', priority: 'Urgent' },
].map((row, i) => ({ covering: false, createdAt: '2026-10-16T09:00:00Z', completedAt: null, dueAt: null, sourceId: `synthetic-source-${i}`, sourceTitle: 'Synthetic CRM source', sourceHref: `/tfs/issues/synthetic-${i}?issue=exact`, nextAction: 'Synthetic next step', ...row }));
async function prepare() {
  const runtime = await mkdtemp(join(tmpdir(), 'kss-work-calendar-fixture-'));
  const files = ['src/components/work-calendar.tsx', 'src/components/work-calendar.module.css', 'src/lib/tasks/calendar.ts', 'src/components/work-client.tsx', 'src/components/work-filters.module.css', 'src/components/ui/workflow.tsx', 'src/components/ui/badge.tsx', 'src/components/ui/button.tsx', 'src/components/ui/skeleton.tsx', 'src/lib/crm/due-status.ts', 'src/lib/utils.ts', 'src/app/globals.css', 'postcss.config.mjs'];
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
  await writeFile(join(runtime, 'src/app/[[...path]]/page.tsx'), `import {WorkClient} from '@/components/work-client';export default async function Page({params}){const p=await params;return p.path?.[0]==='work' && p.path.length===1 ? <WorkClient/> : <main>Local source navigation destination</main>}`);
  await mkdir(evidence, { recursive: true });
  await writeFile(join(evidence, 'source-manifest.json'), JSON.stringify({ baseline: '184795739c4b66a43c6727072e684aecb94de4b3', manifest }, null, 2));
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
}
test('My Work deadline calendar real Chromium journeys with synthetic projections', { timeout: 150000 }, async t => {
  const runtime = await prepare(), base = `http://127.0.0.1:${await port()}`, log = [], results = [];
  const server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', new URL(base).port], {
    cwd: runtime, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', c => log.push(c.toString())); server.stderr.on('data', c => log.push(c.toString())); let browser;
  try {
    for (let i = 0; i < 150; i++) { if (server.exitCode !== null) throw new Error(log.join('')); try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
    browser = await chromium.launch({ headless: true });
    for (const width of [390, 1280]) await t.test(`London dates/agenda, month navigation, filters, undated links and keyboard at ${width}px`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 844 }, timezoneId: 'America/Los_Angeles' }), page = await context.newPage(); page.setDefaultTimeout(8000);
      await page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'));
      const calls = [], errors = [], external = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url()); if (url.hostname !== '127.0.0.1') { external.push(url.origin); return route.abort(); }
        if (!url.pathname.startsWith('/api/')) return route.continue();
        calls.push([url.pathname, route.request().method()]); assert.equal(url.pathname, '/api/tasks'); assert.equal(url.search, '');
        return route.fulfill({ json: { tasks: rows } });
      });
      await page.goto(`${base}/work`); await page.getByRole('status').filter({ hasText: 'Showing 12 of 12' }).waitFor(); const initialCalls = calls.length;
      assert.equal(await page.getByRole('button', { name: 'List', exact: true }).getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: 'Deadline calendar', exact: true }).focus(); await page.keyboard.press('Enter');
      await page.getByRole('heading', { name: 'October 2026', exact: true }).waitFor();
      const agenda = page.getByRole('region', { name: 'Friday, 16 October 2026', exact: true });
      assert.equal(await agenda.getByRole('link', { name: 'Open CRM source' }).count(), 4);
      assert.deepEqual(await agenda.getByRole('link').evaluateAll(links => links.map(el => el.getAttribute('href'))), ['/work/crm-early', '/work/crm-open', '/work/crm-done', '/work/crm-cancelled']);
      assert.match(await agenda.innerText(), /00:30 BST/); assert.match(await agenda.innerText(), /Historical due date/);
      assert.match(await page.getByRole('status').filter({ hasText: /dated tasks? this month/ }).innerText(), /6 dated tasks this month: 4 open, 0 covering, 1 done, 1 cancelled/);
      assert.equal(await page.getByRole('heading', { name: 'Undated work (5)', exact: true }).count(), 1);
      const invalid = page.locator('.work-card').filter({ hasText: 'Synthetic invalid deadline' });
      assert.match(await invalid.innerText(), /No due date/); assert.doesNotMatch(await invalid.innerText(), /02\/03\/2026/);
      await capture(page, `october-${width}`, results);
      const day = prefix => page.getByRole('button', { name: new RegExp(`^${prefix}:`) });
      await day('Friday, 16 October 2026').focus(); await page.keyboard.press('ArrowDown');
      assert.equal(await day('Friday, 23 October 2026').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
      const repeat = page.getByRole('region', { name: 'Sunday, 25 October 2026', exact: true }); await repeat.waitFor();
      assert.match(await repeat.innerText(), /01:30 BST/); assert.match(await repeat.innerText(), /01:30 GMT/);
      assert.deepEqual(await repeat.getByRole('link').evaluateAll(links => links.map(el => el.getAttribute('href'))), ['/work/crm-bst', '/work/crm-gmt']);
      await capture(page, `dst-${width}`, results);
      await day('Saturday, 31 October 2026').click(); await day('Saturday, 31 October 2026').focus(); await page.keyboard.press('ArrowRight');
      await page.getByRole('heading', { name: 'November 2026', exact: true }).waitFor(); assert.equal(await day('Sunday, 1 November 2026').evaluate(el => el === document.activeElement), true);
      assert.equal(await page.getByRole('region', { name: 'Sunday, 1 November 2026', exact: true }).getByRole('link').getAttribute('href'), '/work/crm-november');
      await capture(page, `november-${width}`, results);
      await page.getByRole('button', { name: 'Next month', exact: true }).click(); await page.getByRole('button', { name: 'Next month', exact: true }).click();
      await page.getByRole('heading', { name: 'January 2027', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Previous month', exact: true }).click(); await page.getByRole('heading', { name: 'December 2026', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Today', exact: true }).click(); await agenda.waitFor();
      assert.equal(await day('Friday, 16 October 2026').getAttribute('aria-current'), 'date');
      const source = page.getByLabel('Source', { exact: true }), status = page.getByLabel('Status', { exact: true }), search = page.getByRole('searchbox');
      await source.selectOption('CRM'); await status.selectOption('DONE'); await search.fill('completed');
      await page.getByRole('status').filter({ hasText: 'Showing 1 of 12' }).waitFor(); assert.equal(await agenda.getByRole('link').getAttribute('href'), '/work/crm-done');
      assert.match(await page.getByRole('status').filter({ hasText: /dated tasks? this month/ }).innerText(), /1 dated task this month: 0 open, 0 covering, 1 done, 0 cancelled/);
      await status.selectOption('CANCELLED'); await search.fill('cancelled'); await page.getByRole('status').filter({ hasText: 'Showing 1 of 12' }).waitFor();
      assert.match(await agenda.innerText(), /Cancelled/); assert.match(await agenda.innerText(), /Historical due date/);
      await page.getByRole('button', { name: 'Clear filters' }).click(); await source.selectOption('DOCUMENTS'); await status.selectOption('COVERING');
      await page.getByRole('heading', { name: 'Undated work (1)', exact: true }).waitFor(); assert.equal(await page.getByRole('link', { name: 'Open Version 3 review' }).getAttribute('href'), '/work/doc-cover');
      await capture(page, `covering-undated-${width}`, results);
      await page.getByRole('button', { name: 'Clear filters' }).click(); await source.selectOption('TFS');
      await page.getByRole('heading', { name: 'Undated work (2)', exact: true }).waitFor();
      await page.getByRole('button', { name: 'List', exact: true }).click();
      assert.deepEqual(await page.locator('#tfs-actions-heading').locator('..').locator('..').getByRole('link').evaluateAll(links => links.map(el => el.getAttribute('href'))), [rows[10].sourceHref, rows[11].sourceHref]);
      await page.getByRole('button', { name: 'Deadline calendar', exact: true }).click();
      const tfs = page.getByRole('link', { name: 'Open TFS issue', exact: true }).first(); assert.equal(await tfs.getAttribute('href'), rows[10].sourceHref);
      await search.fill('not returned'); await page.getByText('No matching work', { exact: true }).waitFor(); assert.equal(await page.getByRole('table').count(), 0); await capture(page, `no-match-${width}`, results);
      await page.getByRole('button', { name: 'Clear filters' }).focus(); await page.keyboard.press('Enter');
      assert.equal(calls.length, initialCalls); assert.ok(calls.every(([path, method]) => path === '/api/tasks' && method === 'GET'));
      assert.deepEqual(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), query: location.search, hash: location.hash })), { local: [], session: [], query: '', hash: '' });
      const doc = page.getByRole('link', { name: 'Open Version 2 review', exact: true }); await doc.focus(); await page.keyboard.press('Enter'); await page.waitForURL(`${base}/work/doc-open`);
      await page.goto(`${base}/work`); await page.getByRole('button', { name: 'Deadline calendar', exact: true }).click();
      const crm = page.getByRole('region', { name: 'Friday, 16 October 2026', exact: true }).getByRole('link').filter({ hasText: 'Open CRM source' }).first(); await crm.click(); await page.waitForURL(`${base}/work/crm-early`);
      await page.goto(`${base}/work`); await page.getByRole('button', { name: 'Deadline calendar', exact: true }).click();
      const exactTfs = page.getByRole('link', { name: 'Open TFS issue', exact: true }).first(); await exactTfs.click(); await page.waitForURL(`${base}${rows[10].sourceHref}`);
      assert.deepEqual(errors, []); assert.deepEqual(external, []); await context.close();
    });
    await t.test('initial loading, empty calendar/agenda and failed source clears facts at 390px', async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage(); page.setDefaultTimeout(8000);
      await page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z')); let mode = 'loading', release;
      await page.route('**/api/tasks', async route => { if (mode === 'loading') await new Promise(r => { release = r; }); return route.fulfill({ status: mode === 'error' ? 503 : 200, json: mode === 'error' ? { error: 'Work unavailable' } : { tasks: mode === 'populated' ? rows : [] } }); });
      await page.goto(`${base}/work`); await page.getByRole('status', { name: 'Loading your work…' }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Deadline calendar', exact: true }).count(), 0); await capture(page, 'loading-390', results);
      mode = 'empty'; release(); await page.getByRole('button', { name: 'Deadline calendar', exact: true }).click();
      await page.getByText('No undated work in the current results.', { exact: true }).waitFor(); await page.getByText('No dated tasks for this day in the current results.', { exact: true }).waitFor(); await capture(page, 'empty-390', results);
      mode = 'populated'; await page.reload(); await page.getByRole('button', { name: 'Deadline calendar', exact: true }).click(); await page.getByText('Synthetic early follow-up', { exact: true }).waitFor();
      mode = 'error'; await page.reload(); await page.getByRole('alert').waitFor(); assert.equal(await page.getByRole('table').count(), 0); assert.equal(await page.getByRole('link').count(), 0); assert.equal(await page.getByRole('status').filter({ hasText: 'Showing' }).count(), 0); await capture(page, 'unavailable-390', results); await context.close();
    });
  } finally {
    await browser?.close(); server.kill('SIGTERM'); await Promise.race([once(server, 'exit'), new Promise(r => setTimeout(r, 2000))]);
    await writeFile(join(evidence, 'layout-results.json'), JSON.stringify(results, null, 2) + '\n');
    await writeFile(join(evidence, 'fixture-server.log'), log.join('').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\t/g, '  ').trimEnd() + '\n');
  }
});
