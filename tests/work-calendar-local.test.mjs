import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as calendar from '../src/lib/tasks/calendar.ts';

const task = (id, dueAt = null, values = {}) => ({ id, title: `Synthetic ${id}`, dueAt, sourceKind: 'CRM_OPPORTUNITY', state: 'OPEN', covering: false,
  createdAt: '2026-10-16T09:00:00Z', completedAt: null, sourceId: `synthetic-source-${id}`, ...values });
test('strict offset-bearing instants reject impossible or silently normalised civil timestamps', () => {
  for (const value of [null, '', 'tomorrow', '2026-10-16', '2026-10-16T09:00:00', '2026-02-29T09:00:00Z',
    '2026-04-31T09:00:00Z', '2026-13-01T09:00:00Z', '2026-00-01T09:00:00Z', '2026-01-00T09:00:00Z', '2026-01-01T24:00:00Z',
    '2026-01-01T09:60:00Z', '2026-01-01T09:00:60Z', '2026-01-01T09:00:00+14:01', '2026-01-01T09:00:00+25:00',
    '2026-01-01T09:00:00+00:60', '0000-01-01T09:00:00Z', '0001-01-01T00:00:00+14:00', '9999-12-31T23:59:59-14:00']) {
    assert.equal(calendar.parseDeadline(value), null, String(value));
  }
  for (const value of ['2024-02-29T09:00:00Z', '2026-10-16T09:00:00.123456+00:00', '2026-10-16T10:00:00+01:00']) assert.ok(calendar.parseDeadline(value), value);
});
test('London deadline dates cross UTC day/month/year boundaries explicitly', () => {
  assert.equal(calendar.parseDeadline('2026-06-30T23:30:00Z').day, '2026-07-01');
  assert.equal(calendar.parseDeadline('2026-12-31T23:30:00-01:00').day, '2027-01-01');
  assert.equal(calendar.parseDeadline('2026-10-01T00:30:00+02:00').day, '2026-09-30');
  assert.equal(calendar.londonDay(new Date('2026-06-30T23:30:00Z')), '2026-07-01');
});
test('UK DST change instants retain real due time and repeated-hour identity', () => {
  const before = calendar.parseDeadline('2026-03-29T00:30:00Z'), after = calendar.parseDeadline('2026-03-29T01:30:00Z');
  assert.equal(before.day, '2026-03-29'); assert.equal(after.day, before.day);
  assert.match(before.time, /00:30.*GMT/); assert.match(after.time, /02:30.*BST/);
  const first = calendar.parseDeadline('2026-10-25T00:30:00Z'), second = calendar.parseDeadline('2026-10-25T01:30:00Z');
  assert.match(first.time, /01:30.*BST/); assert.match(second.time, /01:30.*GMT/); assert.equal(second.instant - first.instant, 3_600_000);
});
test('month navigation, leap days, Monday grids and day/week movement use civil dates', () => {
  assert.equal(calendar.moveCalendarMonth('2026-12', 1), '2027-01'); assert.equal(calendar.moveCalendarMonth('2027-01', -1), '2026-12');
  assert.equal(calendar.addCalendarDays('2024-02-28', 1), '2024-02-29'); assert.equal(calendar.addCalendarDays('2024-02-29', 1), '2024-03-01');
  assert.equal(calendar.addCalendarDays('2026-03-29', 7), '2026-04-05'); assert.equal(calendar.addCalendarDays('2026-10-25', -7), '2026-10-18');
  const days = calendar.calendarMonthDays('2024-02'); assert.equal(days[0], '2024-01-29'); assert.equal(days.at(-1), '2024-03-03');
  assert.equal(days.filter(d => d?.startsWith('2024-02')).length, 29); assert.equal(new Set(days).size, days.length);
  assert.equal(calendar.calendarMonthDays('2026-02').filter(d => d?.startsWith('2026-02')).length, 28);
  assert.equal(calendar.moveCalendarMonth('0001-01', -1), null); assert.equal(calendar.moveCalendarMonth('9999-12', 1), null);
  assert.equal(calendar.moveCalendarMonth('2026-13', 1), null); assert.equal(calendar.addCalendarDays('2026-01-01', .5), null);
  assert.throws(() => calendar.calendarMonthDays('2026-13'), RangeError);
});
test('projection never fabricates Document/TFS dates and keeps every returned row once', () => {
  const rows = [task('later', '2026-10-16T11:00:00Z'), task('b', '2026-10-16T10:00:00Z'), task('a', '2026-10-16T10:00:00Z', { state: 'DONE' }),
    task('cancelled', '2026-10-16T10:30:00Z', { state: 'CANCELLED' }), task('cover', '2026-10-16T09:00:00Z', { covering: true }),
    task('doc', null, { sourceKind: 'DOCUMENT_VERSION' }), task('tfs', null, { sourceKind: 'TFS_LP_ISSUE', priority: 'Urgent' }),
    task('bad', '2026-02-30T09:00:00Z'), task('date-only', '2026-10-16'), task('unexpected-doc', '2026-10-16T09:00:00Z', { sourceKind: 'DOCUMENT_VERSION' })];
  const before = JSON.stringify(rows), { dated, undated } = calendar.taskDeadlines(rows);
  assert.deepEqual(dated.map(d => d.task.id), ['cover', 'a', 'b', 'cancelled', 'later']);
  assert.deepEqual(undated.map(d => d.id), ['doc', 'tfs', 'bad', 'date-only', 'unexpected-doc']);
  assert.equal(dated.length + undated.length, rows.length); assert.equal(new Set([...dated.map(d => d.task), ...undated]).size, rows.length);
  assert.equal(dated[2].task, rows[1]); assert.equal(JSON.stringify(rows), before);
  assert.deepEqual(calendar.deadlineCounts(dated.map(d => d.task)), { open: 2, covering: 1, done: 1, cancelled: 1 });
  assert.deepEqual(calendar.taskDeadlines([]), { dated: [], undated: [] });
});

// Execute the real view integration with hook/HTTP boundaries; calendar mechanics use the real module above.
function workHarness(fetcher) {
  let cursor = 0; const hooks = [], effects = [];
  const react = { useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], v => { hooks[i] = typeof v === 'function' ? v(hooks[i]) : v; }]; },
    useEffect(fn) { effects.push(fn); } };
  const element = (type, props) => ({ type, props });
  const mocks = { react, 'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' }, 'next/link': { __esModule: true, default: 'a' },
    '@/components/ui/workflow': { EmptyState: 'empty', FeedbackBanner: 'feedback', LoadingBlock: 'loading' }, '@/lib/crm/due-status': { crmDueStatus: () => 'Upcoming' },
    '@/components/work-calendar': { WorkCalendar: 'calendar' }, './work-filters.module.css': { __esModule: true, default: {} }, './work-calendar.module.css': { __esModule: true, default: {} } };
  const loaded = { exports: {} }, js = ts.transpileModule(readFileSync(new URL('../src/components/work-client.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new vm.Script(js).runInNewContext({ module: loaded, exports: loaded.exports, require: id => { assert.ok(Object.hasOwn(mocks, id), id); return mocks[id]; }, fetch: fetcher });
  function render() { cursor = 0; return loaded.exports.WorkClient(); }
  async function settle() { for (let i = 0; i < 4; i++) await new Promise(setImmediate); }
  return { render, settle, async mount() { render(); effects.splice(0).forEach(fn => fn()); await settle(); return render(); } };
}
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && text(n) === label);
test('List stays default; Calendar receives only existing source/status/search results with original exact task renderer', async () => {
  const rows = [task('open', '2026-10-16T09:00:00Z'), task('done', '2026-10-16T09:00:00Z', { state: 'DONE' }), task('doc', null, { sourceKind: 'DOCUMENT_VERSION' })];
  const calls = [], h = workHarness(async (path, options) => { calls.push([path, options]); return { ok: true, json: async () => ({ tasks: rows }) }; });
  let tree = await h.mount(); assert.equal(button(tree, 'List').props['aria-pressed'], true); assert.equal(nodes(tree).filter(n => n.type === 'calendar').length, 0);
  button(tree, 'Deadline calendar').props.onClick(); tree = h.render();
  const set = (id, value) => nodes(tree).find(n => n.props.id === id).props.onChange({ target: { value } });
  set('work-source', 'CRM'); tree = h.render(); set('work-status', 'DONE'); tree = h.render();
  nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value: 'done' } }); tree = h.render();
  const calendarNode = nodes(tree).find(n => n.type === 'calendar'); assert.equal(calendarNode.props.tasks.length, 1); assert.equal(calendarNode.props.tasks[0], rows[1]);
  assert.equal(calendarNode.props.renderTask(rows[1]).props.task, rows[1]);
  assert.equal(calls.length, 1); assert.equal(calls[0][0], '/api/tasks'); assert.equal(calls[0][1].cache, 'no-store');
  nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value: 'not returned' } }); tree = h.render();
  assert.equal(nodes(tree).filter(n => n.type === 'calendar').length, 0); assert.equal(nodes(tree).find(n => n.type === 'empty').props.title, 'No matching work');
  button(tree, 'Clear filters').props.onClick(); tree = h.render(); assert.equal(nodes(tree).find(n => n.type === 'calendar').props.tasks.length, 3);
  button(tree, 'List').props.onClick(); assert.equal(nodes(h.render()).filter(n => n.type === 'calendar').length, 0);
});
test('loading and unavailable source never expose calendar controls or stale task facts', async () => {
  let release; const h = workHarness(() => new Promise(r => { release = r; })); await h.mount();
  assert.equal(nodes(h.render()).filter(n => n.type === 'loading').length, 1); assert.equal(button(h.render(), 'Deadline calendar'), undefined);
  release({ ok: false }); await h.settle();
  assert.equal(nodes(h.render()).filter(n => n.type === 'feedback').length, 1); assert.equal(button(h.render(), 'Deadline calendar'), undefined);
  assert.equal(nodes(h.render()).filter(n => n.type === 'calendar').length, 0);
});
