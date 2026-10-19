import test from 'node:test';
import assert from 'node:assert/strict';
import { previewSyntheticIdentityLinks as preview } from '../docs/delivery/proposals/PARIM-RECONCILIATION-20261019.mjs';

const person = '11111111-1111-4111-8111-111111111111';
const person2 = '22222222-2222-4222-8222-222222222222';
const link = (source_id = 'synthetic-A', person_id = person) => ({ source_system: 'PARIM', source_id, person_id });
const fixture = () => ({ synthetic: true, schemaVersion: 1, sourceSystem: 'PARIM', scope: 'synthetic-review-scope', batchId: 'synthetic-batch-1', sourceVersion: 'synthetic-export-v1', observedAt: '2026-10-19T00:00:00.000Z', externalIds: ['synthetic-A'], links: [link()] });
const run = (data, ledger = [], scope = 'synthetic-review-scope') => preview(JSON.stringify(data), scope, ledger);
const reason = (result, value) => result.entries.some((entry) => entry.reasons.includes(value));

test('exact existing identity only; provenance never asserts freshness, retention or integration', () => {
  const result = run(fixture());
  assert.deepEqual(result.entries, [{ externalId: 'synthetic-A', state: 'EXACT_EXISTING_LINK', personId: person, reasons: [] }]);
  assert.equal(result.mode, 'SYNTHETIC_READ_ONLY_PREVIEW');
  assert.equal(result.integrationVerified, false); assert.equal(result.freshness, 'UNVERIFIED');
  assert.equal(result.retention, 'OWNER_DECISION_REQUIRED'); assert.match(result.receipt.contentHash, /^[a-f0-9]{64}$/);
});
test('missing source or KSS links require review without deletion or creation instructions', () => {
  const data = fixture(); data.externalIds = ['synthetic-B'];
  assert.deepEqual(run(data).entries.map((entry) => entry.reasons), [['NOT_IN_DECLARED_SNAPSHOT'], ['NO_EXISTING_LINK']]);
});
test('opaque IDs retain case, Unicode, leading whitespace and zeroes; never fuzzy match', () => {
  const data = fixture(); data.externalIds = ['Synthetic-A', ' synthetic-A', '001', 'é', 'é'];
  const result = run(data); assert.equal(result.entries.length, 6);
  assert.ok(result.entries.every((entry) => entry.state === 'REVIEW_REQUIRED'));
  assert.ok(result.entries.some((entry) => entry.externalId === ' synthetic-A'));
});
test('duplicate export IDs quarantine exact linked record', () => {
  const data = fixture(); data.externalIds.push('synthetic-A'); assert.ok(reason(run(data), 'DUPLICATE_SOURCE_ID'));
});
test('duplicate link IDs quarantine all alternatives', () => {
  const data = fixture(); data.links.push(link('synthetic-A', person2));
  const result = run(data); assert.ok(reason(result, 'DUPLICATE_LINK_ID')); assert.equal(result.entries[0].personId, undefined);
});
test('one Person with multiple PARIM IDs violates existing source-link uniqueness', () => {
  const data = fixture(); data.links.push(link('synthetic-B')); data.externalIds.push('synthetic-B');
  assert.ok(run(data).entries.every((entry) => entry.reasons.includes('AMBIGUOUS_PERSON_LINK')));
});
test('UUID case is semantic identity; source ID case is untouched', () => {
  const data = fixture(); const lower = 'abcdefab-abcd-4abc-8abc-abcdefabcdef';
  data.links = [link('synthetic-A', lower), link('synthetic-B', lower.toUpperCase())];
  assert.ok(run(data).entries.every((entry) => entry.reasons.includes('AMBIGUOUS_PERSON_LINK')));
});
test('same batch+scope+semantic snapshot is replay; whitespace has distinct raw receipt', () => {
  const data = fixture(); const first = run(data);
  const second = preview(JSON.stringify(data, null, 2), data.scope, [first.receipt]);
  assert.equal(second.replay, 'EXACT_REPLAY'); assert.equal(second.receipt.contentHash, first.receipt.contentHash);
  assert.notEqual(second.provenance.rawReceiptHash, first.provenance.rawReceiptHash);
});
test('row and JSON property order do not change semantic hash', () => {
  const data = fixture(); data.externalIds.push('synthetic-B'); data.links.push(link('synthetic-B', person2));
  const first = run(data); data.externalIds.reverse(); data.links.reverse();
  data.links = data.links.map(({ source_system, source_id, person_id }) => ({ person_id, source_id, source_system }));
  assert.equal(run(data, [first.receipt]).replay, 'EXACT_REPLAY');
});
for (const [label, change] of [
  ['source version', (data) => { data.sourceVersion = 'synthetic-v2'; }],
  ['observed timestamp', (data) => { data.observedAt = '2026-10-20T00:00:00.000Z'; }],
  ['source contents', (data) => { data.externalIds.push('synthetic-B'); }],
  ['Person mapping', (data) => { data.links[0].person_id = person2; }],
]) test(`changed ${label} under same batch quarantines every row`, () => {
  const data = fixture(), first = run(data); change(data); const result = run(data, [first.receipt]);
  assert.equal(result.replay, 'BATCH_CONFLICT'); assert.ok(result.entries.every((entry) => entry.reasons.includes('BATCH_CONFLICT')));
});
test('changed batch is NEW while semantic content hash remains stable', () => {
  const data = fixture(), first = run(data); data.batchId = 'synthetic-batch-2';
  const result = run(data, [first.receipt]); assert.equal(result.replay, 'NEW'); assert.equal(result.receipt.contentHash, first.receipt.contentHash);
});
test('trusted scope is required and scope mismatch is rejected', () => {
  assert.throws(() => preview(JSON.stringify(fixture())), /identifier/);
  assert.throws(() => run(fixture(), [], 'another-scope'), /scope/);
});
test('cross-scope ledger cannot mark this batch replay; changing scope changes hash', () => {
  const data = fixture(), first = run(data); data.scope = 'another-scope';
  const result = run(data, [first.receipt], data.scope);
  assert.equal(result.replay, 'NEW'); assert.notEqual(result.receipt.contentHash, first.receipt.contentHash);
});
test('conflicting ledger history cannot be hidden behind an earlier replay match', () => {
  const first = run(fixture());
  assert.equal(run(fixture(), [first.receipt, { ...first.receipt, contentHash: '0'.repeat(64) }]).replay, 'BATCH_CONFLICT');
});
test('empty snapshot is valid preview with no implied absence/deletion authority', () => {
  const data = fixture(); data.externalIds = []; data.links = [];
  assert.deepEqual(run(data).entries, []); assert.equal(run(data).integrationVerified, false);
});
for (const [label, mutate] of [
  ['non-synthetic', (data) => { data.synthetic = false; }],
  ['source mismatch', (data) => { data.sourceSystem = 'OTHER'; }],
  ['unknown schema', (data) => { data.schemaVersion = 2; }],
  ['unknown name field', (data) => { data.name = 'Synthetic name'; }],
  ['unknown row field', (data) => { data.links[0].email = 'synthetic@example.invalid'; }],
  ['invalid UUID', (data) => { data.links[0].person_id = 'not-a-uuid'; }],
  ['row source mismatch', (data) => { data.links[0].source_system = 'OTHER'; }],
  ['empty source ID', (data) => { data.externalIds = ['']; }],
  ['numeric source ID', (data) => { data.externalIds = [123]; }],
  ['control-character ID', (data) => { data.externalIds = ['a\nb']; }],
  ['invalid date', (data) => { data.observedAt = '2026-02-30T00:00:00.000Z'; }],
  ['timezone ambiguity', (data) => { data.observedAt = '2026-10-19T00:00:00'; }],
  ['missing field', (data) => { delete data.sourceVersion; }],
  ['oversized list', (data) => { data.externalIds = Array(10001).fill('synthetic-A'); }],
]) test(`reject ${label}`, () => { const data = fixture(); mutate(data); assert.throws(() => run(data)); });
test('reject malformed, non-object and oversized JSON text', () => {
  for (const text of ['{', 'null', '[]', '0', ' '.repeat(1024 * 1024 + 1)]) assert.throws(() => preview(text, 'scope'));
});
test('reject malformed replay evidence', () => {
  for (const ledger of [null, [{}], [{ sourceSystem: 'PARIM', scope: 'scope', batchId: 'batch', contentHash: 'invalid' }]]) {
    assert.throws(() => run(fixture(), ledger));
  }
});
test('reject duplicate top-level keys including escaped-equivalent spelling', () => {
  const json = JSON.stringify(fixture());
  for (const duplicate of ['"scope":"other",', '"sco\\u0070e":"other",', '"sourceSystem":"OTHER",', '"batchId":"other",']) {
    assert.throws(() => preview(`{${duplicate}${json.slice(1)}`, 'synthetic-review-scope'), /Duplicate JSON object key/);
  }
});
test('reject nested duplicate keys including escaped-equivalent Person keys', () => {
  const json = JSON.stringify(fixture());
  for (const key of ['person_id', 'person_\\u0069d']) {
    const duplicate = json.replace('"person_id":', `"${key}":"${person2}","person_id":`);
    assert.throws(() => preview(duplicate, 'synthetic-review-scope'), /Duplicate JSON object key/);
  }
});
test('structural scanner respects braces, brackets, escaped quotes and backslashes in strings', () => {
  const data = fixture(); const opaque = 'synthetic-{"scope":"x"}[]\\"suffix';
  data.externalIds = [opaque]; data.links = [link(opaque)];
  assert.equal(run(data).entries[0].externalId, opaque);
  assert.equal(run(data).entries[0].state, 'EXACT_EXISTING_LINK');
});
test('reject unknown prototype keys and bound deeply nested JSON', () => {
  const json = JSON.stringify(fixture());
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    assert.throws(() => preview(`{"${key}":{},${json.slice(1)}`, 'synthetic-review-scope'), /Unexpected or missing field/);
  }
  assert.throws(() => preview('['.repeat(70) + '0' + ']'.repeat(70), 'scope'), /nesting/);
});
test('caller inputs and ledger remain unchanged; repeated results deterministic', () => {
  const data = fixture(), before = JSON.stringify(data), first = run(data), ledger = [first.receipt], saved = JSON.stringify(ledger);
  assert.deepEqual(run(data, ledger), run(data, ledger)); assert.equal(JSON.stringify(data), before); assert.equal(JSON.stringify(ledger), saved);
});
