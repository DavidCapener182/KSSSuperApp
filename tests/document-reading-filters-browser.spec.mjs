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
const evidence = join(root, 'output/document-reading-filters-20261016');
const { chromium } = createRequire(import.meta.url)(process.env.KSS_PLAYWRIGHT_MODULE || 'playwright');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const assignment = (n, values = {}) => ({ id: uuid(n), document_id: uuid(100 + n), version_id: uuid(200 + n),
  version_number: 1, title: `Synthetic policy ${n}`, target_kind: 'SITE_SERVICE', target_id: uuid(300 + n),
  context_label: 'Synthetic North Service', required: true, effective_from: '2026-10-16T09:00:00Z',
  current: true, conflict: false, opened: false, acknowledged_at: null, close_kind: null, ...values });
const rows = () => [
  assignment(1, { title: 'Synthetic grouped instructions' }),
  assignment(2, { title: 'Synthetic grouped instructions', document_id: uuid(101), version_id: uuid(201), opened: true, context_label: 'Synthetic Stadium Event' }),
  assignment(3, { title: 'Synthetic replaced instructions', document_id: uuid(110), version_id: uuid(210), current: false, close_kind: 'REPLACED', acknowledged_at: '2026-10-15T10:00:00Z' }),
  assignment(4, { title: 'Synthetic current instructions', document_id: uuid(110), version_id: uuid(211), version_number: 2 }),
  assignment(5, { title: 'Synthetic conflicting policy', document_id: uuid(120), version_id: uuid(220), conflict: true, acknowledged_at: '2026-10-15T10:00:00Z' }),
  assignment(6, { title: 'Synthetic conflicting policy', document_id: uuid(120), version_id: uuid(221), version_number: 2, conflict: true }),
  assignment(7, { title: 'Synthetic acknowledged policy', opened: true, acknowledged_at: '2026-10-16T10:00:00Z' }),
  assignment(8, { title: 'Synthetic optional guidance', required: false, opened: true, context_label: 'Synthetic Reception Team' }),
  assignment(9, { title: 'Synthetic unopened policy with a deliberately long title for narrow phone layouts and operational context wrapping', context_label: 'Synthetic venue with an unusually long operational service context label for mobile wrapping' }),
];
async function prepare() {
  const runtime = await mkdtemp(join(tmpdir(), 'kss-reading-filter-fixture-'));
  const files = ['src/components/operational-documents-client.tsx', 'src/components/operational-documents.module.css',
    'src/components/operational-reading-filters.module.css', 'src/components/operational-document-picker.tsx',
    'src/lib/controlled/reading-list.ts', 'src/app/globals.css', 'postcss.config.mjs'];
  const manifest = [];
  for (const file of files) {
    await mkdir(dirname(join(runtime, file)), { recursive: true }); await cp(join(root, file), join(runtime, file));
    manifest.push({ file, sha256: createHash('sha256').update(await readFile(join(root, file))).digest('hex') });
  }
  await symlink(join(root, 'node_modules'), join(runtime, 'node_modules'), 'dir');
  await writeFile(join(runtime, 'package.json'), JSON.stringify({ private: true, name: 'kss-reading-filter-local-fixture' }));
  await writeFile(join(runtime, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', jsx: 'react-jsx', module: 'esnext', moduleResolution: 'bundler', esModuleInterop: true, skipLibCheck: true, paths: { '@/*': ['./src/*'] } } }));
  await writeFile(join(runtime, 'next.config.mjs'), 'export default { devIndicators: false };');
  await writeFile(join(runtime, 'src/app/layout.tsx'), `import './globals.css';export default function Layout({children}){return <html lang="en"><body><div className="enterprise-shell"><aside style={{padding:16}}>Synthetic local fixture · no authentication</aside>{children}</div></body></html>}`);
  await writeFile(join(runtime, 'src/app/page.tsx'), `import {OperationalDocumentsClient} from '@/components/operational-documents-client';export default function Page(){return <OperationalDocumentsClient staff manager={false} operations={false} superAdmin={false}/>}`);
  await mkdir(evidence, { recursive: true });
  await writeFile(join(evidence, 'source-manifest.json'), JSON.stringify({ baseline: 'a216616cb41899f6476b2788219f63eb0de7b5fe', manifest }, null, 2));
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
async function simulation(context, initialRows = rows()) {
  const state = { mode: 'ready', rows: initialRows, calls: [], external: [], posts: [], release: null };
  await context.route('**/*', async route => {
    const url = new URL(route.request().url()), method = route.request().method();
    if (url.hostname !== '127.0.0.1') { state.external.push(url.origin); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    state.calls.push([url.pathname, method]); assert.equal(url.search, '', 'no filter search may leave the browser');
    if (url.pathname === '/api/operational-documents/my') {
      assert.equal(method, 'GET');
      if (state.mode === 'loading') await new Promise(r => { state.release = r; });
      const status = state.mode === 'denied' ? 403 : state.mode === 'error' ? 503 : 200;
      return route.fulfill({ status, json: status === 200 ? { assignments: state.rows } : { error: 'Required reading unavailable' } });
    }
    const match = url.pathname.match(/^\/api\/operational-documents\/my\/([^/]+)\/(file|acknowledge)$/);
    assert.ok(match, `unexpected API: ${url.pathname}`);
    const item = state.rows.find(row => row.id === match[1]); assert.ok(item); assert.ok(item.current && !item.conflict);
    if (match[2] === 'file') {
      assert.equal(method, 'GET'); item.opened = true;
      return route.fulfill({ contentType: 'text/plain', body: 'Synthetic exact PDF route response; PDF bytes are not under test.' });
    }
    assert.equal(method, 'POST'); assert.ok(item.opened); assert.deepEqual(route.request().postDataJSON(), { confirmed: true });
    state.posts.push(match[1]); item.acknowledged_at = '2026-10-16T12:00:00Z'; return route.fulfill({ json: {} });
  });
  return state;
}
test('My Documents real Chromium reading filters with synthetic guarded responses', { timeout: 150000 }, async t => {
  const runtime = await prepare(), base = `http://127.0.0.1:${await port()}`, log = [], results = [];
  const server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', new URL(base).port], {
    cwd: runtime, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', c => log.push(c.toString())); server.stderr.on('data', c => log.push(c.toString())); let browser;
  try {
    for (let i = 0; i < 150; i++) { if (server.exitCode !== null) throw new Error(log.join('')); try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
    browser = await chromium.launch({ headless: true });
    for (const width of [390, 1280]) await t.test(`combined filters, grouped versions, actions, keyboard and layout at ${width}px`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 844 } }), page = await context.newPage(); page.setDefaultTimeout(8000);
      const state = await simulation(context), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(base); await page.getByRole('status').filter({ hasText: 'Showing 8 of 8' }).waitFor();
      const initialCalls = state.calls.length, search = page.getByRole('searchbox', { name: 'Search documents' }), status = page.getByLabel('Reading status', { exact: true }), clear = page.getByRole('button', { name: 'Clear filters' });
      assert.equal(await page.getByRole('article').count(), 8); assert.equal(await clear.isDisabled(), true);
      await capture(page, `all-${width}`, results);
      await search.focus(); await page.keyboard.press('Tab'); assert.equal(await status.evaluate(el => el === document.activeElement), true);
      for (const [value, count] of [['CONFLICT', 2], ['HISTORICAL', 1], ['ACKNOWLEDGED', 1], ['OPENED', 2], ['NOT_OPENED', 2]]) {
        await status.selectOption(value); await page.getByRole('status').filter({ hasText: `Showing ${count} of 8` }).waitFor();
        assert.equal(await page.getByRole('article').count(), count);
        if (value === 'CONFLICT' || value === 'HISTORICAL') {
          assert.equal(await page.getByRole('link', { name: 'Open exact PDF' }).count(), 0);
          assert.equal(await page.getByRole('button', { name: /^Acknowledge version/ }).count(), 0);
          await capture(page, `${value.toLowerCase()}-${width}`, results);
        }
      }
      await status.selectOption('OPENED'); await search.fill(' STADIUM EVENT '); await page.getByRole('status').filter({ hasText: 'Showing 1 of 8' }).waitFor();
      const card = page.getByRole('article'); assert.match(await card.innerText(), /Synthetic grouped instructions/);
      const link = card.getByRole('link', { name: 'Open exact PDF' }); assert.equal(await link.getAttribute('href'), `/api/operational-documents/my/${uuid(2)}/file`);
      const ack = card.getByRole('button', { name: 'Acknowledge version 1', exact: true }); assert.equal(await ack.isDisabled(), true);
      await capture(page, `grouped-context-${width}`, results);
      await search.fill(uuid(201)); await page.getByText('No matching documents.', { exact: false }).waitFor(); assert.equal(await page.getByRole('article').count(), 0);
      await search.fill('Restricted policy absent from this projection'); await page.getByText('No matching documents.', { exact: false }).waitFor();
      await capture(page, `no-match-${width}`, results); await clear.focus(); await page.keyboard.press('Enter');
      await page.getByRole('status').filter({ hasText: 'Showing 8 of 8' }).waitFor();
      assert.equal(await search.inputValue(), ''); assert.equal(await status.inputValue(), 'ALL'); assert.equal(state.calls.length, initialCalls); assert.deepEqual(state.posts, []);
      assert.deepEqual(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), query: location.search, hash: location.hash })), { local: [], session: [], query: '', hash: '' });
      await status.selectOption('OPENED'); await search.fill('stadium event');
      const popupWait = context.waitForEvent('page'); await link.focus(); await page.keyboard.press('Enter'); const popup = await popupWait;
      await popup.waitForLoadState(); assert.equal(new URL(popup.url()).pathname, `/api/operational-documents/my/${uuid(2)}/file`); await popup.close();
      // Opening remains distinct from explicit acknowledgement. Keep the original exact-assignment action and confirmation gate.
      assert.deepEqual(state.posts, []); await card.getByRole('checkbox', { name: 'I acknowledge this exact version' }).check(); assert.equal(await ack.isDisabled(), false);
      await ack.click(); await page.getByRole('status').filter({ hasText: 'Acknowledgement recorded for this version' }).waitFor();
      assert.deepEqual(state.posts, [uuid(2)]); await page.getByText('No matching documents.', { exact: false }).waitFor();
      await status.selectOption('ACKNOWLEDGED'); await page.getByRole('status').filter({ hasText: 'Showing 1 of 8' }).waitFor();
      assert.equal(await page.getByRole('button', { name: /^Acknowledge version/ }).count(), 0);
      await capture(page, `acknowledged-${width}`, results);
      assert.deepEqual(errors, []); assert.deepEqual(state.external, []); await context.close();
    });
    await t.test('loading, empty, restricted projection and unavailable results at 390px', async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage(); page.setDefaultTimeout(8000);
      const state = await simulation(context, []); state.mode = 'loading';
      await page.goto(base); await page.getByRole('status').filter({ hasText: 'Loading your reading list' }).waitFor();
      assert.equal(await page.getByRole('search').count(), 0); assert.equal(await page.getByText('No current operational documents', { exact: false }).count(), 0);
      await capture(page, 'loading-390', results); state.mode = 'ready'; state.release();
      await page.getByText('No current operational documents or acknowledgement history.', { exact: true }).waitFor();
      await capture(page, 'empty-390', results); await page.getByRole('searchbox').fill('Restricted unseen title');
      await page.getByText('No matching documents.', { exact: false }).waitFor(); assert.deepEqual(state.posts, []);
      for (const mode of ['denied', 'error']) {
        state.mode = mode; await page.reload(); await page.getByRole('alert').waitFor(); await page.getByText('Reading list unavailable.', { exact: false }).waitFor();
        assert.equal(await page.getByRole('article').count(), 0); assert.equal(await page.getByRole('search').count(), 0);
        assert.equal(await page.getByRole('status').filter({ hasText: 'Showing' }).count(), 0);
        await capture(page, `${mode}-390`, results);
      }
      assert.deepEqual(state.external, []); await context.close();
    });
  } finally {
    await browser?.close(); server.kill('SIGTERM'); await Promise.race([once(server, 'exit'), new Promise(r => setTimeout(r, 2000))]);
    await writeFile(join(evidence, 'layout-results.json'), JSON.stringify(results, null, 2) + '\n');
    await writeFile(join(evidence, 'fixture-server.log'), log.join('').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\t/g, '  ').trimEnd() + '\n');
  }
});
