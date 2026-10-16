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
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), output = join(root, 'output/home-favourites-20261016');
const require = createRequire(import.meta.url), { chromium } = require(process.env.KSS_PLAYWRIGHT_MODULE || 'playwright');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, key = n => `kss-home-favourites:v1:${id(n)}`;
async function prepare() {
  const runtime = await mkdtemp(join(tmpdir(), 'kss-home-favourites-fixture-'));
  const files = ['src/app/(enterprise)/app/page.tsx', 'src/app/(enterprise)/app/home.module.css', 'src/components/home-favourites.tsx', 'src/components/home-favourites.module.css', 'src/lib/home-favourites.ts', 'src/components/enterprise-shell.tsx', 'src/components/ui/button.tsx', 'src/components/ui/sheet.tsx', 'src/lib/auth/capabilities.ts', 'src/lib/auth/return-target.ts', 'src/lib/environment-label.ts', 'src/components/external-app-shortcuts.tsx', 'src/components/external-app-shortcuts.module.css', 'src/lib/external-apps.ts', 'src/app/globals.css', 'postcss.config.mjs'];
  const manifest = [];
  for (const file of files) { await mkdir(dirname(join(runtime, file)), { recursive: true }); await cp(join(root, file), join(runtime, file)); manifest.push({ file, sha256: createHash('sha256').update(await readFile(join(root, file))).digest('hex') }); }
  const save = async (file, value) => { await mkdir(dirname(join(runtime, file)), { recursive: true }); await writeFile(join(runtime, file), value); };
  await symlink(join(root, 'node_modules'), join(runtime, 'node_modules'), 'dir');
  await save('package.json', JSON.stringify({ name: 'kss-home-favourites-synthetic', private: true }));
  await save('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['dom', 'esnext'], jsx: 'react-jsx', module: 'esnext', moduleResolution: 'bundler', esModuleInterop: true, paths: { '@/*': ['./src/*'] } } }));
  await save('next.config.mjs', 'export default {devIndicators:false};');
  await save('src/lib/auth/principal.ts', `import {cookies} from 'next/headers';export async function getPrincipal(){const c=await cookies();return {personId:c.get('fixtureAccount')?.value||'${id(1)}',displayName:'Synthetic Home Reviewer',roles:[c.get('fixtureRole')?.value||'OFFICE_ADMIN'],incidentReviewer:false}}`);
  await save('src/lib/supabase/server.ts', `export const createServerSupabase=async()=>({rpc:async()=>({data:{}})});`);
  await save('src/lib/supabase/browser.ts', `export const createBrowserSupabase=()=>({auth:{signOut:async()=>({error:null})}});`);
  await save('src/lib/tasks/policy.ts', `export const listTasks=async()=>[];`);
  await save('src/app/layout.tsx', `import './globals.css';export default function Layout({children}){return <html lang="en"><body>{children}</body></html>}`);
  await save('src/app/(enterprise)/layout.tsx', `import {EnterpriseShell} from '@/components/enterprise-shell';import {getPrincipal} from '@/lib/auth/principal';import {navigationFor} from '@/lib/auth/capabilities';export default async function Layout({children}){const p=await getPrincipal();return <EnterpriseShell person={{id:p.personId,name:p.displayName}} roles={p.roles} incidentReviewer={false} navigation={navigationFor(p)}><aside style={{padding:8,background:'#fff1d7',color:'#182334'}}>Local synthetic identity and task/training boundaries · no live authentication</aside>{children}</EnterpriseShell>}`);
  await save('src/app/page.tsx', 'export default function Page(){return <h1>Local fixture ready</h1>}');
  await save('src/app/(enterprise)/sites/page.tsx', `import Link from 'next/link';export default function Page(){return <main><h1>Synthetic Sites destination</h1><Link href="/app">Return Home</Link></main>}`);
  await mkdir(output, { recursive: true }); await writeFile(join(output, 'source-manifest.json'), JSON.stringify({ baseline: 'a216616cb41899f6476b2788219f63eb0de7b5fe', runtime, manifest, mocked: ['cookie-selected principal', 'Supabase clients', 'task/training reads', '/api/me', 'Sites destination'] }, null, 2));
  return runtime;
}
async function freePort() { const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function identity(context, base, account, role) { await context.addCookies([{ name: 'fixtureAccount', value: id(account), url: base }, { name: 'fixtureRole', value: role, url: base }]); }
async function capture(page, name, layouts) { const size = await page.evaluate(() => ({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, skipLinkTop: document.querySelector('.enterprise-skip-link')?.getBoundingClientRect().top, activeTag: document.activeElement?.tagName })); assert.equal(size.viewport, size.pageWidth); layouts.push({ name, ...size }); await page.screenshot({ path: join(output, `${name}.png`), fullPage: true }); await page.screenshot({ path: join(output, `${name}-viewport.png`) }); }
async function ready(page) { const section = page.getByRole('region', { name: 'Favourites', exact: true }); await section.getByText('Loading favourites…', { exact: true }).waitFor({ state: 'hidden' }); return section; }
test('Home favourites in genuine Home and EnterpriseShell, synthetic identities only', { timeout: 240000 }, async t => {
  const runtime = await prepare(), port = await freePort(), base = `http://127.0.0.1:${port}`, log = [], layouts = [];
  const server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: runtime, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', v => log.push(v.toString())); server.stderr.on('data', v => log.push(v.toString())); let browser;
  try {
    let started = false;
    for (let i = 0; i < 150; i++) { try { if ((await fetch(base)).ok) { started = true; break; } } catch { /* startup */ } if (server.exitCode !== null) break; await new Promise(resolve => setTimeout(resolve, 200)); }
    assert.ok(started, log.join('').slice(-2000)); browser = await chromium.launch({ headless: true });
    for (const width of [390, 1280]) await t.test(`${width}px add/remove/reload/reset, safe roles and isolated accounts`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' }), page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.setDefaultTimeout(10000);
      let current = { account: 1, role: 'OFFICE_ADMIN' };
      await page.route('**/*', route => { const url = new URL(route.request().url()); if (url.hostname !== '127.0.0.1') return route.abort(); if (url.pathname === '/api/me') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ person: { id: id(current.account), name: 'Synthetic Home Reviewer' }, roles: [current.role], incidentReviewer: false }) }); return route.continue(); });
      await identity(context, base, 1, 'OFFICE_ADMIN'); await page.goto(`${base}/app`); let section = await ready(page);
      await section.getByText('No favourites yet.', { exact: false }).waitFor();
      const picker = section.locator('summary'); await picker.focus(); await page.keyboard.press('Enter');
      const events = section.getByRole('checkbox', { name: 'Events', exact: true }); await events.focus(); await page.keyboard.press('Space'); assert.equal(await events.isChecked(), true);
      await section.getByRole('checkbox', { name: 'Sites', exact: true }).check();
      assert.deepEqual(await page.evaluate(k => JSON.parse(localStorage.getItem(k)), key(1)), ['/events', '/sites']);
      await capture(page, `home-${width}-selected`, layouts);
      await page.reload(); section = await ready(page); await section.getByRole('link', { name: 'Sites', exact: true }).waitFor();
      assert.equal(await section.getByRole('link', { name: 'Events', exact: true }).getAttribute('href'), '/events');
      const remove = section.getByRole('button', { name: 'Remove Events from favourites', exact: true }); await remove.focus(); await page.keyboard.press('Enter'); assert.equal(await section.getByRole('link', { name: 'Events', exact: true }).count(), 0);
      await section.getByRole('link', { name: 'Sites', exact: true }).focus(); await page.keyboard.press('Enter'); await page.getByRole('heading', { name: 'Synthetic Sites destination', exact: true }).waitFor(); await page.getByRole('link', { name: 'Return Home', exact: true }).click(); section = await ready(page);
      await section.getByRole('button', { name: 'Clear favourites', exact: true }).click(); await page.reload(); section = await ready(page); await section.getByText('No favourites yet.', { exact: false }).waitFor();
      await page.evaluate(k => localStorage.setItem(k, JSON.stringify(['/events', '/access', '/my-schedule', '/events/secret?token=x', '//evil.test'])), key(1));
      current.role = 'SECURITY_STAFF'; await identity(context, base, 1, current.role); await page.reload(); section = await ready(page);
      await section.getByRole('link', { name: 'My Schedule', exact: true }).waitFor(); assert.equal(await section.getByRole('link', { name: 'Events', exact: true }).count(), 0); assert.deepEqual(await page.evaluate(k => JSON.parse(localStorage.getItem(k)), key(1)), ['/my-schedule']);
      await section.locator('summary').click(); assert.equal(await section.getByRole('checkbox', { name: 'Access administration', exact: true }).count(), 0); await capture(page, `home-${width}-staff`, layouts);
      current.role = 'OFFICE_ADMIN'; await identity(context, base, 1, current.role); await page.reload(); section = await ready(page); await section.getByText('No favourites yet.', { exact: false }).waitFor();
      await section.locator('summary').click(); await section.getByRole('checkbox', { name: 'Events', exact: true }).check();
      current.account = 2; await identity(context, base, 2, current.role); await page.reload(); section = await ready(page); await section.getByText('No favourites yet.', { exact: false }).waitFor(); assert.equal(await section.getByRole('link', { name: 'Events', exact: true }).count(), 0);
      await section.locator('summary').click(); await section.getByRole('checkbox', { name: 'Sites', exact: true }).check();
      current.account = 1; await identity(context, base, 1, current.role); await page.reload(); section = await ready(page); await section.getByRole('link', { name: 'Events', exact: true }).waitFor(); assert.equal(await section.getByRole('link', { name: 'Sites', exact: true }).count(), 0);
      await page.evaluate(k => localStorage.setItem(k, '{bad json'), key(1)); await page.reload(); section = await ready(page); await section.getByText('No favourites yet.', { exact: false }).waitFor(); assert.equal(await page.evaluate(k => localStorage.getItem(k), key(1)), '[]');
      await capture(page, `home-${width}-empty`, layouts); assert.deepEqual(errors, []); await context.close();
    });
    for (const failure of ['read', 'write']) await t.test(`unavailable ${failure} storage retains only this visit honestly`, async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
      await page.addInitScript(mode => { for (const method of mode === 'read' ? ['getItem', 'setItem'] : ['setItem']) { const original = Storage.prototype[method]; Storage.prototype[method] = function(k, ...args) { if (k.startsWith('kss-home-favourites:')) throw new DOMException('Synthetic unavailable storage', 'SecurityError'); return original.call(this, k, ...args); }; } }, failure);
      await page.route('**/*', route => { const url = new URL(route.request().url()); if (url.hostname !== '127.0.0.1') return route.abort(); if (url.pathname === '/api/me') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ person: { id: id(1), name: 'Synthetic Home Reviewer' }, roles: ['OFFICE_ADMIN'], incidentReviewer: false }) }); return route.continue(); });
      await page.goto(`${base}/app`); const section = await ready(page); await section.locator('summary').click(); await section.getByRole('checkbox', { name: 'Events', exact: true }).check(); await section.getByRole('link', { name: 'Events', exact: true }).waitFor(); await section.getByRole('status').getByText('Browser storage is unavailable.', { exact: false }).waitFor();
      await capture(page, `home-storage-${failure}`, layouts); await page.reload(); const fresh = await ready(page); assert.equal(await fresh.getByRole('link', { name: 'Events', exact: true }).count(), 0); await context.close();
    });
  } finally { await browser?.close(); server.kill('SIGTERM'); if (server.exitCode === null) await Promise.race([once(server, 'exit'), new Promise(resolve => setTimeout(resolve, 2000))]); await writeFile(join(output, 'layout-results.json'), JSON.stringify(layouts, null, 2)); await writeFile(join(output, 'fixture-server.log'), log.join('')); }
});
