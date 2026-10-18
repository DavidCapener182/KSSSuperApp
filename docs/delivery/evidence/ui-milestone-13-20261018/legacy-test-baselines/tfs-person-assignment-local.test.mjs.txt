import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

// Real application modules; explicit synthetic RPC/HTTP/hook boundaries. Database
// guard assertions at the end are static source checks, never simulated SQL proof.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = { workspace: id(1), issue: id(2), first: id(3), second: id(4), unknown: id(5) };
const issue = { id: ids.issue, workspace_id: ids.workspace, revision: 3, status: 'Investigating', priority: 'Review',
  issue_type: 'Stock loss', source_region: 'unassigned', source_owner: 'Synthetic source label',
  owner_person_id: ids.first, ownerPersonName: 'Synthetic mapped Person', store_name: 'Synthetic test store',
  evidence_summary: 'Synthetic discrepancy only', next_action: 'Review synthetic source' };
const input = { storeName: issue.store_name, storeNumber: '00123', region: 'unassigned', owner: issue.source_owner,
  type: issue.issue_type, priority: issue.priority, status: issue.status, evidenceDate: '',
  evidenceSummary: issue.evidence_summary, nextAction: issue.next_action, sourceNote: '', potentialInternalTheftReview: false };
const routePath = 'src/app/api/client-workspaces/[workspaceId]/issues/[issueId]/route.ts';
const createPath = 'src/app/api/client-workspaces/[workspaceId]/issues/route.ts';
const principal = { personId: ids.first, roles: ['SECURITY_STAFF'] };
const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const json = (body, ok = true) => ({ ok, json: async () => body });
const params = (extra = {}) => ({ params: Promise.resolve({ workspaceId: ids.workspace, issueId: ids.issue, ...extra }) });
const request = (data, extra = {}) => new Request('http://localhost/synthetic', { method: 'PATCH',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: issue.revision, reason: 'Synthetic assignment review', data, ...extra }) });
const plain = (value) => JSON.parse(JSON.stringify(value));

function loader(mocks) {
  return function load(path) {
    const absolute = resolve(root, path), loaded = { exports: {} };
    const js = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    new vm.Script(js, { filename: absolute }).runInNewContext({ module: loaded, exports: loaded.exports,
      require(name) { assert.ok(Object.hasOwn(mocks, name), `unexpected dependency: ${name}`); return mocks[name]; },
      Response, Request, FormData, fetch: mocks.fetch ?? (() => { throw new Error('External network forbidden'); }),
    });
    return loaded.exports;
  };
}
function routeHarness({ actor = principal, saveError = null, savedId = ids.issue, readback = issue, readError = null } = {}) {
  const calls = [];
  const client = { async rpc(name, args) {
    calls.push([name, args]);
    if (name === 'cw_issue_save') return { data: savedId, error: saveError };
    if (name === 'cw_issue') return { data: readback, error: readError };
    throw new Error(`Unexpected RPC (including any grant action): ${name}`);
  } };
  const load = loader({ '@/lib/auth/principal': { getPrincipal: async () => actor, isUuid: uuid },
    '@/lib/supabase/server': { createServerSupabase: async () => client } });
  return { calls, load };
}

for (const [name, owner] of [['assignment', ids.first], ['reassignment', ids.second], ['explicit clearing', null], ['legacy omitted preservation', undefined]]) {
  test(`PATCH carries ${name} unchanged and returns guarded readback`, async () => {
    const data = { ...input, ...(owner === undefined ? {} : { ownerPersonId: owner }) };
    const returned = { ...issue, revision: 4, owner_person_id: owner === undefined ? ids.first : owner };
    const h = routeHarness({ readback: returned });
    const response = await h.load(routePath).PATCH(request(data), params());
    assert.equal(response.status, 200);
    assert.deepEqual(plain(h.calls), [['cw_issue_save', { p_workspace: ids.workspace, p_issue: ids.issue,
      p_revision: 3, p_data: data, p_reason: 'Synthetic assignment review' }],
    ['cw_issue', { p_workspace: ids.workspace, p_issue: ids.issue }]]);
    assert.deepEqual(await response.json(), { issue: returned });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(h.calls[0][1].p_data.owner, issue.source_owner);
    assert.equal(Object.hasOwn(h.calls[0][1].p_data, 'ownerPersonId'), owner !== undefined);
  });
}

test('create carries exact Person and only confirms the independent guarded readback', async () => {
  const h = routeHarness({ readback: { ...issue, revision: 1 } });
  const response = await h.load(createPath).POST(request({ ...input, ownerPersonId: ids.first }), params());
  assert.equal(response.status, 201);
  assert.equal(h.calls[0][1].p_issue, null); assert.equal(h.calls[0][1].p_revision, null);
  assert.equal(h.calls[0][1].p_data.ownerPersonId, ids.first);
  assert.equal(h.calls[1][0], 'cw_issue');
});

for (const [name, error, status] of [
  ['unknown Person', { code: '23514', message: `Owner Person unavailable: ${ids.unknown}` }, 400],
  ['invalid UUID', { code: '22P02', message: 'private UUID parser detail' }, 400],
  ['stale revision', { code: 'P0001', message: 'Issue changed; reload' }, 409],
  ['OPERATE denial', { code: '42501', message: 'private grant detail' }, 404],
]) {
  test(`${name} RPC result fails closed without readback or grant action`, async () => {
    const h = routeHarness({ saveError: error });
    const response = await h.load(routePath).PATCH(request({ ...input, ownerPersonId: ids.unknown }), params());
    assert.equal(response.status, status); assert.equal(h.calls.length, 1);
    assert.doesNotMatch(await response.text(), /private grant|parser detail|00000000-/);
  });
}

test('unavailable or denied readback reports uncertainty, not successful assignment', async () => {
  for (const readError of [null, { code: '42501', message: 'private read denial' }]) {
    const h = routeHarness({ readback: null, readError });
    const response = await h.load(routePath).PATCH(request({ ...input, ownerPersonId: ids.second }), params());
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'Saved but readback unavailable' });
    assert.equal(h.calls.length, 2);
  }
});

test('guessed path format and unauthenticated callers stop before guarded writes', async () => {
  for (const [actor, options] of [[null, {}], [principal, { issueId: 'not-a-uuid' }], [principal, { workspaceId: 'not-a-uuid' }]]) {
    const h = routeHarness({ actor });
    assert.equal((await h.load(routePath).PATCH(request(input), params(options))).status, 404);
    assert.equal(h.calls.length, 0);
  }
});

test('unexpected saved identity and malformed body never proceed to source readback', async () => {
  const h = routeHarness({ savedId: ids.unknown });
  assert.equal((await h.load(routePath).PATCH(request(input), params())).status, 400);
  assert.equal(h.calls.length, 1);
  const invalid = routeHarness();
  assert.equal((await invalid.load(routePath).PATCH(request([], { revision: '3' }), params())).status, 400);
  assert.equal(invalid.calls.length, 0);
});

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
function editorHarness({ owners = [{ id: ids.first, name: 'Synthetic first' }, { id: ids.second, name: 'Synthetic second' }],
  currentIssue = issue, fetcher = async () => json({ issue: { ...issue, revision: 4 } }) } = {}) {
  const states = [], calls = [], navigation = []; let cursor = 0;
  const element = (type, props) => ({ type, props });
  const load = loader({ react: { useState(initial) { const i = cursor++;
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], (value) => { states[i] = value; }]; }, useMemo: (fn) => fn() },
  'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
  'next/link': { __esModule: true, default: 'a' },
  'next/navigation': { useRouter: () => ({ refresh: () => navigation.push('refresh'), push: (url) => navigation.push(url) }) },
  '@/lib/client-workspaces/types': { STATUSES: ['Needs triage', 'Investigating', 'Visit needed', 'Waiting on store', 'Monitoring', 'Closed'] },
  fetch: async (url, options) => { calls.push([url, options]); return fetcher(url, options); } });
  const { TfsIssueEditor } = load('src/components/tfs-workspace-board.tsx');
  return { calls, navigation, render() { cursor = 0; return TfsIssueEditor({ workspaceId: ids.workspace,
    issue: currentIssue, owners }); } };
}
function form(ownerPersonId) {
  const data = new FormData();
  for (const [key, value] of Object.entries(input)) if (typeof value === 'string') data.set(key, value);
  data.set('ownerPersonId', ownerPersonId ?? ''); data.set('reason', 'Synthetic assignment review');
  return data;
}

for (const owner of [ids.first, ids.second, null]) {
  test(`editor sends explicit exact Person value ${owner ?? 'null'} without replacing source label`, async () => {
    const h = editorHarness(); const tree = h.render();
    assert.equal(nodes(tree).find((node) => node.props?.name === 'owner').props.defaultValue, issue.source_owner);
    await tree.props.action(form(owner));
    const body = JSON.parse(h.calls[0][1].body);
    assert.equal(body.data.ownerPersonId, owner); assert.equal(body.data.owner, issue.source_owner);
    assert.equal(body.revision, 3); assert.equal(body.reason, 'Synthetic assignment review');
    assert.equal(h.calls[0][1].method, 'PATCH');
    assert.match(text(h.render()), /Server confirmed revision 4/); assert.deepEqual(h.navigation, ['refresh']);
  });
}

test('existing Person omitted from choices is preserved as an explicit fallback option', () => {
  const tree = editorHarness({ owners: [{ id: ids.second, name: 'Synthetic second' }] }).render();
  const select = nodes(tree).find((node) => node.props?.name === 'ownerPersonId');
  assert.equal(select.props.defaultValue, ids.first);
  assert.ok(nodes(select).some((node) => node.type === 'option' && node.props.value === ids.first && /preserve current link/.test(text(node))));
});

test('unavailable choices disable save and prevent an explicit form invocation', async () => {
  const h = editorHarness({ owners: null }), tree = h.render();
  assert.equal(nodes(tree).find((node) => node.type === 'button').props.disabled, true);
  await tree.props.action(form(ids.second));
  assert.equal(h.calls.length, 0); assert.deepEqual(h.navigation, []);
  assert.match(text(h.render()), /Person choices unavailable/);
});

test('pending or failed editor response never refreshes or announces confirmation', async () => {
  let release;
  const h = editorHarness({ fetcher: () => new Promise((resolve) => { release = resolve; }) });
  const pending = h.render().props.action(form(ids.second));
  assert.match(text(h.render()), /Saving and reading back/); assert.doesNotMatch(text(h.render()), /Server confirmed/);
  assert.deepEqual(h.navigation, []);
  release(json({ error: 'Saved but readback unavailable' }, false)); await pending;
  assert.doesNotMatch(text(h.render()), /Server confirmed/); assert.deepEqual(h.navigation, []);
});

test('owner choices use exact guarded workspace RPC and fail closed on errors/non-arrays', async () => {
  for (const response of [{ data: null, error: { code: '42501' } }, { data: {}, error: null },
    { data: [{ id: ids.first, name: 'Synthetic first' }], error: null }]) {
    const calls = [];
    const load = loader({ 'next/navigation': {}, '@/lib/auth/principal': {}, '@/lib/supabase/server': {} });
    const client = { rpc: async (...args) => { calls.push(args); return response; } };
    const choices = await load('src/lib/client-workspaces/server.ts').readOwnerChoices(client, ids.workspace);
    assert.deepEqual(plain(calls), [['cw_owner_choices', { p_workspace: ids.workspace }]]);
    assert.deepEqual(plain(choices), Array.isArray(response.data) && !response.error ? response.data : null);
  }
});

test('migration source retains exact OPERATE/revision/Person/history boundaries without grant mutations', () => {
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261012134614_tfs_exact_person_assignment.sql'), 'utf8');
  assert.match(sql, /private\.cw_access\(p_workspace,'OPERATE'\)/);
  assert.match(sql, /id=p_issue and workspace_id=p_workspace for update/);
  assert.match(sql, /p_revision is distinct from old_row\.revision/);
  assert.match(sql, /if p_data \? 'ownerPersonId' then[\s\S]*nullif\(p_data->>'ownerPersonId',''\)::uuid/);
  assert.match(sql, /not exists\(select 1 from public\.people p where p\.id=v_person\)/);
  assert.match(sql, /else\s+v_person := old_row\.owner_person_id/);
  assert.match(sql, /source_owner=v_owner,owner_person_id=v_person/);
  assert.match(sql, /actor,trim\(p_reason\),to_jsonb\(old_row\),to_jsonb\(new_row\)/);
  assert.doesNotMatch(sql, /(?:insert into|update|delete from)\s+(?:public\.)?(?:client_workspace_grants|role_assignments|site_assignments)\b/i);
  assert.match(sql, /jsonb_build_object\('id',p\.id,'name',p\.display_name\)/);
});
