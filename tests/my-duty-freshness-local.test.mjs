import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as week from '../src/lib/events/workforce-week.ts';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n, status = 'ALLOCATED') => ({ id: id(n), source: n === 1 ? 'EVENT' : 'SITE_SHIFT', status,
  event_name: `Synthetic duty ${n}`, site_name: 'Synthetic site', role_name: 'Guard', area_label: 'Entrance',
  service_date: '2099-01-01', report_at: '2099-01-01T08:00:00Z', shift_starts_at: '2099-01-01T09:00:00Z', shift_ends_at: '2099-01-01T17:00:00Z' });
const a = row(1), b = row(2);
const json = (value, ok = true) => ({ ok, json: async () => value });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
function harness(fetcher, focus = { id: a.id, source: a.source }) {
  let cursor = 0, mounted = true, afterUnmount = 0; const hooks = [], effects = [], listeners = new Map();
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
    'next/link': { __esModule: true, default: 'a' }, '@/lib/events/workforce-week': week,
    '@/app/(enterprise)/my-duty/my-duty.module.css': { __esModule: true, default: {} } };
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL('../src/components/my-duty-client.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, require: name => { assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; },
    fetch: (url, options) => { assert.equal(options?.method ?? 'GET', 'GET'); return fetcher(url, options); }, URLSearchParams, Date, setTimeout, clearTimeout,
    document: { visibilityState: 'visible', addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); } },
  });
  const render = () => { cursor = 0; const tree = loaded.exports.MyDutyClient({ focus }); effects.splice(0).forEach(fn => fn()); return tree; };
  const settle = async () => { for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 2)); render(); } };
  return { render, settle, async setFocus(value) { focus = value; render(); await settle(); }, async mount() { render(); await settle(); }, async choose(item) {
    nodes(render()).find(n => n.type === 'select').props.onChange({ target: { value: item ? `${item.source}:${item.id}` : '' } }); render(); await settle();
  }, refresh() { listeners.get('visibilitychange')?.(); }, unmount() { hooks.forEach(h => h?.cleanup?.()); mounted = false; }, afterUnmount: () => afterUnmount };
}
const title = h => nodes(h.render()).find(n => n.props?.id === 'duty-title')?.props.children;
const picker = h => nodes(h.render()).find(n => n.type === 'select');
function api(details, attendance = async () => json({ attendance: { items: [] } })) {
  return async url => {
    const parsed = new URL(url, 'http://fixture.invalid');
    if (parsed.pathname === '/api/my-schedule') return json({ schedule: { work: [a, b], work_total: 2 } });
    if (parsed.pathname === '/api/deployments/me') return details(parsed.searchParams.get('allocationId'));
    if (parsed.pathname === '/api/attendance/me') return attendance(parsed.searchParams.get('allocationId'));
    throw new Error(`Unexpected endpoint ${parsed.pathname}`);
  };
}
test('late first allocation cannot replace fast second selected duty or its exact links', async () => {
  const slow = deferred(); const h = harness(api(async key => key === a.id ? slow.promise : json({ deployments: { items: [b] } })));
  await h.mount(); assert.match(text(h.render()), /Checking this duty/);
  await h.choose(b); assert.equal(title(h), b.event_name);
  slow.resolve(json({ deployments: { items: [a] } })); await h.settle();
  assert.equal(picker(h).props.value, `${b.source}:${b.id}`); assert.equal(title(h), b.event_name);
  assert.ok(nodes(h.render()).some(n => n.props?.href === `/my-deployments?allocationId=${b.id}&source=${b.source}`)); h.unmount();
});
test('late first attendance cannot attach its checked-in state to second duty', async () => {
  const slow = deferred(); const first = row(1, 'ACCEPTED'), second = row(2, 'ACCEPTED');
  const h = harness(api(async key => json({ deployments: { items: [key === a.id ? first : second] } }), async key => key === a.id ? slow.promise : json({ attendance: { items: [{ source: b.source, allocation_id: b.id, attendance: { state: 'NONE', check_in_at: null, check_out_at: null } }] } })));
  await h.mount(); await h.choose(b); assert.equal(title(h), b.event_name); assert.doesNotMatch(text(h.render()), /On duty/);
  slow.resolve(json({ attendance: { items: [{ source: a.source, allocation_id: a.id, attendance: { state: 'IN', check_in_at: '2099-01-01T09:00:00Z', check_out_at: null } }] } })); await h.settle();
  assert.equal(title(h), b.event_name); assert.doesNotMatch(text(h.render()), /On duty|Checked in/); h.unmount();
});
test('clearing selection immediately removes completed details and ignores an in-flight response', async () => {
  const slow = deferred(); let refresh = false;
  const h = harness(api(async () => refresh ? slow.promise : json({ deployments: { items: [a] } })));
  await h.mount(); assert.equal(title(h), a.event_name); refresh = true; h.refresh(); await h.choose(null);
  assert.equal(title(h), undefined); slow.resolve(json({ deployments: { items: [a] } })); await h.settle();
  assert.equal(title(h), undefined); assert.match(text(h.render()), /No current or upcoming duty/); h.unmount();
});
test('old denied response cannot hide a newer confirmed selection', async () => {
  const slow = deferred(); const h = harness(api(async key => key === a.id ? slow.promise : json({ deployments: { items: [b] } })));
  await h.mount(); await h.choose(b); slow.resolve(json({}, false)); await h.settle();
  assert.equal(title(h), b.event_name); assert.doesNotMatch(text(h.render()), /could not be confirmed/); h.unmount();
});
test('new denied response clears details and unmount invalidates in-flight allocation', async () => {
  let mode = 'normal'; const slow = deferred();
  const h = harness(api(async () => mode === 'normal' ? json({ deployments: { items: [a] } }) : mode === 'denied' ? json({}, false) : slow.promise));
  await h.mount(); mode = 'denied'; h.refresh(); await h.settle(); assert.equal(title(h), undefined); assert.match(text(h.render()), /could not be confirmed/);
  mode = 'slow'; h.refresh(); h.unmount(); slow.resolve(json({ deployments: { items: [a] } })); await new Promise(r => setTimeout(r, 5));
  assert.equal(h.afterUnmount(), 0);
});
test('older same-duty refresh cannot clear loading or replace a newer response', async () => {
  const first = deferred(), second = deferred(); let calls = 0;
  const h = harness(api(async () => ++calls === 1 ? json({ deployments: { items: [a] } }) : calls === 2 ? first.promise : second.promise));
  await h.mount(); h.refresh(); h.refresh();
  first.resolve(json({ deployments: { items: [{ ...a, event_name: 'Stale name' }] } })); await h.settle();
  assert.equal(title(h), undefined); assert.match(text(h.render()), /Checking this duty/);
  second.resolve(json({ deployments: { items: [{ ...a, event_name: 'Current name' }] } })); await h.settle();
  assert.equal(title(h), 'Current name'); assert.doesNotMatch(text(h.render()), /Checking this duty|Stale name/); h.unmount();
});
test('latest unavailable attendance hides partial facts; retry can recover exact accepted duty', async () => {
  const accepted = row(1, 'ACCEPTED'); let denied = true;
  const h = harness(api(async () => json({ deployments: { items: [accepted] } }), async () => denied ? json({}, false) : json({ attendance: { items: [{ source: a.source, allocation_id: a.id, attendance: { state: 'NONE', check_in_at: null, check_out_at: null } }] } })));
  await h.mount(); assert.equal(title(h), undefined); assert.match(text(h.render()), /attendance is unavailable/);
  denied = false; nodes(h.render()).find(n => n.type === 'button' && text(n) === 'Retry').props.onClick(); await h.settle();
  assert.equal(title(h), a.event_name); assert.doesNotMatch(text(h.render()), /attendance is unavailable/); h.unmount();
});
test('unmount ignores pending attendance and pending schedule-list responses', async () => {
  const slow = deferred();
  const h = harness(api(async () => json({ deployments: { items: [row(1, 'ACCEPTED')] } }), async () => slow.promise));
  await h.mount(); h.unmount(); slow.resolve(json({ attendance: { items: [{ source: a.source, allocation_id: a.id, attendance: { state: 'IN', check_in_at: '2099-01-01T09:00:00Z', check_out_at: null } }] } }));
  await new Promise(r => setTimeout(r, 5)); assert.equal(h.afterUnmount(), 0);
  const schedule = deferred(); const pending = harness(async () => schedule.promise, undefined);
  await pending.mount(); pending.unmount(); schedule.resolve(json({ schedule: { work: [a, b], work_total: 2 } }));
  await new Promise(r => setTimeout(r, 5)); assert.equal(pending.afterUnmount(), 0);
});

test('same mounted component follows a new exact focus prop after route navigation', async () => {
  const h = harness(api(async key => json({ deployments: { items: [key === a.id ? a : b] } })));
  await h.mount(); assert.equal(title(h), a.event_name);
  await h.setFocus({ id: b.id, source: b.source });
  assert.equal(picker(h).props.value, `${b.source}:${b.id}`); assert.equal(title(h), b.event_name); h.unmount();
});
test('new exact focus invalidates a prior pending focus request and manual selection still works', async () => {
  const slow = deferred(); let pending = true;
  const h = harness(api(async key => key === a.id && pending ? slow.promise : json({ deployments: { items: [key === a.id ? a : b] } })));
  await h.mount(); await h.setFocus({ id: b.id, source: b.source }); assert.equal(title(h), b.event_name);
  slow.resolve(json({ deployments: { items: [a] } })); await h.settle(); assert.equal(title(h), b.event_name);
  pending = false; await h.choose(a); assert.equal(title(h), a.event_name); h.unmount();
});
test('default upcoming selection and exact source mismatch keep existing source semantics', async () => {
  const h = harness(api(async key => json({ deployments: { items: [key === a.id ? a : b] } })), null);
  await h.mount(); assert.equal(title(h), a.event_name); h.unmount();
  const wrong = harness(api(async () => json({ deployments: { items: [{ ...a, source: 'SITE_SHIFT' }] } })));
  await wrong.mount(); assert.equal(title(wrong), undefined); assert.match(text(wrong.render()), /not available in your own duty records/); wrong.unmount();
});
