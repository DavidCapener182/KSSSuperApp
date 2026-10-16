import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as weekDates from '../src/lib/events/workforce-week.ts';
import * as dueDates from '../src/lib/crm/due-time.ts';

// Execute the real client handlers with in-memory hook, element and HTTP boundaries.
// This proves response ordering/source identity; it does not prove browser layout or RLS.
function componentHarness(file, name, props, fetcher) {
  const hooks = [], effects = [], timers = [];
  let cursor = 0;
  const same = (a, b) => a?.length === b?.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], (value) => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!same(hooks[index]?.deps, deps)) hooks[index] = { value: fn, deps };
      return hooks[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!same(hooks[index], deps)) { hooks[index] = deps; effects.push(fn); }
    },
  };
  const element = (type, props) => ({ type, props });
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
    'next/link': { __esModule: true, default: 'a' },
    '@/components/ui/button': { Button: 'button' },
    '@/components/ui/input': { Input: 'input' },
    '@/components/ui/sheet': { Sheet: 'sheet', SheetContent: 'sheet-content', SheetTitle: 'sheet-title' },
    '@/lib/events/workforce-week': weekDates,
    '@/lib/crm/due-time': dueDates,
    './my-shift-entry.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
    './my-schedule-presentation.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  };
  const loadedModule = { exports: {} };
  const js = ts.transpileModule(readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new vm.Script(js, { filename: file }).runInNewContext({ module: loadedModule, exports: loadedModule.exports,
    require: (id) => { assert.ok(Object.hasOwn(mocks, id), `unexpected dependency ${id}`); return mocks[id]; },
    fetch: fetcher, URLSearchParams, setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {},
  });
  function render() { cursor = 0; return loadedModule.exports[name](props); }
  async function settle() { for (let i = 0; i < 4; i++) await new Promise(setImmediate); }
  async function runEffects() { effects.splice(0).forEach((fn) => fn()); timers.splice(0).forEach((fn) => fn()); await settle(); }
  return { render, settle, runEffects, async mount() { render(); await runEffects(); return render(); } };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (tree == null || typeof tree === 'boolean') return '';
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
const button = (tree, label) => nodes(tree).find((node) => node.type === 'button' && text(node) === label);
const json = (body, ok = true) => ({ ok, json: async () => body });
const allocation = { id: '00000000-0000-4000-8000-000000000001', source: 'EVENT', status: 'ALLOCATED', revision: 1,
  event_name: 'Synthetic shift', event_status: 'CONFIRMED', site_name: 'Synthetic site', role_name: 'Steward',
  report_at: '2027-03-08T10:00:00Z', shift_starts_at: '2027-03-08T11:00:00Z', shift_ends_at: '2027-03-08T16:00:00Z',
  area_label: 'Synthetic gate', service_date: '2027-03-08', availability_conflict: null };
const deploymentHarness = (fetcher, props = {}) => componentHarness('my-deployments-client.tsx', 'MyDeploymentsClient', {
  focus: allocation.id, focusSource: 'EVENT', returnWeek: '2027-03-08', ...props,
}, fetcher);

test('Staff confirmation waits for PATCH, exact source readback and refreshed list', async () => {
  let state = { ...allocation }, release;
  const calls = [];
  const h = deploymentHarness(async (url, options = {}) => {
    calls.push([url, options.method ?? 'GET']);
    if (options.method === 'PATCH') return new Promise((resolve) => { release = () => {
      state = { ...state, status: 'ACCEPTED', revision: 2 }; resolve(json({}));
    }; });
    return json({ deployments: { items: [state], total: 1 } });
  });
  await h.mount();
  button(h.render(), 'Accept allocation').props.onClick();
  assert.match(text(h.render()), /Saving your response/);
  assert.doesNotMatch(text(h.render()), /Accepted allocation confirmed/);
  assert.equal(calls.length, 2);
  release(); await h.settle();
  assert.match(text(h.render()), /Accepted allocation confirmed/);
  assert.equal(calls.length, 4);
  assert.match(calls[2][0], new RegExp(`allocationId=${allocation.id}&source=EVENT`));
  assert.ok(nodes(h.render()).some((node) => node.props?.href === '/my-schedule?week=2027-03-08'));
});

test('Staff rejection retains pending allocation and produces no success/readback', async () => {
  const calls = [];
  const h = deploymentHarness(async (url, options = {}) => {
    calls.push([url, options.method]);
    return options.method === 'PATCH' ? json({ error: 'Synthetic revision conflict' }, false)
      : json({ deployments: { items: [allocation], total: 1 } });
  });
  await h.mount(); button(h.render(), 'Accept allocation').props.onClick(); await h.settle();
  assert.match(text(h.render()), /Synthetic revision conflict/);
  assert.match(text(h.render()), /Awaiting your response/);
  assert.doesNotMatch(text(h.render()), /Accepted allocation confirmed/);
  assert.equal(calls.length, 2);
});

for (const mismatch of ['wrong-source', 'changed-after-readback', 'readback-unavailable']) {
  test(`Staff response is not confirmed when ${mismatch}`, async () => {
    let count = 0;
    const h = deploymentHarness(async (_url, options = {}) => {
      if (options.method === 'PATCH') return json({});
      count++;
      if (count === 1) return json({ deployments: { items: [allocation], total: 1 } });
      if (mismatch === 'readback-unavailable') return json({}, false);
      const status = count === 3 ? 'CANCELLED' : 'ACCEPTED';
      return json({ deployments: { items: [{ ...allocation, status,
        source: mismatch === 'wrong-source' ? 'SITE_SHIFT' : 'EVENT' }], total: 1 } });
    });
    await h.mount(); button(h.render(), 'Accept allocation').props.onClick(); await h.settle();
    assert.doesNotMatch(text(h.render()), /Accepted allocation confirmed/);
    assert.match(text(h.render()), /could not be confirmed/);
  });
}

test('deployment read failure removes stale cards and pagination totals', async () => {
  let fail = false;
  const h = deploymentHarness(async () => fail ? json({}, false) : json({ deployments: { items: [allocation], total: 26 } }), { focus: undefined });
  await h.mount(); fail = true;
  button(h.render(), 'Next').props.onClick(); await h.settle();
  assert.doesNotMatch(text(h.render()), /Synthetic shift|of 26/);
  assert.match(text(h.render()), /Your deployments are unavailable/);
});

test('schedule keeps return week and exact duty/source links alongside selected mobile day', async () => {
  const calls = [];
  const h = componentHarness('my-schedule-client.tsx', 'MyScheduleClient', { initialWeek: '2027-03-08' }, async (url) => {
    calls.push(url);
    return json({ schedule: { week_start: '2027-03-08', work_total: 2, availability: [], work: [
      allocation, { ...allocation, id: '00000000-0000-4000-8000-000000000002', source: 'SITE_SHIFT', status: 'ACCEPTED' },
    ] } });
  });
  const tree = await h.mount();
  assert.match(calls[0], /week=2027-03-08/);
  assert.equal(nodes(tree).find((node) => node.type === 'input').props.value, '2027-03-08');
  const dayButtons = nodes(tree).filter((node) => node.type === 'button' && node.props['aria-label']);
  assert.equal(dayButtons.length, 7);
  assert.equal(dayButtons.filter((node) => node.props['aria-current'] === 'date').length, 1);
  const links = nodes(tree).filter((node) => node.type === 'a').map((node) => node.props.href);
  assert.ok(links.includes(`/my-deployments?allocationId=${allocation.id}&source=EVENT&returnWeek=2027-03-08`));
  assert.ok(links.includes(`/my-duty?allocationId=${allocation.id}&source=EVENT`));
  assert.ok(links.includes('/my-attendance?source=SITE_SHIFT&allocationId=00000000-0000-4000-8000-000000000002'));
  assert.ok(!links.some((href) => href.startsWith('/my-work-time?allocationId=00000000-0000-4000-8000-000000000002')));
});
