import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as calendar from '../src/lib/tasks/calendar.ts';
import * as dueTime from '../src/lib/crm/due-time.ts';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const initial = { id: uuid(1), title: 'Synthetic exact follow-up', state: 'OPEN', sourceKind: 'CRM_OPPORTUNITY', sourceId: uuid(2),
  sourceTitle: 'Synthetic commercial source', sourceHref: `/crm/opportunities/${uuid(2)}`, dueAt: '2026-10-16T09:00:00Z', completedAt: null };
function execute(file, mocks, globals = {}) {
  const loaded = { exports: {} }, js = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new vm.Script(js, { filename: file }).runInNewContext({ module: loaded, exports: loaded.exports,
    require: id => { assert.ok(Object.hasOwn(mocks, id), `unexpected import ${id}`); return mocks[id]; }, ...globals });
  return loaded.exports;
}
const readback = execute('src/lib/tasks/crm-action-readback.ts', { '@/lib/tasks/calendar': calendar });
const element = (type, props, key) => ({ type, props, key });
const jsx = { jsx: element, jsxs: element, Fragment: 'fragment' };
const response = (body, ok = true, status = ok ? 200 : 403) => ({ ok, status, json: async () => body });
const snapshot = values => ({ ...initial, ...values });

test('exact readback rejects non-CRM, wrong identity/source/URL and invalid timestamps', () => {
  assert.equal(readback.readCrmActionTask(initial, initial).id, initial.id);
  for (const values of [{ id: uuid(9) }, { sourceId: uuid(9), sourceHref: `/crm/opportunities/${uuid(9)}` },
    { sourceKind: 'CRM_ORGANISATION', sourceHref: `/crm/organisations/${initial.sourceId}` }, { sourceHref: 'https://example.invalid/private' },
    { sourceKind: 'DOCUMENT_VERSION' }, { dueAt: '2026-02-30T09:00:00Z' }, { dueAt: '2026-10-16' }, { state: 'DONE', completedAt: null }]) {
    assert.equal(readback.readCrmActionTask(snapshot(values), initial), null, JSON.stringify(values));
  }
  assert.equal(readback.readCrmActionTask(null), null);
  assert.equal(readback.sameReviewedCrmTask(initial, snapshot({ dueAt: '2026-10-16T10:00:00+01:00' })), true);
  assert.equal(readback.sameReviewedCrmTask(initial, snapshot({ title: 'Changed' })), false);
});
test('confirmation requires exact state and intended due; historical work cannot be a reviewed action', () => {
  const done = snapshot({ state: 'DONE', completedAt: '2026-10-16T12:00:00Z' });
  assert.equal(readback.confirmsCrmAction(initial, done, 'COMPLETE', null), true);
  assert.equal(readback.confirmsCrmAction(done, done, 'COMPLETE', null), false);
  assert.equal(readback.confirmsCrmAction(initial, snapshot({ state: 'CANCELLED' }), 'COMPLETE', null), false);
  assert.equal(readback.confirmsCrmAction(initial, snapshot({ dueAt: null }), 'RESCHEDULE', null), true);
  assert.equal(readback.confirmsCrmAction(initial, initial, 'RESCHEDULE', '2026-10-17T09:00:00Z'), false);
});

async function routeCase({ id = initial.id, principal = { personId: uuid(3) }, allowed = true, task = initial } = {}) {
  const calls = [], fail = kind => { throw new Error(kind); };
  const page = execute('src/app/(enterprise)/work/[taskId]/page.tsx', {
    'react/jsx-runtime': jsx, '@/components/crm-task-actions': { CrmTaskActions: 'actions' }, '@/lib/tasks/crm-action-readback': readback,
    'next/navigation': { notFound: () => fail('not-found'), redirect: path => fail(`redirect:${path}`) },
    '@/lib/auth/principal': { isUuid: value => /^[0-9a-f-]{36}$/i.test(value), getPrincipal: async () => principal },
    '@/lib/tasks/policy': { canUseWork: () => allowed, readTask: async (_, actor, taskId) => { calls.push([actor, taskId]); return task; } },
    '@/lib/supabase/server': { createServerSupabase: async () => ({}) },
  }).default;
  try { return { value: await page({ params: Promise.resolve({ taskId: id }) }), calls }; }
  catch (error) { return { error: error.message, calls }; }
}
test('server exact task route retains login/capability/record checks and stable action key', async () => {
  const good = await routeCase(); assert.equal(good.value.type, 'actions'); assert.equal(good.value.key, initial.id); assert.equal(good.value.props.initialTask.id, initial.id);
  assert.equal(good.calls[0][1], initial.id);
  const bad = await routeCase({ id: 'guessed-malformed' }); assert.equal(bad.error, 'not-found'); assert.equal(bad.calls.length, 0);
  const anonymous = await routeCase({ principal: null }); assert.equal(anonymous.error, `redirect:/?next=${encodeURIComponent(`/work/${initial.id}`)}`); assert.equal(anonymous.calls.length, 0);
  const denied = await routeCase({ allowed: false }); assert.equal(denied.error, 'not-found'); assert.equal(denied.calls.length, 0);
  assert.equal((await routeCase({ task: null })).error, 'not-found');
});
test('Document exact-version redirect stays intact and malformed CRM projection has no actions', async () => {
  const href = `/documents/${uuid(8)}?version=${uuid(9)}`;
  const document = await routeCase({ task: { id: initial.id, sourceKind: 'DOCUMENT_VERSION', sourceHref: href } });
  assert.equal(document.error, `redirect:${href}`); assert.equal(document.calls.length, 1);
  assert.equal((await routeCase({ task: snapshot({ sourceHref: '/crm/guessed' }) })).error, 'not-found');
});

function harness(fetcher, task = initial) {
  let cursor = 0; const hooks = [], effects = [], cleanups = [];
  const same = (a, b) => a?.length === b?.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(value) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof value === 'function' ? value() : value; return [hooks[i], next => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }]; },
    useRef(value) { const i = cursor++; return hooks[i] ??= { current: value }; },
    useEffect(fn, deps) { const i = cursor++; if (!same(hooks[i], deps)) { hooks[i] = deps; effects.push(fn); } },
  };
  const component = execute('src/components/crm-task-actions.tsx', { react, 'react/jsx-runtime': jsx,
    'next/link': { __esModule: true, default: 'a' }, '@/lib/crm/due-time': dueTime, '@/lib/tasks/crm-action-readback': readback,
    './crm-task-actions.module.css': { __esModule: true, default: {} },
  }, { fetch: fetcher }).CrmTaskActions;
  function render() { cursor = 0; return component({ initialTask: task }); }
  async function settle() { for (let i = 0; i < 5; i++) await new Promise(setImmediate); }
  return { render, settle, unmount() { cleanups.forEach(fn => fn?.()); }, async mount() { render(); effects.splice(0).forEach(fn => cleanups.push(fn())); await settle(); return render(); } };
}
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
const button = (tree, label) => nodes(tree).find(node => node.type === 'button' && text(node) === label);
function review(h, action = 'Complete follow-up') { button(h.render(), action).props.onClick(); return h.render(); }
function submit(h) { nodes(h.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); }
function reschedule(h, due = '2026-10-17T10:00', reason = 'Synthetic revised plan') {
  let tree = review(h, 'Reschedule follow-up'); nodes(tree).find(n => n.type === 'input' && n.props.type === 'datetime-local').props.onChange({ target: { value: due } });
  tree = h.render(); nodes(tree).find(n => n.type === 'input' && !n.props.type).props.onChange({ target: { value: reason } }); return h.render();
}
test('completion is explicit GET/POST/exact GET and duplicate/cancel handlers cannot submit while pending', async () => {
  let release, state = initial; const calls = [];
  const h = harness(async (path, opts) => { calls.push([path, opts]); if (opts.method === 'POST') return new Promise(resolve => { release = () => { state = snapshot({ state: 'DONE', completedAt: '2026-10-16T12:00:00Z' }); resolve(response({ id: initial.id })); }; }); return response({ task: state }); });
  await h.mount(); assert.equal(calls.length, 0); review(h); assert.equal(calls.length, 0); submit(h); await h.settle();
  assert.equal(button(h.render(), 'Cancel').props.disabled, true); submit(h); button(h.render(), 'Cancel').props.onClick();
  assert.equal(calls.length, 2); assert.equal(calls[0][0], `/api/tasks/${initial.id}`); assert.equal(calls[1][0], '/api/crm/work');
  assert.deepEqual(JSON.parse(calls[1][1].body), { action: 'changeTask', id: initial.id, kind: 'COMPLETE' });
  assert.doesNotMatch(text(h.render()), /Current state verified/); release(); await h.settle();
  assert.equal(calls.length, 3); assert.equal(calls[2][0], `/api/tasks/${initial.id}`); assert.match(text(h.render()), /Follow-up is Done. Current state verified/);
  assert.equal(button(h.render(), 'Complete follow-up'), undefined);
});
test('reschedule validates London DST/no-op/reason, preserves cancellation, and verifies intended due', async () => {
  let state = initial; const posts = [];
  const h = harness(async (path, opts) => { if (opts.method === 'POST') { const body = JSON.parse(opts.body); posts.push(body); state = snapshot({ dueAt: dueTime.londonDueToIso(body.dueLocal) }); return response({ id: initial.id }); } return response({ task: state }); });
  await h.mount();
  for (const due of ['2026-03-29T01:30', '2026-10-25T01:30', '2026-10-16T10:00']) { reschedule(h, due); assert.equal(button(h.render(), 'Confirm reschedule').props.disabled, true); submit(h); await h.settle(); }
  reschedule(h, '2026-10-17T10:00', 'x'); assert.equal(button(h.render(), 'Confirm reschedule').props.disabled, true);
  button(h.render(), 'Cancel').props.onClick(); assert.equal(posts.length, 0);
  reschedule(h); assert.equal(button(h.render(), 'Confirm reschedule').props.disabled, false); submit(h); await h.settle();
  assert.equal(posts.length, 1); assert.equal(posts[0].id, initial.id); assert.equal(posts[0].reason, 'Synthetic revised plan');
  assert.match(text(h.render()), /Current deadline verified/);
});
test('removing the deadline requires explicit reschedule confirmation and exact null readback', async () => {
  let state = initial; const posts = []; const h = harness(async (_, opts) => { if (opts.method === 'POST') { posts.push(JSON.parse(opts.body)); state = snapshot({ dueAt: null }); return response({ id: initial.id }); } return response({ task: state }); });
  await h.mount(); reschedule(h, ''); assert.match(text(h.render()), /current deadline will be removed/); submit(h); await h.settle();
  assert.equal(posts[0].dueLocal, null); assert.match(text(h.render()), /Current deadline verified/);
});
for (const [label, values] of [['due', { dueAt: '2026-10-18T09:00:00Z' }], ['state', { state: 'CANCELLED' }], ['title', { title: 'Changed task title' }]]) {
  test(`fresh ${label} change stops before POST and requires another deliberate review`, async () => {
    const calls = [], h = harness(async (path, opts) => { calls.push([path, opts]); return response({ task: snapshot(values) }); });
    await h.mount(); review(h); submit(h); await h.settle(); assert.equal(calls.length, 1); assert.match(text(h.render()), /follow-up changed/); assert.doesNotMatch(text(h.render()), /verified/);
  });
}
for (const [label, value] of [['wrong task', snapshot({ id: uuid(8) })], ['wrong source', snapshot({ sourceId: uuid(8), sourceHref: `/crm/opportunities/${uuid(8)}` })], ['lost access', null]]) {
  test(`fresh ${label} response clears details without POST`, async () => {
    const calls = [], h = harness(async (path, opts) => { calls.push([path, opts]); return response({ task: value }, value !== null); });
    await h.mount(); review(h); submit(h); await h.settle(); assert.equal(calls.length, 1); assert.match(text(h.render()), /unavailable/);
    assert.equal(button(h.render(), 'Complete follow-up'), undefined); assert.doesNotMatch(text(h.render()), /Synthetic commercial source/);
  });
}
for (const [label, after, receipt] of [
  ['wrong id', snapshot({ id: uuid(8), state: 'DONE', completedAt: '2026-10-16T12:00:00Z' })],
  ['wrong source', snapshot({ sourceId: uuid(8), sourceHref: `/crm/opportunities/${uuid(8)}`, state: 'DONE', completedAt: '2026-10-16T12:00:00Z' })],
  ['wrong state', initial], ['wrong due', snapshot({ state: 'DONE', completedAt: '2026-10-16T12:00:00Z', dueAt: null })],
  ['unavailable', null], ['wrong receipt', snapshot({ state: 'DONE', completedAt: '2026-10-16T12:00:00Z' }), uuid(8)],
]) {
  test(`POST 200 with ${label} readback never confirms and refresh never automatically reposts`, async () => {
    let reads = 0, posts = 0; const h = harness(async (_, opts) => { if (opts.method === 'POST') { posts++; return response({ id: receipt ?? initial.id }); } return ++reads === 1 ? response({ task: initial }) : response({ task: after }, after !== null); });
    await h.mount(); review(h); submit(h); await h.settle(); assert.equal(posts, 1); assert.match(text(h.render()), /Update not confirmed/); assert.doesNotMatch(text(h.render()), /Current state verified|Synthetic commercial source/);
    button(h.render(), 'Refresh follow-up').props.onClick(); await h.settle(); assert.equal(posts, 1);
  });
}
test('reschedule old due readback, denied writer and lost POST response remain unconfirmed', async () => {
  for (const mode of ['old-due', 'denied', 'lost-response']) {
    let posts = 0; const h = harness(async (_, opts) => { if (opts.method === 'POST') { posts++; if (mode === 'lost-response') throw new Error('Synthetic lost response'); return response({ id: initial.id }, mode !== 'denied'); } return response({ task: initial }); });
    await h.mount(); reschedule(h); submit(h); await h.settle(); assert.equal(posts, 1); assert.equal(button(h.render(), 'Reschedule follow-up'), undefined); assert.doesNotMatch(text(h.render()), /Current deadline verified/);
  }
});
test('unmounting during fresh preflight read prevents a later write', async () => {
  let release, posts = 0; const h = harness(async (_, opts) => { if (opts.method === 'POST') { posts++; return response({ id: initial.id }); } return new Promise(r => { release = () => r(response({ task: initial })); }); });
  await h.mount(); review(h); submit(h); await h.settle(); h.unmount(); release(); await h.settle(); assert.equal(posts, 0);
});
test('historical task has no action controls; loading/failed refresh clears old task details', async () => {
  const historical = harness(async () => response({}), snapshot({ state: 'CANCELLED' })); await historical.mount(); assert.equal(button(historical.render(), 'Complete follow-up'), undefined);
  let release; const h = harness(() => new Promise(r => { release = r; })); await h.mount(); button(h.render(), 'Refresh follow-up').props.onClick(); await h.settle();
  assert.match(text(h.render()), /Loading current follow-up/); assert.doesNotMatch(text(h.render()), /Synthetic commercial source/);
  release(response({}, false)); await h.settle(); assert.match(text(h.render()), /unavailable/); assert.equal(button(h.render(), 'Reschedule follow-up'), undefined);
});

// Execute the existing source/Person policy as well as the new page branch, using in-memory records.
const taskPolicy = execute('src/lib/tasks/policy.ts', {
  '@/lib/auth/capabilities': { hasCapability: (principal, cap) => principal.capabilities.includes(cap) },
  '@/lib/auth/principal': { isUuid: value => /^[0-9a-f-]{36}$/i.test(value) },
  '@/lib/documents/policy': { readDocumentRequest: async () => null },
  '@/lib/tasks/tfs-work': { listTfsIssueWork: async () => [] },
});
const office = { personId: uuid(3), roles: ['OFFICE_ADMIN'], capabilities: ['TASK_SELF_READ', 'CRM_USE'] };
function policyClient({ sourceVisible = true, assignee = office.personId } = {}) {
  const calls = [], record = { id: initial.id, task_type: 'CRM_FOLLOW_UP', title: initial.title, state: 'OPEN', assignee_person_id: assignee,
    source_kind: initial.sourceKind, source_id: initial.sourceId, created_at: '2026-10-16T08:00:00Z', completed_at: null, due_at: initial.dueAt };
  return { calls, from(table) {
    const filters = [];
    const query = { select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
      async maybeSingle() { calls.push([table, filters]); return { error: null, data: table === 'tasks' ? filters.every(([key, value]) => record[key] === value) ? record : null :
        sourceVisible ? { id: initial.sourceId, title: initial.sourceTitle } : null }; } };
    return query;
  } };
}
test('existing readTask policy binds exact selected id and own Person before CRM source resolution', async () => {
  const client = policyClient(), value = await taskPolicy.readTask(client, office, initial.id);
  assert.equal(value.id, initial.id); assert.equal(value.sourceHref, initial.sourceHref);
  assert.equal(client.calls[0][0], 'tasks'); assert.deepEqual(Array.from(client.calls[0][1][0]), ['id', initial.id]);
  assert.equal(await taskPolicy.readTask(client, office, uuid(99)), null);
  const other = policyClient({ assignee: uuid(99) }); assert.equal(await taskPolicy.readTask(other, office, initial.id), null);
  assert.equal(other.calls.length, 1, 'other-Person task must stop before reading CRM source');
});
test('existing CRM source loss and missing capabilities deny the resolved task projection', async () => {
  assert.equal(await taskPolicy.readTask(policyClient({ sourceVisible: false }), office, initial.id), null);
  assert.equal(await taskPolicy.readTask(policyClient(), { ...office, capabilities: ['TASK_SELF_READ'] }, initial.id), null);
  const noWork = policyClient(); assert.equal(await taskPolicy.readTask(noWork, { ...office, capabilities: ['CRM_USE'] }, initial.id), null); assert.equal(noWork.calls.length, 0);
});

test('server error after an attempted POST is uncertain rather than claimed rejected', async () => {
  const h = harness(async (_, opts) => opts.method === 'POST' ? response({}, false, 503) : response({ task: initial }));
  await h.mount(); review(h); submit(h); await h.settle();
  assert.match(text(h.render()), /Update not confirmed/); assert.doesNotMatch(text(h.render()), /not accepted|Current state verified/);
});
