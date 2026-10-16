import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

// Execute production TS modules with explicit, network-free boundaries. RLS/RPC
// results below are fixtures, not evidence that a deployed database enforces them.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nativeRequire = createRequire(import.meta.url);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = { request: id(1), document: id(2), version: id(3), old: id(4), assignment: id(5), person: id(6), other: id(7) };
const actor = (role = 'SECURITY_STAFF', personId = ids.person) => ({ personId, roles: [role], incidentReviewer: false });
const bytes = new TextEncoder().encode('%PDF-1.4 synthetic only');
const version = { id: ids.version, document_id: ids.document, version_number: 2,
  object_key: 'private-object-sentinel', original_filename: 'synthetic-only.pdf', mime_type: 'application/pdf',
  byte_size: bytes.length, sha256: 'a'.repeat(64), uploader_person_id: ids.person,
  upload_state: 'SUBMITTED', scan_state: 'NOT_SCANNED', submitted_at: '2026-10-16T12:00:00Z' };
const evidence = () => ({ request: { id: ids.request, title: 'Synthetic private evidence', status: 'SUBMITTED',
  target_person_id: ids.person, requester_person_id: ids.other, site_id: null },
  documentId: ids.document, versions: [version, { ...version, id: ids.old, version_number: 1 }], reviews: [], subjectName: 'Synthetic Person' });

function harness({ principal = actor(), tables = {}, rpc = {}, source = evidence(), caps = { assign: false, publish: false },
  assignments = [{ id: ids.assignment, version_id: ids.version, current: true, conflict: false }],
  fileInfo = { objectKey: 'private-object-sentinel', versionId: ids.version, sha256: 'a'.repeat(64) },
  onboarding = null, storageBytes = bytes } = {}) {
  const calls = [], cache = new Map();
  const client = {
    from(table) {
      calls.push(['table', table]);
      let rows = tables[table] ?? [], single = false;
      const query = {
        select() { return query; }, eq(key, value) { rows = rows.filter((r) => r[key] === value); return query; },
        order() { return query; }, limit(n) { rows = rows.slice(0, n); return query; },
        maybeSingle() { single = true; return query; }, returns() { return query; },
        then(yes, no) { return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null, count: rows.length }).then(yes, no); },
      };
      return query;
    },
    async rpc(name, args) {
      calls.push(['rpc', name, args]);
      if (Object.hasOwn(rpc, name)) return typeof rpc[name] === 'function' ? rpc[name](args) : rpc[name];
      if (name === 'operational_document_my_list') return { data: { assignments }, error: null };
      if (name === 'operational_document_file_info') return { data: fileInfo, error: null };
      if (name === 'document_subject_name') return { data: 'Synthetic Person', error: null };
      if (name === 'operational_document_capabilities') return { data: caps, error: null };
      return { data: true, error: null };
    },
    storage: { from(bucket) { return { async download(key) {
      calls.push(['storage', bucket, key]); return { data: new Blob([bytes]), error: null };
    } }; } },
  };
  const mocks = {
    '@/lib/auth/principal': { getPrincipal: async () => principal, isUuid: (s) => typeof s === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s) },
    '@/lib/supabase/server': { createServerSupabase: async () => client },
    '@/lib/documents/server-proof': { documentServerProof: (...parts) => { calls.push(['proof', ...parts]); return 'synthetic-proof'; } },
    '@/lib/controlled/server-storage': { downloadOperationalPdf: async (...args) => { calls.push(['private-download', ...args]); return storageBytes; } },
    '@/lib/onboarding/policy': { readOnboardingCase: async () => onboarding },
    '@/lib/tasks/tfs-work': { listTfsIssueWork: async () => [] },
  };
  function load(path) {
    const absolute = resolve(root, path);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const loaded = { exports: {} }; cache.set(absolute, loaded);
    const js = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    function requireModule(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
      if (name.startsWith('.')) return load(resolve(dirname(absolute), `${name}.ts`));
      if (name === 'next/server') return nativeRequire(name);
      throw new Error(`Unmocked dependency: ${name}`);
    }
    const context = vm.createContext({ module: loaded, exports: loaded.exports, require: requireModule, Response, Request, Blob, Buffer,
      fetch: () => { throw new Error('Network forbidden in local audience checks'); } });
    new vm.Script(js, { filename: absolute }).runInContext(context);
    return loaded.exports;
  }
  function stubSource() {
    const policy = load('src/lib/documents/policy.ts');
    mocks['@/lib/documents/policy'] = { ...policy, readDocumentRequest: async () => source };
  }
  return { calls, client, load, stubSource };
}
const params = (extra = {}) => ({ params: Promise.resolve({ id: ids.request, versionId: ids.version, ...extra }) });
const post = (body) => new Request('http://localhost/synthetic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function denial(response, status) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  assert.doesNotMatch(await response.text(), /private-object-sentinel|synthetic-only.pdf|Synthetic private evidence|Synthetic Person|objectKey|sha256/);
}
const personnelFile = 'src/app/api/documents/[id]/versions/[versionId]/file/route.ts';
const operationalFile = 'src/app/api/operational-documents/my/[id]/file/route.ts';

for (const role of ['SECURITY_STAFF', 'OFFICE_ADMIN', 'SUPER_ADMIN']) {
  test(`${role}: personnel list/detail/download preserve scoped denial and metadata boundary`, async () => {
    const h = harness({ principal: actor(role) }); // No rows returned by mocked RLS.
    const list = await h.load('src/app/api/documents/route.ts').GET();
    assert.equal(list.status, 200); assert.deepEqual(await list.json(), { count: 0, requests: [] });
    await denial(await h.load('src/app/api/documents/[id]/route.ts').GET(null, params()), 404);
    await denial(await h.load(personnelFile).GET(null, params()), 404);
    assert.ok(!h.calls.some(([kind]) => kind === 'storage'));
  });
  test(`${role}: permitted exact personnel version streams without internal storage metadata`, async () => {
    const h = harness({ principal: actor(role) }); h.stubSource();
    const response = await h.load(personnelFile).GET(null, params());
    assert.equal(response.status, 200); assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.doesNotMatch(JSON.stringify([...response.headers]), /private-object-sentinel|synthetic-proof/);
    assert.equal(h.calls.filter((c) => c[1] === 'audit_document_privileged_read').length, role === 'SUPER_ADMIN' ? 1 : 0);
  });
}

test('unauthenticated and Operations personnel callers are denied before lookup', async () => {
  for (const [principal, status] of [[null, 401], [actor('OPERATIONS'), 403]]) {
    const h = harness({ principal });
    for (const route of ['src/app/api/documents/route.ts', 'src/app/api/documents/[id]/route.ts', personnelFile])
      await denial(await h.load(route).GET(null, params()), status);
    assert.equal(h.calls.length, 0);
  }
});

test('personnel projection excludes object keys, pending bytes and preserves exact review history', () => {
  const h = harness(), source = evidence();
  source.versions.unshift({ ...version, id: id(99), upload_state: 'PENDING_UPLOAD' });
  source.reviews = [{ id: id(20), version_id: ids.old, decision: 'REJECTED' }];
  const result = h.load('src/lib/documents/policy.ts').publicDocument(source);
  assert.equal(result.version.id, ids.version); assert.equal(result.versions.length, 2);
  assert.equal(result.versions[1].review.id, id(20)); assert.equal(result.version.review, null);
  assert.equal(result.hasPendingUpload, true); assert.doesNotMatch(JSON.stringify(result), /object_key|private-object-sentinel|PENDING_UPLOAD/);
  assert.equal(source.reviews.length, 1); assert.equal(source.versions.length, 3);
});

test('guessed and pending personnel version IDs never fetch bytes', async () => {
  for (const versionId of [id(99), 'not-a-uuid', id(98)]) {
    const source = evidence(); source.versions.push({ ...version, id: id(98), upload_state: 'PENDING_UPLOAD' });
    const h = harness({ source }); h.stubSource();
    await denial(await h.load(personnelFile).GET(null, params({ versionId })), 404);
    assert.ok(!h.calls.some(([kind]) => kind === 'storage'));
  }
});

test('personnel list/detail compose visible exact source records without object keys', async () => {
  const source = evidence();
  const tables = { document_requests: [source.request], documents: [{ id: ids.document, request_id: ids.request }],
    document_versions: source.versions, document_reviews: [] };
  for (const role of ['SECURITY_STAFF', 'OFFICE_ADMIN', 'SUPER_ADMIN']) {
    const h = harness({ principal: actor(role), tables });
    const list = await h.load('src/app/api/documents/route.ts').GET();
    const body = await list.json();
    assert.equal(body.count, 1); assert.equal(body.requests[0].id, ids.request);
    assert.equal(body.requests[0].version.id, ids.version);
    assert.doesNotMatch(JSON.stringify(body), /object_key|private-object-sentinel/);
    const detail = await h.load('src/app/api/documents/[id]/route.ts').GET(null, params());
    assert.equal(detail.status, 200); assert.equal((await detail.json()).request.id, ids.request);
  }
});

test('Super Admin audit refusal prevents personnel byte response', async () => {
  const h = harness({ principal: actor('SUPER_ADMIN'), rpc: { audit_document_privileged_read: { data: null, error: { message: 'synthetic denial' } } } });
  h.stubSource(); await denial(await h.load(personnelFile).GET(null, params()), 503);
  assert.ok(h.calls.some((c) => c[0] === 'proof' && c[1] === 'read' && c[3] === ids.version));
});

test('current personnel file alias chooses latest submitted version and audits exact version', async () => {
  const route = 'src/app/api/documents/[id]/file/route.ts';
  const denied = harness({ source: null }); denied.stubSource();
  await denial(await denied.load(route).GET(null, params()), 404);
  const source = evidence(); source.versions.unshift({ ...version, id: id(98), upload_state: 'PENDING_UPLOAD' });
  const h = harness({ principal: actor('SUPER_ADMIN'), source }); h.stubSource();
  assert.equal((await h.load(route).GET(null, params())).status, 200);
  assert.equal(h.calls.find((c) => c[1] === 'audit_document_privileged_read')[2].requested_version, ids.version);
});

test('personnel review denies self review despite privileged role and rejects historical versions', async () => {
  const route = 'src/app/api/documents/[id]/reviews/route.ts';
  for (const role of ['OFFICE_ADMIN', 'SUPER_ADMIN']) {
    const h = harness({ principal: actor(role) }); h.stubSource();
    await denial(await h.load(route).POST(post({ versionId: ids.version, decision: 'ACCEPTED_AS_EVIDENCE' }), params()), 404);
    assert.ok(!h.calls.some((c) => c[1] === 'review_document_version'));
  }
  const h = harness({ principal: actor('OFFICE_ADMIN', ids.other) }); h.stubSource();
  await denial(await h.load(route).POST(post({ versionId: ids.old, decision: 'ACCEPTED_AS_EVIDENCE' }), params()), 409);
  assert.ok(!h.calls.some((c) => c[1] === 'review_document_version'));
  assert.equal((await h.load(route).POST(post({ versionId: ids.version, decision: 'ACCEPTED_AS_EVIDENCE' }), params())).status, 201);
  assert.equal(h.calls.find((c) => c[1] === 'review_document_version')[2].reviewed_version, ids.version);
});

for (const state of ['outside', 'historical', 'conflict', 'list-error']) {
  test(`operational ${state}: no PDF or open event`, async () => {
    const h = harness({ assignments: state === 'outside' ? [] : [{ id: ids.assignment, version_id: ids.version, current: state !== 'historical', conflict: state === 'conflict' }],
      rpc: state === 'list-error' ? { operational_document_my_list: { data: null, error: {} } } : {} });
    await denial(await h.load(operationalFile).GET(null, params({ id: ids.assignment })), 404);
    assert.ok(!h.calls.some((c) => c[0] === 'private-download' || c[1] === 'operational_document_open'));
  });
}

test('operational current version records open, verifies source and rechecks after private download', async () => {
  const h = harness();
  const response = await h.load(operationalFile).GET(null, params({ id: ids.assignment }));
  assert.equal(response.status, 200); assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  assert.match(response.headers.get('content-disposition'), /^inline/);
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  assert.equal(h.calls.filter((c) => c[1] === 'operational_document_file_info').length, 2);
  const names = h.calls.filter((c) => c[0] === 'rpc').map((c) => c[1]);
  assert.deepEqual(names, ['operational_document_my_list', 'operational_document_open', 'operational_document_file_info', 'operational_document_file_info']);
  assert.ok(!names.includes('operational_document_acknowledge'));
});

for (const change of ['revoked', 'version', 'key', 'hash-failure', 'open-denied']) {
  test(`operational ${change} during retrieval fails closed`, async () => {
    let reads = 0;
    const h = harness({ storageBytes: change === 'hash-failure' ? null : bytes, rpc: {
      ...(change === 'open-denied' ? { operational_document_open: { data: null, error: {} } } : {}),
      operational_document_file_info: () => {
        reads++;
        const info = { objectKey: 'private-object-sentinel', versionId: ids.version, sha256: 'a'.repeat(64) };
        if (reads === 2 && change === 'revoked') return { data: null, error: {} };
        if (reads === 2 && change === 'version') info.versionId = ids.old;
        if (reads === 2 && change === 'key') info.objectKey = 'changed-private-key';
        return { data: info, error: null };
      },
    } });
    await denial(await h.load(operationalFile).GET(null, params({ id: ids.assignment })), 404);
  });
}

test('audience preview requires assignment authority and masks RPC failure details', async () => {
  for (const role of ['SECURITY_STAFF', 'OFFICE_ADMIN', 'SUPER_ADMIN', 'OPERATIONS']) {
    const h = harness({ principal: actor(role) });
    await denial(await h.load('src/app/api/operational-documents/preview/route.ts').POST(post({})), 403);
    assert.ok(!h.calls.some((c) => c[1] === 'operational_document_assignment_preview'));
  }
  const h = harness({ caps: { assign: true }, rpc: { operational_document_assignment_preview: { data: null, error: { message: 'private-object-sentinel' } } } });
  await denial(await h.load('src/app/api/operational-documents/preview/route.ts').POST(post({ versionId: ids.version, targetId: ids.person,
    targetKind: 'PERSON', effectiveFrom: '2026-10-16T12:00:00Z' })), 409);
});

test('granted audience preview forwards exact version/context and returns resolved synthetic audience', async () => {
  const h = harness({ principal: actor('OFFICE_ADMIN'), caps: { assign: true }, rpc: {
    operational_document_assignment_preview: { data: { recipients: [{ personId: ids.person }], versionId: ids.version }, error: null },
  } });
  const response = await h.load('src/app/api/operational-documents/preview/route.ts').POST(post({
    versionId: ids.version, targetKind: 'PERSON', targetId: ids.person, effectiveFrom: '2026-10-16T12:00:00Z',
  }));
  assert.equal(response.status, 200); assert.equal((await response.json()).recipients[0].personId, ids.person);
  const args = h.calls.find((c) => c[1] === 'operational_document_assignment_preview')[2];
  assert.equal(args.requested_version, ids.version); assert.equal(args.target_id, ids.person);
  assert.equal(args.context_kind, null); assert.equal(args.context_id, null);
});

test('operational self list and manager detail retain scoped RPC boundaries and private responses', async () => {
  for (const role of ['SECURITY_STAFF', 'OFFICE_ADMIN', 'SUPER_ADMIN', 'OPERATIONS']) {
    const h = harness({ principal: actor(role), assignments: [] });
    const response = await h.load('src/app/api/operational-documents/my/route.ts').GET();
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { assignments: [] });
    await denial(await h.load('src/app/api/operational-documents/assignments/[id]/route.ts').GET(null, params()), 403);
  }
  const h = harness({ caps: { assign: true }, rpc: { operational_document_status: { data: null, error: { message: 'private-object-sentinel' } } } });
  await denial(await h.load('src/app/api/operational-documents/assignments/[id]/route.ts').GET(null, params()), 403);
});

test('manager PDF retrieval needs explicit capability and fresh exact source authority', async () => {
  const route = 'src/app/api/operational-documents/assignments/[id]/file/route.ts';
  const denied = harness({ principal: actor('SUPER_ADMIN') });
  await denial(await denied.load(route).GET(null, params()), 404);
  assert.ok(!denied.calls.some((c) => c[0] === 'private-download'));
  const allowed = harness({ principal: actor('OFFICE_ADMIN'), caps: { assign: true } });
  assert.equal((await allowed.load(route).GET(null, params())).status, 200);
  assert.equal(allowed.calls.filter((c) => c[1] === 'operational_document_file_info').length, 2);
  const outside = harness({ caps: { assign: true }, fileInfo: null });
  await denial(await outside.load(route).GET(null, params()), 404);
});

test('operational acknowledgement requires explicit confirmation and exact current own assignment', async () => {
  const route = 'src/app/api/operational-documents/my/[id]/acknowledge/route.ts';
  const h = harness();
  await denial(await h.load(route).POST(post({ confirmed: false }), params({ id: ids.assignment })), 400);
  assert.equal(h.calls.length, 0);
  const out = harness({ assignments: [] });
  await denial(await out.load(route).POST(post({ confirmed: true, personId: ids.other, versionId: ids.old }), params({ id: ids.assignment })), 403);
  const response = await h.load(route).POST(post({ confirmed: true, personId: ids.other, versionId: ids.old }), params({ id: ids.assignment }));
  assert.equal(response.status, 201);
  assert.ok(h.calls.some((c) => c[0] === 'proof' && c[1] === 'operational_ack' && c[3] === ids.version));
  const ack = h.calls.find((c) => c[1] === 'operational_document_acknowledge');
  assert.deepEqual(Object.keys(ack[2]).sort(), ['assignment_id', 'server_proof']);
});

test('onboarding personal attestation remains owner-only even with Super Admin role', async () => {
  const route = 'src/app/api/onboarding/[id]/contract/acknowledge/route.ts';
  const onboarding = { state: 'IN_PROGRESS', personId: ids.person, requirements: [{ code: 'CONTRACT_TERMS', controlled: { assignmentId: ids.assignment, acknowledgedAt: null } }] };
  for (const principal of [actor('SUPER_ADMIN'), actor('OFFICE_ADMIN'), actor('SECURITY_STAFF', ids.other)]) {
    const h = harness({ principal, onboarding });
    await denial(await h.load(route).POST(post({ confirmed: true }), params()), 403);
    assert.equal(h.calls.length, 0);
  }
  const h = harness({ onboarding });
  assert.equal((await h.load(route).POST(post({ confirmed: true }), params())).status, 201);
  assert.equal(h.calls.find((c) => c[1] === 'acknowledge_controlled_assignment')[2].requested_assignment, ids.assignment);
});

test('My Work rechecks private document source and exact completed review before exposing task', async () => {
  const row = { id: id(30), task_type: 'DOCUMENT_REVIEW', source_kind: 'DOCUMENT_VERSION', source_id: ids.version,
    assignee_person_id: ids.other, state: 'OPEN', title: 'Synthetic review', created_at: '2026-10-16' };
  const tables = { document_versions: [version], documents: [{ id: ids.document, request_id: ids.request, classification: 'PERSONNEL_PRIVATE' }] };
  for (const role of ['SECURITY_STAFF', 'OFFICE_ADMIN', 'SUPER_ADMIN']) {
    const h = harness({ principal: actor(role), tables, source: null }); h.stubSource();
    assert.equal(await h.load('src/lib/tasks/policy.ts').resolveTask(h.client, actor(role), row), null);
  }
  const h = harness({ principal: actor('OFFICE_ADMIN'), tables }); h.stubSource();
  const resolveTask = h.load('src/lib/tasks/policy.ts').resolveTask;
  const resolved = await resolveTask(h.client, actor('OFFICE_ADMIN'), row);
  assert.equal(resolved.sourceId, ids.version); assert.match(resolved.sourceHref, new RegExp(ids.version));
  assert.equal(await resolveTask(h.client, actor('OFFICE_ADMIN'), { ...row, state: 'DONE', completion_event_id: id(88) }), null);
});
