import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
const sourceRoot = process.env.KSS_ATTENDANCE_SOURCE_ROOT || new URL('../', import.meta.url).pathname;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n, source = 'EVENT') => ({ source, allocation_id: id(n), status: 'ACCEPTED', self_action_available: true,
  event_name: `Synthetic attendance ${n}`, site_name: 'Synthetic site', role_name: 'Guard', area_label: 'Gate', service_date: '2026-10-17',
  report_at: '2026-10-17T08:00:00Z', shift_starts_at: '2026-10-17T09:00:00Z', shift_ends_at: '2026-10-17T17:00:00Z',
  attendance: { revision: 0, state: 'NOT_RECORDED', check_in_at: null, check_out_at: null, events: [] } });
const json = (items = [], total = items.length, ok = true) => ({ ok, json: async () => ({ attendance: { items, total } }) });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
function harness(fetcher, props = {}) {
  let cursor = 0, mounted = true, afterUnmount = 0; const hooks = [], effects = [], listeners = new Map(), storage = new Map();
  const same = (a, b) => a?.length === b?.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(value) { const i = cursor++; hooks[i] ??= { value: typeof value === 'function' ? value() : value }; return [hooks[i].value, next => {
      if (!mounted) afterUnmount++; hooks[i].value = typeof next === 'function' ? next(hooks[i].value) : next;
    }]; },
    useRef(value) { const i = cursor++; return hooks[i] ??= { current: value }; },
    useCallback(fn, deps) { const i = cursor++; if (!same(hooks[i]?.deps, deps)) hooks[i] = { fn, deps }; return hooks[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!same(hooks[i]?.deps, deps)) { const old = hooks[i]; effects.push(() => { old?.cleanup?.(); hooks[i] = { deps, cleanup: fn() }; }); } },
  };
  const element = (type, props, key) => ({ type, props, key });
  const mocks = { react, 'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
    'next/link': { __esModule: true, default: 'a' }, '@/components/ui/button': { Button: 'button' },
    './attendance.module.css': { __esModule: true, default: {} }, './attendance-self.module.css': { __esModule: true, default: {} } };
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(sourceRoot, 'src/components/my-attendance-client.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, require: name => { assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; },
    fetch: (url, options) => { assert.ok(['GET', 'POST'].includes(options?.method ?? 'GET')); return fetcher(url, options); }, URLSearchParams, Date, setTimeout, clearTimeout,
    crypto: { randomUUID: () => id(99) }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { visibilityState: 'visible', addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); } },
  });
  const render = () => { cursor = 0; const tree = loaded.exports.MyAttendanceClient(props); effects.splice(0).forEach(fn => fn()); return tree; };
  const settle = async () => { for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 2)); render(); } };
  return { render, settle, async setProps(value) { props = value; render(); await settle(); }, async mount() { render(); await settle(); },
    act() { nodes(render()).find(n => n.type === 'button' && text(n) === 'Check In').props.onClick(); },
    refresh() { nodes(render()).find(n => n.type === 'button' && text(n) === 'Refresh').props.onClick(); },
    more() { nodes(render()).find(n => n.type === 'button' && text(n) === 'Load more attendance').props.onClick(); },
    unmount() { hooks.forEach(h => h?.cleanup?.()); mounted = false; }, afterUnmount: () => afterUnmount };
}
test('denied or unavailable later page removes previous attendance cards/actions and totals', async () => {
  let calls = 0; const h = harness(async () => ++calls === 1 ? json([row(1)], 26) : json([], 0, false));
  await h.mount(); assert.match(text(h.render()), /Synthetic attendance 1/); h.more(); await h.settle();
  assert.match(text(h.render()), /unavailable/i); assert.doesNotMatch(text(h.render()), /Synthetic attendance 1|Check In|Showing 1 of|No allocations are available/);
  h.unmount();
});
test('late old exact-focus response cannot replace current source/allocation', async () => {
  const slow = deferred(); const h = harness(async url => new URL(url, 'http://fixture.invalid').searchParams.get('allocationId') === id(1) ? slow.promise : json([row(2, 'SITE_SHIFT')]), { allocationId: id(1), source: 'EVENT' });
  await h.mount(); await h.setProps({ allocationId: id(2), source: 'SITE_SHIFT' }); assert.match(text(h.render()), /Synthetic attendance 2/);
  slow.resolve(json([row(1)])); await h.settle(); assert.match(text(h.render()), /Synthetic attendance 2/); assert.doesNotMatch(text(h.render()), /Synthetic attendance 1/); h.unmount();
});
test('unmount invalidates pending attendance read', async () => {
  const slow = deferred(); const h = harness(() => slow.promise); await h.mount(); h.unmount(); slow.resolve(json([row(1)]));
  await new Promise(r => setTimeout(r, 5)); assert.equal(h.afterUnmount(), 0);
});
test('focused attendance rejects a wrong source or allocation even when response is successful', async () => {
  for (const wrong of [row(2), row(1, 'SITE_SHIFT')]) {
    const h = harness(async () => json([wrong]), { allocationId: id(1), source: 'EVENT' }); await h.mount();
    assert.doesNotMatch(text(h.render()), /Synthetic attendance|Check In/); assert.match(text(h.render()), /unavailable|not available/i); h.unmount();
  }
});
test('pagination deduplicates exact source pairs and preserves Event/SiteShift distinction', async () => {
  let calls = 0; const h = harness(async () => ++calls === 1 ? json([row(1)], 26) : json([row(1), row(1, 'SITE_SHIFT')], 26));
  await h.mount(); h.more(); await h.settle(); assert.equal(nodes(h.render()).filter(n => n.type === 'article').length, 2); h.unmount();
});
function route(principal, rpcResult = { data: { items: [], total: 0 }, error: null }) {
  const loaded = { exports: {} }, calls = [];
  const mocks = {
    '@/lib/auth/principal': { getPrincipal: async () => principal, isUuid: value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) },
    '@/lib/auth/responses': { privateJson: (body, status = 200) => ({ body, status }), unauthorised: () => ({ status: 401 }), forbidden: () => ({ status: 403 }) },
    '@/lib/supabase/server': { createServerSupabase: async () => ({ rpc: async (...args) => { calls.push(args); return rpcResult; } }) },
  };
  const js = ts.transpileModule(readFileSync(resolve(sourceRoot, 'src/app/api/attendance/me/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(js).runInNewContext({ module: loaded, exports: loaded.exports, URL, require: name => { assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; } });
  return { calls, get: query => loaded.exports.GET({ url: `http://fixture.invalid/api/attendance/me${query}` }) };
}
test('actual attendance GET route denies missing principal and non-Staff roles before RPC', async () => {
  for (const principal of [null, { roles: [] }, { roles: ['OPERATIONS'] }, { roles: ['OFFICE_ADMIN'] }, { roles: ['SUPER_ADMIN'] }]) {
    const h = route(principal); assert.equal((await h.get('')).status, principal ? 403 : 401); assert.equal(h.calls.length, 0);
  }
});
test('actual attendance GET validates exact source/offset and forwards typed scope without client authority', async () => {
  for (const query of ['?source=SITE_SHIFT', '?allocationId=guessed', `?allocationId=${id(1)}&offset=25`, `?allocationId=${id(1)}&source=OTHER`, '?offset=-1', '?offset=10001']) {
    const h = route({ roles: ['SECURITY_STAFF'] }); assert.equal((await h.get(query)).status, 400); assert.equal(h.calls.length, 0);
  }
  const h = route({ roles: ['SECURITY_STAFF'] }); assert.equal((await h.get(`?allocationId=${id(1)}&source=SITE_SHIFT`)).status, 200);
  assert.equal(h.calls[0][0], 'my_attendance_09b'); assert.equal(h.calls[0][1].p_source, 'SITE_SHIFT'); assert.equal(h.calls[0][1].p_allocation_id, id(1)); assert.equal(h.calls[0][1].p_offset, 0);
  const denied = route({ roles: ['SECURITY_STAFF'] }, { error: { message: 'Synthetic revoked source' }, data: null }); assert.equal((await denied.get('')).status, 503);
});

test('a pending action from an old exact view cannot reload old facts or announce success after navigation', async () => {
  const post = deferred(); const calls = [];
  const h = harness(async (url, options) => {
    calls.push([url, options?.method ?? 'GET']); if(options?.method === 'POST')return post.promise;
    return json([new URL(url, 'http://fixture.invalid').searchParams.get('allocationId') === id(1) ? row(1) : row(2, 'SITE_SHIFT')]);
  }, { allocationId: id(1), source: 'EVENT' });
  await h.mount(); h.act(); await h.settle(); assert.match(text(h.render()), /Recording/);
  await h.setProps({ allocationId: id(2), source: 'SITE_SHIFT' }); assert.match(text(h.render()), /Synthetic attendance 2/);
  const before = calls.length; post.resolve({ ok: true, json: async () => ({}) }); await h.settle();
  assert.equal(calls.length, before); assert.match(text(h.render()), /Synthetic attendance 2/); assert.doesNotMatch(text(h.render()), /Check-in recorded|Synthetic attendance 1/); h.unmount();
});
test('role-loss refresh following a successful POST clears prior success and cards', async () => {
  let denied = false;
  const h = harness(async (_url, options) => { if(options?.method === 'POST'){denied = true;const submitted=JSON.parse(options.body);return {ok:true,json:async()=>({result:{event_id:id(80),revision:1,replayed:false,attendance:{revision:1,state:'CHECKED_IN',check_in_at:submitted.actualAt,check_out_at:null,events:[{id:id(80),revision:1,type:'CHECK_IN',actual_at:submitted.actualAt,actor_mode:'STAFF_SELF',method:'AUTHENTICATED_ONLINE'}]}}})};} return denied ? json([],0,false) : json([row(1)]); });
  await h.mount(); h.act(); await h.settle(); assert.match(text(h.render()), /could not be confirmed/i); assert.doesNotMatch(text(h.render()), /Check-in recorded|Synthetic attendance|Check In/); h.unmount();
});
test('old denied focus cannot clear new facts; pending current read keeps actions hidden', async () => {
  const first = deferred(), second = deferred();
  const h = harness(async url => new URL(url, 'http://fixture.invalid').searchParams.get('allocationId') === id(1) ? first.promise : second.promise, {allocationId:id(1),source:'EVENT'});
  await h.mount(); await h.setProps({allocationId:id(2),source:'SITE_SHIFT'}); first.resolve(json([],0,false)); await h.settle();
  assert.match(text(h.render()), /Loading your attendance/); assert.doesNotMatch(text(h.render()), /unavailable|Check In/);
  second.resolve(json([row(2,'SITE_SHIFT')])); await h.settle();assert.match(text(h.render()), /Synthetic attendance 2/);assert.doesNotMatch(text(h.render()), /unavailable/); h.unmount();
});
