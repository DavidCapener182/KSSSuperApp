import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as reading from '../src/lib/controlled/reading-list.ts';

const row = (id, values = {}) => ({ id, document_id: `doc-${id}`, version_id: `version-${id}`, version_number: 1,
  title: `Synthetic document ${id}`, target_kind: 'SITE_SERVICE', target_id: `target-${id}`, required: true,
  effective_from: '2026-10-16T09:00:00Z', current: true, conflict: false, opened: false,
  acknowledged_at: null, close_kind: null, context_label: 'Synthetic North Service', ...values });
const assignments = [
  row('unopened'), row('opened', { opened: true }), row('ack', { opened: true, acknowledged_at: '2026-10-16T10:00:00Z' }),
  row('history', { current: false, opened: true, acknowledged_at: '2026-10-15T10:00:00Z', close_kind: 'REPLACED' }),
  row('conflict', { conflict: true, opened: true, acknowledged_at: '2026-10-15T10:00:00Z' }),
  row('optional', { required: false, opened: true }),
];

test('group first: overlapping contexts keep exact version, chosen opened assignment, aggregate facts and order', () => {
  const rows = [row('old', { current: false, document_id: 'same-doc', version_id: 'same-version', acknowledged_at: '2026-10-14T10:00:00Z', context_label: 'Past context' }),
    row('current', { document_id: 'same-doc', version_id: 'same-version', required: false }),
    row('current-open', { document_id: 'same-doc', version_id: 'same-version', opened: true, context_label: 'Synthetic Event' }),
    row('v2', { document_id: 'same-doc', version_id: 'version-2', version_number: 2 })];
  const before = JSON.stringify(rows), items = reading.groupReadingAssignments(rows);
  assert.equal(items.length, 2); assert.equal(items[0].id, 'current-open'); assert.equal(items[0].version_id, 'same-version');
  assert.deepEqual(items[0].contexts, ['Past context', 'Synthetic North Service', 'Synthetic Event']);
  assert.equal(items[0].required, true); assert.equal(items[0].current, true); assert.equal(items[0].opened, true);
  assert.equal(items[0].acknowledged_at, '2026-10-14T10:00:00Z'); assert.equal(items[1].id, 'v2');
  assert.equal(JSON.stringify(rows), before);
});
test('status precedence is exclusive: conflicts, history, current acknowledgement, opened, not opened', () => {
  const items = reading.groupReadingAssignments(assignments);
  assert.deepEqual(items.map(reading.readingStatus), ['NOT_OPENED', 'OPENED', 'ACKNOWLEDGED', 'HISTORICAL', 'CONFLICT', 'OPENED']);
  assert.equal(reading.readingStatus({ ...items[3], conflict: true }), 'CONFLICT');
  assert.equal(reading.readingStatus({ ...items[0], acknowledged_at: '2026-10-16T10:00:00Z' }), 'ACKNOWLEDGED');
  const matches = ['CONFLICT', 'HISTORICAL', 'ACKNOWLEDGED', 'OPENED', 'NOT_OPENED'].flatMap(status => reading.filterReadingList(items, status, ''));
  assert.equal(matches.length, items.length); assert.equal(new Set(matches).size, items.length);
});
test('title/context search intersects status, ignores case/edge whitespace, excludes metadata and omitted projections', () => {
  const rows = [...assignments, row('fallback', { context_label: undefined, target_kind: 'OPERATIONAL_ROLE' })];
  const items = reading.groupReadingAssignments(rows);
  assert.equal(reading.filterReadingList(items, 'OPENED', ' NORTH SERVICE ').length, 2);
  assert.equal(reading.filterReadingList(items, 'NOT_OPENED', 'DOCUMENT UNOPENED')[0].id, 'unopened');
  assert.equal(reading.filterReadingList(items, 'ALL', 'operational role')[0].id, 'fallback');
  for (const query of ['version-unopened', 'target-unopened', '2026-10-16', 'REPLACED', 'Restricted document absent from response']) {
    assert.equal(reading.filterReadingList(items, 'ALL', query).length, 0);
  }
  assert.equal(reading.filterReadingList(items, 'ALL', '   ').length, items.length);
  assert.deepEqual(reading.filterReadingList([], 'ALL', ''), []);
});

function harness(fetcher, props = { staff: true, manager: false, operations: false, superAdmin: false }) {
  let cursor = 0; const hooks = [], effects = [];
  const same = (a, b) => a?.length === b?.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], v => { hooks[i] = typeof v === 'function' ? v(hooks[i]) : v; }]; },
    useCallback(fn, deps) { const i = cursor++; if (!same(hooks[i]?.deps, deps)) hooks[i] = { fn, deps }; return hooks[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!same(hooks[i], deps)) { hooks[i] = deps; effects.push(fn); } },
  };
  const element = (type, props) => ({ type, props });
  const mocks = { react, 'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
    '@/components/operational-document-picker': { OperationalDocumentPicker: 'picker' },
    '@/lib/controlled/reading-list': reading,
    './operational-documents.module.css': { __esModule: true, default: new Proxy({}, { get: (_, k) => k }) },
    './operational-reading-filters.module.css': { __esModule: true, default: new Proxy({}, { get: (_, k) => k }) },
  };
  const loaded = { exports: {} };
  const js = ts.transpileModule(readFileSync(new URL('../src/components/operational-documents-client.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new vm.Script(js).runInNewContext({ module: loaded, exports: loaded.exports,
    require: id => { assert.ok(Object.hasOwn(mocks, id), id); return mocks[id]; }, fetch: fetcher });
  function render() { cursor = 0; return loaded.exports.OperationalDocumentsClient(props); }
  async function settle() { for (let i = 0; i < 5; i++) await new Promise(setImmediate); }
  return { render, settle, async mount() { render(); effects.splice(0).forEach(fn => fn()); await settle(); return render(); } };
}
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(' ') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree); }
const byId = (tree, id) => nodes(tree).find(n => n.props?.id === id);
const response = (body, ok = true) => ({ ok, json: async () => body });
test('client loading and restricted failures show no misleading empty result, cards or counts', async () => {
  let release; const h = harness(() => new Promise(r => { release = r; }));
  await h.mount(); assert.match(text(h.render()), /Loading your reading list/); assert.doesNotMatch(text(h.render()), /No current|Showing/);
  release(response({ error: 'Required reading unavailable' }, false)); await h.settle();
  assert.match(text(h.render()), /Reading list unavailable/); assert.doesNotMatch(text(h.render()), /Showing|No current/);
  assert.equal(nodes(h.render()).filter(n => n.type === 'article' || n.type === 'input').length, 0);
});
test('client combines/clears filters without network requests or acknowledgements; exact chosen file action remains', async () => {
  const calls = [], h = harness(async (path, opts) => { calls.push([path, opts]); return response({ assignments }); });
  await h.mount(); let tree = h.render(); assert.match(text(tree), /Showing\s+6\s+of\s+6\s+returned document versions/);
  byId(tree, 'reading-status').props.onChange({ target: { value: 'OPENED' } }); tree = h.render();
  byId(tree, 'reading-search').props.onChange({ target: { value: 'document optional' } }); tree = h.render();
  assert.match(text(tree), /Showing\s+1\s+of\s+6/); assert.equal(nodes(tree).filter(n => n.type === 'article').length, 1);
  assert.equal(nodes(tree).find(n => n.type === 'a').props.href, '/api/operational-documents/my/optional/file');
  assert.equal(nodes(tree).find(n => n.type === 'button' && text(n).includes('Acknowledge version')).props.disabled, true);
  byId(tree, 'reading-search').props.onChange({ target: { value: 'Restricted unseen title' } }); tree = h.render();
  assert.match(text(tree), /No matching documents/); assert.equal(nodes(tree).filter(n => n.type === 'article').length, 0);
  nodes(tree).find(n => n.type === 'button' && text(n) === 'Clear filters').props.onClick(); tree = h.render();
  assert.match(text(tree), /Showing\s+6\s+of\s+6/); assert.equal(byId(tree, 'reading-search').props.value, '');
  assert.equal(byId(tree, 'reading-status').props.value, 'ALL'); assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/operational-documents/my'); assert.equal(calls[0][1].method, 'GET');
});
test('failed reading refresh after exact acknowledgement clears prior facts without a false success message', async () => {
  let reads = 0; const calls = [], h = harness(async (path, opts) => {
    calls.push([path, opts]); if (opts.method === 'POST') return response({});
    return ++reads === 1 ? response({ assignments: [row('opened', { opened: true })] }) : response({ error: 'Required reading unavailable' }, false);
  });
  await h.mount(); let tree = h.render(); const check = nodes(tree).find(n => n.type === 'input' && n.props.type === 'checkbox');
  check.props.onChange({ target: { checked: true } }); tree = h.render();
  nodes(tree).find(n => n.type === 'button' && text(n).includes('Acknowledge version')).props.onClick(); await h.settle(); tree = h.render();
  assert.equal(calls[1][0], '/api/operational-documents/my/opened/acknowledge'); assert.equal(calls[1][1].body, '{"confirmed":true}');
  assert.match(text(tree), /Reading list unavailable/); assert.doesNotMatch(text(tree), /Acknowledgement recorded for this version|Showing/);
  assert.equal(nodes(tree).filter(n => n.type === 'article').length, 0);
});
test('non-Staff view never loads the self reading list or exposes reading filters', async () => {
  const calls = [], h = harness(async path => { calls.push(path); return response({}); }, { staff: false, manager: false, operations: false, superAdmin: false });
  await h.mount(); assert.deepEqual(calls, []); assert.equal(byId(h.render(), 'reading-search'), undefined);
});

for (const changed of ['missing-ack', 'wrong-version', 'wrong-document', 'revoked', 'conflict', 'invalid-time', 'missing-receipt']) {
  test(`exact-version acknowledgement cannot claim success with ${changed} readback`, async () => {
    let reads=0; const item=row('opened',{opened:true});
    const h=harness(async (_path,opts)=>{
      if(opts.method==='POST')return response(changed==='missing-receipt'?{}:{acknowledgementId:'00000000-0000-4000-8000-000000000099'});
      const refreshed={...item,acknowledged_at:'2026-10-18T09:00:00Z',...(changed==='missing-ack'?{acknowledged_at:null}:changed==='wrong-version'?{version_id:'other-version'}:changed==='wrong-document'?{document_id:'other-document'}:changed==='revoked'?{current:false}:changed==='conflict'?{conflict:true}:changed==='invalid-time'?{acknowledged_at:'invalid'}:{})};
      return response({assignments:[++reads===1?item:refreshed]});
    });
    await h.mount(); let tree=h.render(); nodes(tree).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}}); tree=h.render();
    nodes(tree).find(n=>n.type==='button'&&text(n).includes('Acknowledge version')).props.onClick(); await h.settle();tree=h.render();
    assert.doesNotMatch(text(tree),/Acknowledgement recorded for this version/);
    assert.match(text(tree),/could not be verified/);
  });
}

test('matching exact-version receipt and current independent readback confirms acknowledgement once',async()=>{
  let reads=0,posts=0;const item=row('opened',{opened:true});
  const h=harness(async(_path,opts)=>{if(opts.method==='POST'){posts++;return response({acknowledgementId:'00000000-0000-4000-8000-000000000099'});}return response({assignments:[{...item,acknowledged_at:++reads===1?null:'2026-10-18T09:00:00Z'}]});});
  await h.mount();let tree=h.render();nodes(tree).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});tree=h.render();
  nodes(tree).find(n=>n.type==='button'&&text(n).includes('Acknowledge version')).props.onClick();await h.settle();tree=h.render();
  assert.match(text(tree),/Acknowledgement recorded for this version/);assert.equal(posts,1);assert.equal(reads,2);
});
