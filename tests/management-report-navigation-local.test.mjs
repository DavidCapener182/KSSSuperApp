import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function modules(role = 'OFFICE_ADMIN') {
  const cache = new Map();
  const mocks = {
    '@/lib/auth/principal': { isUuid: value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value), getPrincipal: async () => role ? { roles: [role] } : null },
    '@/lib/auth/capabilities': { hasCapability: () => role !== 'SECURITY_STAFF' },
    '@/lib/supabase/server': { createServerSupabase: async () => ({ rpc: () => { throw new Error('No RPC permitted in local page verification'); } }) },
    '@/lib/auth/return-target': { safeReturnTarget: value => typeof value === 'string' && value.startsWith('/control-room?') ? value : undefined },
    '@/components/events-client': { EventsClient: () => null },
    '@/components/site-service-detail-client': { SiteServiceDetailClient: () => null },
    '@/components/management-reports-client': { ManagementReportsClient: () => null },
    'next/link': { default: 'a', __esModule: true },
    'next/navigation': { notFound: () => { throw new Error('NOT_FOUND'); }, redirect: value => { throw new Error(`REDIRECT:${value}`); } },
  };
  function load(path) {
    const absolute = resolve(root, path);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const loaded = { exports: {} }; cache.set(absolute, loaded);
    const js = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const localRequire = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
      if (name === 'react/jsx-runtime') return require(name);
      throw new Error(`Unmocked module ${name}`);
    };
    new vm.Script(js, { filename: absolute }).runInNewContext({ require: localRequire, module: loaded, exports: loaded.exports, URL, URLSearchParams });
    return loaded.exports;
  }
  return { load, nav: load('src/lib/reports/navigation.ts') };
}
const nav = modules().nav;
const parse = query => nav.parseReportNavigation(new URLSearchParams(query), '2026-10-16');

test('defaults, presets and canonical query retain mode, page, filters and selected measure', () => {
  const state = parse(`preset=custom&mode=HISTORICAL&start=2026-10-01&end=2026-10-16&site=${id(1)}&event=${id(2)}&source=EVENT&offset=30&measure=REMAINING`);
  assert.ok(state); assert.equal(state.end, '2026-10-16');
  assert.deepEqual(JSON.parse(JSON.stringify(parse(nav.reportNavigationQuery(state)))), JSON.parse(JSON.stringify(state)));
  const api = new URLSearchParams(nav.reportApiQuery(state));
  assert.equal(api.get('end'), '2026-10-17'); assert.equal(api.has('measure'), false); assert.equal(api.get('offset'), '30');
  assert.equal(parse('').preset, 'last28'); assert.equal(parse('preset=today').start, '2026-10-16'); assert.equal(parse('preset=last7').start, '2026-10-10');
});

for (const [name, query] of [
  ['invalid date', 'preset=custom&start=2026-02-30&end=2026-03-01'],
  ['reversed range', 'preset=custom&start=2026-10-17&end=2026-10-16'],
  ['91 inclusive days', 'preset=custom&start=2026-01-01&end=2026-04-01'],
  ['extreme end', 'preset=custom&start=9999-12-01&end=9999-12-31'],
  ['unbounded custom', 'preset=custom'], ['wrong preset', 'preset=year'], ['wrong mode', 'mode=HISTORY'],
  ['wrong UUID', 'site=hidden'], ['wrong source', 'source=PERSON'], ['wrong measure', 'measure=PAYROLL'],
  ['non-page offset', 'offset=1'], ['negative page', 'offset=-30'], ['beyond bound', 'offset=10020'],
  ['exponent offset', 'offset=3e1'], ['duplicate parameter', 'mode=CURRENT&mode=HISTORICAL'],
  ['unknown parameter', 'returnTo=https://example.test'], ['unexpected dates', 'preset=today&start=2026-10-16'],
]) test(`invalid navigation fails closed: ${name}`, () => assert.equal(parse(query), null));

test('inclusive 90-day and DST dates translate by calendar day without UTC-duration assumptions', () => {
  assert.ok(parse('preset=custom&start=2026-01-01&end=2026-03-31'));
  for (const date of ['2026-03-29', '2026-10-25']) {
    const state = parse(`preset=custom&start=${date}&end=${date}`); assert.ok(state);
    assert.equal(new URLSearchParams(nav.reportApiQuery(state)).get('start'), date);
  }
  assert.equal(parse('offset=9990').offset, 9990);
  assert.equal(nav.parseReportNavigation({ site: [id(1), id(2)] }), null);
});

for (const value of ['https://example.test/management-reports', '//example.test/management-reports', '/management-reports/extra', '/management-reports#lines',
  '/management-reports?returnTo=/events', '/management-reports?mode=CURRENT&mode=HISTORICAL', '/%6danagement-reports', '/management-reports%3Fpreset=today',
  '/management-reports?preset=%74oday', '/management-reports?source=EVENT%2526mode=HISTORICAL', '/management-reports\\other', ['/management-reports'], null]) {
  test(`unsafe report return rejected: ${JSON.stringify(value)}`, () => assert.equal(nav.safeReportReturn(value), undefined));
}

test('safe source links preserve exact typed source identity and validated canonical report return', () => {
  const state = parse(`site=${id(1)}&offset=60&measure=REQUIRED`);
  for (const source of ['EVENT', 'SITE_SHIFT']) {
    const href = nav.reportSourceHref({ source, source_id: id(2), parent_id: id(3), site_id: id(1) }, state);
    const url = new URL(href, 'http://local');
    assert.equal(url.pathname, source === 'EVENT' ? `/events/${id(3)}` : `/sites/${id(1)}/services/${id(3)}`);
    assert.equal(url.searchParams.get(source === 'EVENT' ? 'requirement' : 'demand'), id(2));
    assert.equal(nav.safeReportReturn(url.searchParams.get('reportReturn')), nav.reportHref(state));
  }
  assert.equal(nav.reportSourceHref({ source: 'PERSON', source_id: id(2), parent_id: id(3), site_id: id(1) }, state), null);
});

function links(node) {
  if (!node || typeof node !== 'object') return [];
  const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
  return [...(node.type === 'a' ? [node] : []), ...children.flat(Infinity).flatMap(links)];
}
const pages = ['src/app/(enterprise)/events/[id]/page.tsx', 'src/app/(enterprise)/sites/[siteId]/services/[serviceId]/page.tsx'];
const params = Promise.resolve({ id: id(1), siteId: id(2), serviceId: id(3) });
for (const page of pages) test(`authorized source page preserves other returns and rejects array/unsafe reportReturn: ${page}`, async () => {
  const state = parse('preset=today&offset=30&measure=ACCEPTED'), safe = nav.reportHref(state);
  const load = modules().load(page).default;
  const good = await load({ params, searchParams: Promise.resolve({ reportReturn: safe, returnTo: '/control-room?day=2026-10-16' }) });
  const hrefs = links(good).map(link => link.props.href);
  assert.ok(hrefs.includes(safe)); assert.ok(hrefs.includes('/control-room?day=2026-10-16'));
  for (const reportReturn of [[safe, safe], '//example.test', '/management-reports?offset=1']) {
    const tree = await load({ params, searchParams: Promise.resolve({ reportReturn }) });
    assert.ok(!links(tree).some(link => String(link.props.href).startsWith('/management-reports')));
  }
  const operations = await modules('OPERATIONS').load(page).default({ params, searchParams: Promise.resolve({ reportReturn: safe }) });
  assert.ok(!links(operations).some(link => link.props.href === safe));
});

test('report page validates malformed URL before client reporting read, retains role/auth gates', async () => {
  const page = 'src/app/(enterprise)/management-reports/page.tsx';
  const invalid = await modules().load(page).default({ searchParams: Promise.resolve({ offset: '1' }) });
  assert.equal(invalid.props.invalidQuery, true);
  const valid = await modules().load(page).default({ searchParams: Promise.resolve({ preset: 'today' }) });
  assert.equal(valid.props.initial.preset, 'today');
  await assert.rejects(modules('SECURITY_STAFF').load(page).default({ searchParams: Promise.resolve({}) }), /NOT_FOUND/);
  await assert.rejects(modules(null).load(page).default({ searchParams: Promise.resolve({}) }), /REDIRECT/);
});
