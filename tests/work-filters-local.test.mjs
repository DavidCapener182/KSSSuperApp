import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

// Execute the actual filter against synthetic authorised projections; no database/auth simulation claims.
const loadedModule = { exports: {} };
const js = ts.transpileModule(readFileSync(new URL('../src/components/work-client.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
new vm.Script(js).runInNewContext({ module: loadedModule, exports: loadedModule.exports, require: () => ({}) });
const filter = loadedModule.exports.filterWorkTasks;
export const tasks = [
  { id: 'doc-open', title: 'Review submitted evidence', sourceKind: 'DOCUMENT_VERSION', state: 'OPEN', covering: false, requestTitle: 'Synthetic identity request', subjectName: 'Synthetic Person', versionNumber: 2 },
  { id: 'doc-cover', title: 'Review cover evidence', sourceKind: 'DOCUMENT_VERSION', state: 'OPEN', covering: true, requestTitle: 'Synthetic cover request', versionNumber: 3 },
  { id: 'crm-open', title: 'Call synthetic client', sourceKind: 'CRM_OPPORTUNITY', state: 'OPEN', covering: false, sourceTitle: 'Synthetic commercial source' },
  { id: 'crm-done', title: 'Completed synthetic follow-up', sourceKind: 'CRM_ORGANISATION', state: 'DONE', covering: false, sourceTitle: 'Synthetic organisation' },
  { id: 'crm-cancelled', title: 'Cancelled synthetic follow-up', sourceKind: 'CRM_OPPORTUNITY', state: 'CANCELLED', covering: false, sourceTitle: 'Synthetic closed source' },
  { id: 'tfs-visit', title: 'Synthetic visit request', sourceKind: 'TFS_LP_ISSUE', state: 'OPEN', covering: false, sourceStatus: 'Visit needed', priority: 'Review' },
  { id: 'tfs-review', title: 'Synthetic issue review', sourceKind: 'TFS_LP_ISSUE', state: 'OPEN', covering: false, sourceStatus: 'Awaiting evidence', priority: 'High', sourceTitle: 'UNDISPLAYED_SENTINEL' },
].map((task, i) => ({ createdAt: `2026-10-${String(i + 1).padStart(2, '0')}T09:00:00Z`, dueAt: null, completedAt: null, sourceId: `source-${i}`, sourceHref: `/tfs/issues/synthetic-${i}`, ...task }));
const ids = (source = 'ALL', status = 'ALL', search = '') => Array.from(filter(tasks, source, status, search), t => t.id);
test('source filters distinguish both CRM kinds and preserve exact rows/order', () => {
  assert.deepEqual(ids('CRM'), ['crm-open', 'crm-done', 'crm-cancelled']);
  assert.deepEqual(ids('DOCUMENTS'), ['doc-open', 'doc-cover']);
  assert.deepEqual(ids('TFS'), ['tfs-visit', 'tfs-review']);
  assert.equal(filter(tasks, 'TFS', 'ALL', '')[0], tasks[5]);
});
test('Open excludes Covering; histories retain their source states', () => {
  assert.deepEqual(ids('ALL', 'OPEN'), ['doc-open', 'crm-open', 'tfs-visit', 'tfs-review']);
  assert.deepEqual(ids('ALL', 'COVERING'), ['doc-cover']);
  assert.deepEqual(ids('ALL', 'DONE'), ['crm-done']);
  assert.deepEqual(ids('ALL', 'CANCELLED'), ['crm-cancelled']);
});
test('search trims, ignores case, intersects source/status and excludes non-displayed metadata', () => {
  assert.deepEqual(ids('DOCUMENTS', 'OPEN', ' SYNTHETIC PERSON '), ['doc-open']);
  assert.deepEqual(ids('CRM', 'DONE', 'organisation'), ['crm-done']);
  for (const query of ['source-6', '/tfs/issues', 'UNDISPLAYED_SENTINEL', 'Awaiting evidence']) assert.deepEqual(ids('ALL', 'ALL', query), []);
  assert.deepEqual(ids('CRM', 'OPEN', 'organisation'), []);
  assert.deepEqual(ids('ALL', 'ALL', '   '), ids());
});
test('empty projections and clearing filter values retain scope without mutating data', () => {
  assert.equal(filter([], 'ALL', 'ALL', '').length, 0);
  const before = JSON.stringify(tasks);
  ids('TFS', 'COVERING', 'absent');
  assert.deepEqual(ids(), tasks.map(t => t.id));
  assert.equal(JSON.stringify(tasks), before);
});
