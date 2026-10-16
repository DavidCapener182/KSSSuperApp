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
const evidence = join(root, 'output/work-filters-20261016');
const { chromium } = createRequire(import.meta.url)(process.env.KSS_PLAYWRIGHT_MODULE || 'playwright');
const rows = [
  { id: 'doc-open', title: 'Review submitted evidence', sourceKind: 'DOCUMENT_VERSION', state: 'OPEN', requestTitle: 'Synthetic identity request', subjectName: 'Synthetic Person', versionNumber: 2 },
  { id: 'doc-cover', title: 'Review cover evidence', sourceKind: 'DOCUMENT_VERSION', state: 'OPEN', covering: true, requestTitle: 'Synthetic cover request', versionNumber: 3 },
  { id: 'crm-open', title: 'Call synthetic client', sourceKind: 'CRM_OPPORTUNITY', state: 'OPEN', sourceTitle: 'Synthetic commercial source' },
  { id: 'crm-done', title: 'Completed synthetic follow-up', sourceKind: 'CRM_ORGANISATION', state: 'DONE', sourceTitle: 'Synthetic organisation' },
  { id: 'crm-cancelled', title: 'Cancelled synthetic follow-up', sourceKind: 'CRM_OPPORTUNITY', state: 'CANCELLED', sourceTitle: 'Synthetic closed source' },
  { id: 'tfs-investigate', title: 'Synthetic investigation', sourceKind: 'TFS_LP_ISSUE', state: 'OPEN', sourceStatus: 'Investigating', priority: 'Urgent' },
  { id: 'tfs-visit', title: 'Synthetic visit request with a deliberately long operational title to verify wrapping at a narrow mobile viewport', sourceKind: 'TFS_LP_ISSUE', state: 'OPEN', sourceStatus: 'Visit needed', priority: 'Review' },
  { id: 'tfs-review', title: 'Synthetic issue review', sourceKind: 'TFS_LP_ISSUE', state: 'OPEN', sourceStatus: 'Awaiting evidence', priority: 'High', sourceTitle: 'UNDISPLAYED_SENTINEL' },
].map((row, i) => ({ covering: false, createdAt: '2026-10-16T09:00:00Z', completedAt: null, dueAt: null, sourceId: `synthetic-source-${i}`, sourceHref: `/tfs/issues/synthetic-${i}?issue=exact`, nextAction: 'Synthetic next step', ...row }));
async function prepare() {
  const runtime = await mkdtemp(join(tmpdir(), 'kss-work-filters-fixture-'));
  const files = ['src/components/work-client.tsx', 'src/components/work-filters.module.css', 'src/components/ui/workflow.tsx', 'src/components/ui/badge.tsx', 'src/components/ui/button.tsx', 'src/components/ui/skeleton.tsx', 'src/lib/crm/due-status.ts', 'src/lib/utils.ts', 'src/app/globals.css', 'postcss.config.mjs'];
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
  await writeFile(join(evidence, 'source-manifest.json'), JSON.stringify({ baseline: '13cce15060f0c561e43e71cfcf9aeecc7094ba16', manifest }, null, 2));
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
test('My Work real Chromium component journeys with local synthetic responses', { timeout: 150000 }, async t => {
  const runtime = await prepare(), base = `http://127.0.0.1:${await port()}`, log = [], results = [];
  const server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', new URL(base).port], {
    cwd: runtime, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', c => log.push(c.toString())); server.stderr.on('data', c => log.push(c.toString())); let browser;
  try {
    for (let i = 0; i < 150; i++) { if (server.exitCode !== null) throw new Error(log.join('')); try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
    browser = await chromium.launch({ headless: true });
    for (const width of [390, 1280]) await t.test(`source/status/search, keyboard, links and layout at ${width}px`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 844 } }), page = await context.newPage(); page.setDefaultTimeout(8000);
      const calls = [], errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname !== '127.0.0.1') return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        calls.push([url.pathname, route.request().method()]);
        assert.equal(url.pathname, '/api/tasks'); return route.fulfill({ json: { tasks: rows } });
      });
      await page.goto(`${base}/work`); await page.getByRole('status').filter({ hasText: 'Showing 8 of 8' }).waitFor();
      const initialCalls = calls.length;
      const source = page.getByLabel('Source', { exact: true }), status = page.getByLabel('Status', { exact: true }), search = page.getByRole('searchbox'), clear = page.getByRole('button', { name: 'Clear filters' });
      assert.equal(await clear.isDisabled(), true);
      assert.deepEqual(await page.locator('#tfs-actions-heading').locator('..').locator('..').getByRole('link').allTextContents().then(xs => xs.map(x => x.trim().split('Synthetic next')[0])), [rows[6].title + 'Visit needed', rows[5].title + 'Urgent · Investigating']);
      await capture(page, `all-${width}`, results);
      await search.focus(); await page.keyboard.press('Tab'); assert.equal(await source.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab'); assert.equal(await status.evaluate(el => el === document.activeElement), true);
      await source.selectOption('DOCUMENTS'); await status.selectOption('COVERING'); await page.getByText('Review cover evidence', { exact: true }).waitFor();
      assert.equal(await page.getByRole('link').count(), 1); assert.equal(await page.getByRole('link').getAttribute('href'), '/work/doc-cover');
      await capture(page, `covering-${width}`, results);
      await clear.click(); await source.selectOption('CRM'); await status.selectOption('DONE'); await search.fill('  ORGANISATION  ');
      await page.getByText('Completed synthetic follow-up', { exact: true }).waitFor(); assert.equal(await page.getByRole('link').count(), 1);
      assert.equal(await page.getByRole('link').getAttribute('href'), '/work/crm-done');
      await clear.click(); await status.selectOption('CANCELLED'); await page.getByText('Cancelled synthetic follow-up', { exact: true }).waitFor();
      await clear.click(); await source.selectOption('CRM'); await status.selectOption('OPEN'); await page.getByText('Call synthetic client', { exact: true }).waitFor();
      assert.equal(calls.length, initialCalls, 'filters must not query any additional work');
      const crm = page.getByRole('link', { name: 'Open CRM source' }); await crm.focus(); await page.keyboard.press('Enter');
      await page.waitForURL(`${base}/work/crm-open`);
      await page.goto(`${base}/work`); await source.selectOption('DOCUMENTS'); await status.selectOption('OPEN'); await search.fill(' SYNTHETIC PERSON ');
      const doc = page.getByRole('link', { name: 'Open Version 2 review' }); await doc.waitFor(); await doc.click(); await page.waitForURL(`${base}/work/doc-open`);
      await page.goto(`${base}/work`); await search.fill('UNDISPLAYED_SENTINEL'); await page.getByText('No matching work', { exact: true }).waitFor();
      await capture(page, `no-match-${width}`, results);
      await clear.focus(); await page.keyboard.press('Enter'); await page.getByRole('status').filter({ hasText: 'Showing 8 of 8' }).waitFor();
      assert.equal(await source.inputValue(), 'ALL'); assert.equal(await status.inputValue(), 'ALL'); assert.equal(await search.inputValue(), '');
      await source.selectOption('TFS'); const tfs = page.getByRole('link').filter({ hasText: 'Synthetic visit request' });
      assert.equal(await tfs.getAttribute('href'), rows[6].sourceHref); await tfs.click(); await page.waitForURL(`${base}${rows[6].sourceHref}`);
      assert.ok(calls.every(([path, method]) => path === '/api/tasks' && method === 'GET'));
      assert.deepEqual(errors, []); await context.close();
    });
    await t.test('loading, empty projection and failures at mobile size', async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage(); page.setDefaultTimeout(8000);
      let mode = 'loading', release;
      await page.route('**/api/tasks', async route => {
        if (mode === 'loading') await new Promise(r => { release = r; });
        return route.fulfill({ status: mode === 'error' ? 503 : 200, json: mode === 'error' ? { error: 'Work unavailable' } : { tasks: [] } });
      });
      await page.goto(`${base}/work`); await page.getByRole('status', { name: 'Loading your work…' }).waitFor();
      assert.equal(await page.getByRole('search').count(), 0); await capture(page, 'loading-390', results);
      mode = 'empty'; release(); await page.getByText('No open tasks', { exact: true }).waitFor(); await page.getByText('No completed tasks', { exact: true }).waitFor();
      await capture(page, 'empty-390', results); await page.getByLabel('Source', { exact: true }).selectOption('TFS'); await page.getByText('No matching work', { exact: true }).waitFor();
      mode = 'error'; await page.reload(); await page.getByRole('alert').waitFor(); assert.equal(await page.getByRole('search').count(), 0); assert.equal(await page.getByRole('link').count(), 0);
      await capture(page, 'unavailable-390', results); await context.close();
    });
  } finally {
    await browser?.close(); server.kill('SIGTERM'); await Promise.race([once(server, 'exit'), new Promise(r => setTimeout(r, 2000))]);
    await writeFile(join(evidence, 'layout-results.json'), JSON.stringify(results, null, 2));
    await writeFile(join(evidence, 'fixture-server.log'), log.join('').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\t/g, '  ').trimEnd() + '\n');
  }
});
