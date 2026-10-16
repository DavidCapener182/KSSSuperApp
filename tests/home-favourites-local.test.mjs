import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
const require = createRequire(import.meta.url), ts = require('typescript');
const root = new URL('../', import.meta.url);
function load(file, mocks = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new vm.Script(code, { filename: file }).runInNewContext({ module: loaded, exports: loaded.exports, Set, JSON, Date, Intl, require: name => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return loaded.exports;
}
const helper = load('src/lib/home-favourites.ts');
const entries = [{ href: '/app', label: 'Home' }, { href: '/events', label: 'Events' }, { href: '/sites', label: 'Sites' }];
const plain = value => JSON.parse(JSON.stringify(value));
const accountA = '00000000-0000-4000-8000-000000000001', accountB = '00000000-0000-4000-8000-000000000002';
test('versioned stable identity keys separate accounts without a global fallback', () => {
  assert.notEqual(helper.favouritesKey(accountA), helper.favouritesKey(accountB));
  assert.equal(helper.favouritesKey(accountA.toUpperCase()), helper.favouritesKey(accountA));
  for (const bad of ['', 'undefined', 'person/name', '../account', 'private name']) assert.equal(helper.favouritesKey(bad), null);
});
test('saved links are exact allowed static module paths, deduplicated with no private payload', () => {
  assert.deepEqual(plain(helper.readFavourites(JSON.stringify(['/events', '/events', '/sites', '/app', '/people', '/events/record', '/events?id=private', '//evil.test', 'https://evil.test', { href: '/events', label: 'private' }]), entries)), ['/events', '/sites']);
});
for (const raw of [null, '', 'bad JSON', '{}', 'null', '"/events"', '[]', 'x'.repeat(8193), JSON.stringify(Array(65).fill('/events'))]) test(`malformed/empty/bounded preference fails safely (${String(raw).slice(0, 15)})`, () => assert.deepEqual(plain(helper.readFavourites(raw, entries)), []));
test('role removal immediately removes saved paths and empty authority yields no links', () => {
  assert.deepEqual(plain(helper.allowedFavourites(['/events', '/sites'], [{ href: '/sites', label: 'Current site label' }])), ['/sites']);
  assert.deepEqual(plain(helper.allowedFavourites(['/events'], [])), []);
});
test('module candidates reject URLs, records with queries, Home and duplicate paths', () => {
  assert.deepEqual(plain(helper.favouriteModules([...entries, { href: '/events', label: 'old label' }, { href: 'https://evil.test', label: 'bad' }, { href: '/events?record=private', label: 'bad' }, { href: '/%65vents', label: 'bad' }]).map(x => x.href)), ['/events', '/sites']);
});
test('current server navigation is the only client candidate source; existing Home sections retained', async () => {
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const Nav = [{ href: '/app', label: 'Home' }, { href: '/sites', label: 'Sites' }];
  const rpcCalls = [];
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'next/link': { default: 'Link' }, 'next/navigation': { redirect: path => { throw new Error(`redirect:${path}`); } },
    '@/lib/auth/capabilities': { navigationFor: () => Nav },
    '@/lib/auth/principal': { getPrincipal: async () => ({ personId: accountA, displayName: 'Synthetic Staff', roles: ['SECURITY_STAFF'] }) },
    '@/lib/supabase/server': { createServerSupabase: async () => ({ rpc: async name => { rpcCalls.push(name); return { data: {} }; } }) },
    '@/lib/tasks/policy': { listTasks: async () => { throw new Error('Staff cannot read task service'); } },
    '@/components/external-app-shortcuts': { ExternalAppShortcuts: 'ExternalAppShortcuts' },
    '@/components/home-favourites': { HomeFavourites: 'HomeFavourites' },
    './home.module.css': { default: new Proxy({}, { get: (_, key) => key }) },
  };
  const tree = await load('src/app/(enterprise)/app/page.tsx', mocks).default();
  const nodes = []; function walk(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); nodes.push(node); walk(node.props?.children); } walk(tree);
  const favourite = nodes.find(node => node.type === 'HomeFavourites');
  assert.equal(favourite.props.accountId, accountA); assert.equal(favourite.key, accountA); assert.equal(favourite.props.entries, Nav);
  assert.deepEqual(rpcCalls, ['training_capabilities', 'training_assigner_access']);
  assert.ok(nodes.some(node => node.type === 'ExternalAppShortcuts'));
  assert.ok(nodes.some(node => node.props?.['aria-label'] === 'Quick access'));
  assert.ok(nodes.some(node => node.props?.['aria-label'] === 'Learning'));
});
