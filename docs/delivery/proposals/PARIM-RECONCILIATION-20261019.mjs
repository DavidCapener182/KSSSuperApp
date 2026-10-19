// Synthetic-only, in-memory identity-link review. No I/O, adapter, import or writes.
import { createHash } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const fail = (message) => { throw new TypeError(message); };
const object = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !keys.includes(key))
    || keys.some((key) => !Object.hasOwn(value, key))) fail('Unexpected or missing field');
};
const id = (value) => {
  if (typeof value !== 'string' || !value.length || value.length > 200
    || value.trim() !== value || /[\x00-\x1f\x7f]/.test(value)) fail('Invalid exact identifier');
  return value;
};
const sourceId = (value) => {
  if (typeof value !== 'string' || !value.length || value.length > 200
    || /[\x00-\x1f\x7f]/.test(value)) fail('Invalid opaque source identifier');
};
const list = (value) => {
  if (!Array.isArray(value) || value.length > 10000) fail('Expected bounded array');
};
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sorted = (values) => [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);

// Run only AFTER JSON.parse has validated JSON grammar. Walk structural tokens
// to reject decoded duplicate keys before any last-key-wins value is trusted.
function rejectDuplicateKeys(text) {
  let position = 0;
  const whitespace = () => { while (/\s/.test(text[position] ?? '') && position < text.length) position++; };
  const string = () => {
    const start = position++;
    while (position < text.length) {
      if (text[position] === '\\') { position += 2; continue; }
      if (text[position++] === '"') break;
    }
    return JSON.parse(text.slice(start, position));
  };
  const walk = (depth) => {
    if (depth > 64) fail('JSON nesting exceeds preview bound');
    whitespace();
    if (text[position] === '{') {
      position++; whitespace();
      const keys = new Set();
      if (text[position] === '}') { position++; return; }
      while (position < text.length) {
        whitespace(); const key = string();
        if (keys.has(key)) fail('Duplicate JSON object key');
        keys.add(key); whitespace(); position++; // colon, grammar already valid
        walk(depth + 1); whitespace();
        if (text[position++] === '}') return;
      }
    } else if (text[position] === '[') {
      position++; whitespace();
      if (text[position] === ']') { position++; return; }
      while (position < text.length) {
        walk(depth + 1); whitespace();
        if (text[position++] === ']') return;
      }
    } else if (text[position] === '"') string();
    else while (position < text.length && !/[\s,}\]]/.test(text[position])) position++;
  };
  walk(0);
}

/**
 * Explicit synthetic fixture format, NOT an asserted PARiM export format.
 * Ledger is caller-held, untrusted replay evidence, never synchronisation state.
 */
export function previewSyntheticIdentityLinks(json, trustedScope, ledger = []) {
  if (typeof json !== 'string' || Buffer.byteLength(json) > 1024 * 1024) fail('Expected bounded JSON text');
  const input = JSON.parse(json);
  rejectDuplicateKeys(json);
  object(input, ['synthetic', 'schemaVersion', 'sourceSystem', 'scope', 'batchId', 'sourceVersion', 'observedAt', 'externalIds', 'links']);
  if (input.synthetic !== true || input.schemaVersion !== 1 || input.sourceSystem !== 'PARIM') fail('Synthetic PARIM v1 only');
  for (const key of ['scope', 'batchId', 'sourceVersion']) id(input[key]);
  id(trustedScope);
  if (input.scope !== trustedScope) fail('Snapshot scope does not match trusted review scope');
  if (typeof input.observedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.observedAt)
    || !Number.isFinite(Date.parse(input.observedAt)) || new Date(input.observedAt).toISOString() !== input.observedAt) fail('Expected exact UTC timestamp');
  list(input.externalIds); list(input.links); list(ledger);
  input.externalIds.forEach(sourceId);
  input.links.forEach((link) => {
    object(link, ['source_system', 'source_id', 'person_id']);
    if (link.source_system !== 'PARIM') fail('Source system mismatch');
    sourceId(link.source_id);
    if (typeof link.person_id !== 'string' || !UUID.test(link.person_id)) fail('Invalid Person UUID');
  });
  ledger.forEach((entry) => {
    object(entry, ['sourceSystem', 'scope', 'batchId', 'contentHash']);
    if (entry.sourceSystem !== 'PARIM') fail('Ledger source mismatch');
    id(entry.scope); id(entry.batchId);
    if (typeof entry.contentHash !== 'string' || !HASH.test(entry.contentHash)) fail('Invalid ledger hash');
  });
  // Canonical semantic content; preserve opaque source IDs, canonicalise UUIDs only.
  const snapshot = { schemaVersion: 1, sourceSystem: 'PARIM', scope: input.scope,
    sourceVersion: input.sourceVersion, observedAt: input.observedAt,
    externalIds: sorted(input.externalIds), links: input.links.map((link) => ({ source_system: 'PARIM', source_id: link.source_id, person_id: link.person_id.toLowerCase() }))
      .sort((a, b) => a.source_id < b.source_id ? -1 : a.source_id > b.source_id ? 1 : a.person_id < b.person_id ? -1 : a.person_id > b.person_id ? 1 : 0) };
  const contentHash = digest(snapshot);
  const receipt = { sourceSystem: 'PARIM', scope: input.scope, batchId: input.batchId, contentHash };
  const prior = ledger.filter((entry) => entry.scope === input.scope && entry.batchId === input.batchId);
  const replay = prior.length === 0 ? 'NEW' : prior.every((entry) => entry.contentHash === contentHash) ? 'EXACT_REPLAY' : 'BATCH_CONFLICT';
  const sourceCounts = new Map(), linksById = new Map(), personCounts = new Map();
  for (const externalId of input.externalIds) sourceCounts.set(externalId, (sourceCounts.get(externalId) ?? 0) + 1);
  for (const link of snapshot.links) {
    linksById.set(link.source_id, [...(linksById.get(link.source_id) ?? []), link]);
    personCounts.set(link.person_id, (personCounts.get(link.person_id) ?? 0) + 1);
  }
  const entries = sorted(new Set([...input.externalIds, ...snapshot.links.map((link) => link.source_id)]))
    .map((externalId) => {
      const links = linksById.get(externalId) ?? [];
      const reasons = [];
      if ((sourceCounts.get(externalId) ?? 0) > 1) reasons.push('DUPLICATE_SOURCE_ID');
      if (links.length > 1) reasons.push('DUPLICATE_LINK_ID');
      if (links.some((link) => personCounts.get(link.person_id) > 1)) reasons.push('AMBIGUOUS_PERSON_LINK');
      if (replay === 'BATCH_CONFLICT') reasons.push('BATCH_CONFLICT');
      if (reasons.length) return { externalId, state: 'REVIEW_REQUIRED', reasons };
      if (!sourceCounts.has(externalId)) return { externalId, state: 'REVIEW_REQUIRED', reasons: ['NOT_IN_DECLARED_SNAPSHOT'] };
      if (!links.length) return { externalId, state: 'REVIEW_REQUIRED', reasons: ['NO_EXISTING_LINK'] };
      return { externalId, state: 'EXACT_EXISTING_LINK', personId: links[0].person_id, reasons: [] };
    });
  return { mode: 'SYNTHETIC_READ_ONLY_PREVIEW', integrationVerified: false,
    freshness: 'UNVERIFIED', retention: 'OWNER_DECISION_REQUIRED', replay, receipt,
    provenance: { sourceVersion: input.sourceVersion, observedAt: input.observedAt, scope: input.scope,
      rawReceiptHash: createHash('sha256').update(json).digest('hex') }, entries };
}
