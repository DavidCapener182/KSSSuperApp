import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const bucket = 'enterprise-personnel-evidence';
const staffA = '10000000-0000-4000-8000-000000000003';
const siteA = '30000000-0000-4000-8000-000000000001';
const people = {
  admin: [process.env.KSS_TEST_ADMIN_EMAIL, process.env.KSS_TEST_ADMIN_PASSWORD],
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  officeB: [process.env.KSS_TEST_OFFICE_B_EMAIL, process.env.KSS_TEST_OFFICE_B_PASSWORD],
  a: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
  b: [process.env.KSS_TEST_STAFF_B_EMAIL, process.env.KSS_TEST_STAFF_B_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
  unmapped: [process.env.KSS_TEST_UNMAPPED_EMAIL, process.env.KSS_TEST_UNMAPPED_PASSWORD],
};
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const proof = (...parts) => createHmac('sha256', Buffer.from(process.env.KSS_DOCUMENT_SIGNING_SECRET, 'hex')).update(parts.join('\x1f')).digest('hex');
function client() { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function credentials(as) {
  let cookies = [];
  const browserClient = createServerClient(url, key, { cookies: {
    getAll: () => cookies,
    setAll: (items) => { cookies = items.map(({ name, value }) => ({ name, value })); },
  } });
  const signed = client();
  const a = await browserClient.auth.signInWithPassword({ email: people[as][0], password: people[as][1] });
  assert.ifError(a.error);
  const b = await signed.auth.signInWithPassword({ email: people[as][0], password: people[as][1] });
  assert.ifError(b.error);
  return { db: signed, cookie: cookies.map(({ name, value }) => `${name}=${value}`).join('; ') };
}
async function port() {
  const s = createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening');
  const p = s.address().port; s.close(); await once(s, 'close'); return p;
}

test('02B exact-version review, replacement and isolation', { timeout: 240000 }, async () => {
  assert.ok(url && key && process.env.KSS_DOCUMENT_SIGNING_SECRET);
  const actors = {};
  for (const name of Object.keys(people)) actors[name] = await credentials(name);
  const appPort = await port();
  const base = `http://127.0.0.1:${appPort}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(appPort)], { cwd: process.cwd(), stdio: 'ignore' });
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(base); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
    const request = (path, as, options = {}) => fetch(base + path, { redirect: 'manual', ...options,
      headers: { ...(as ? { cookie: actors[as].cookie } : {}), ...(options.headers ?? {}) } });
    const json = (value) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    const upload = (id, as, bytes, name, type) => { const form = new FormData(); form.set('file', new File([bytes], name, { type }));
      return request(`/api/documents/${id}/upload`, as, { method: 'POST', body: form }); };
    const newRequest = async (title) => {
      const r = await request('/api/documents', 'office', json({ targetPersonId: staffA, siteId: siteA, title }));
      const body = await r.text();
      assert.equal(r.status, 201, body); return JSON.parse(body).id;
    };
    const id = await newRequest(`Synthetic 02B review ${Date.now()}`);
    const early = await request(`/api/documents/${id}/reviews`, 'office', json({ versionId: randomUUID(), decision: 'ACCEPTED_AS_EVIDENCE' }));
    assert.equal(early.status, 409);
    const firstUpload = await upload(id, 'a', pdf, 'synthetic-first.pdf', 'application/pdf');
    assert.equal(firstUpload.status, 201, await firstUpload.text());
    const before = (await (await request(`/api/documents/${id}`, 'office')).json()).request;
    const first = before.version;
    assert.equal(first.number, 1);
    assert.equal(before.workflowStatus, 'AWAITING_REVIEW');
    assert.equal(first.scanState, 'NOT_SCANNED');
    const original = await actors.admin.db.from('document_versions').select('object_key,sha256,byte_size').eq('id', first.id).single();
    assert.ifError(original.error);
    const bytes1 = await request(`/api/documents/${id}/versions/${first.id}/file`, 'office');
    assert.equal(bytes1.status, 200);
    assert.deepEqual(Buffer.from(await bytes1.arrayBuffer()), pdf);
    for (const as of [undefined, 'a', 'b', 'officeB', 'operations', 'unmapped']) {
      const response = await request(`/api/documents/${id}/reviews`, as, json({ versionId: first.id, decision: 'REJECTED', reasonCode: 'INCOMPLETE', comment: 'Please provide all pages.' }));
      assert.ok([401,403,404].includes(response.status), `${as}: ${response.status}`);
    }
    const otherReviews = await actors.b.db.from('document_reviews').select('id');
    assert.ifError(otherReviews.error);
    assert.deepEqual(otherReviews.data, []);
    assert.deepEqual((await actors.officeB.db.from('document_reviews').select('id').eq('request_id', id)).data, []);
    assert.deepEqual((await actors.operations.db.from('document_reviews').select('id')).data, []);
    const forgedRpc = await actors.officeB.db.rpc('review_document_version', { requested_id: id, reviewed_version: first.id,
      supplied_decision: 'REJECTED', supplied_reason: 'OTHER', supplied_comment: 'A valid length comment.' });
    assert.ok(forgedRpc.error);
    const badReason = await request(`/api/documents/${id}/reviews`, 'office', json({ versionId: first.id,
      decision: 'REJECTED', reasonCode: 'OTHER', comment: 'short' }));
    assert.equal(badReason.status, 400);
    const wrongRequest = await newRequest(`Synthetic 02B cross request ${Date.now()}`);
    const cross = await actors.office.db.rpc('review_document_version', { requested_id: wrongRequest, reviewed_version: first.id,
      supplied_decision: 'REJECTED', supplied_reason: 'OTHER', supplied_comment: 'This belongs to another request.' });
    assert.ok(cross.error);
    const reject = await request(`/api/documents/${id}/reviews`, 'office', json({ versionId: first.id,
      decision: 'REJECTED', reasonCode: 'INCOMPLETE', comment: 'Please upload all pages of this synthetic document.' }));
    assert.equal(reject.status, 201, await reject.text());
    const review1 = (await (await actors.office.db.from('document_reviews').select('*').eq('version_id', first.id).single()).data);
    assert.equal(review1.decision, 'REJECTED');
    assert.equal(review1.reason_code, 'INCOMPLETE');
    assert.equal(review1.reviewer_person_id, '10000000-0000-4000-8000-000000000002');
    const staffState = (await (await request(`/api/documents/${id}`, 'a')).json()).request;
    assert.equal(staffState.workflowStatus, 'REJECTED_ACTION_REQUIRED');
    assert.match(staffState.version.review.reviewer_comment, /all pages/);
    assert.equal((await request(`/api/documents/${id}`, 'b')).status, 404);
    assert.equal((await request(`/api/documents/${id}/versions/${first.id}/file`, 'b')).status, 404);
    assert.equal((await actors.b.db.storage.from(bucket).download(original.data.object_key)).data, null);
    assert.equal((await request(`/api/documents/${id}/reviews`, 'office', json({ versionId: first.id,
      decision: 'ACCEPTED_AS_EVIDENCE' }))).status, 409);
    const edit = await actors.office.db.from('document_reviews').update({ decision: 'ACCEPTED_AS_EVIDENCE' }).eq('id', review1.id).select('id');
    assert.ok(edit.error || edit.data?.length === 0);
    const del = await actors.office.db.from('document_reviews').delete().eq('id', review1.id).select('id');
    assert.ok(del.error || del.data?.length === 0);
    assert.ok((await actors.office.db.from('document_reviews').insert({ request_id: id, document_id: randomUUID(),
      version_id: first.id, reviewer_person_id: staffA, decision: 'REJECTED', reason_code: 'OTHER', reviewer_comment: 'Invalid direct insert.' })).error);
    assert.ok((await actors.office.db.from('audit_events').insert({ affected_person_id: staffA, entity_type: 'document_review',
      entity_id: review1.id, action: 'INSERT' })).error);
    const beginArgs = { requested_id: id, supplied_name: 'synthetic-second.png', supplied_mime: 'image/png',
      supplied_size: png.length, supplied_sha256: hash(png),
      server_proof: proof('begin', id, 'synthetic-second.png', 'image/png', String(png.length), hash(png)) };
    assert.ok((await actors.a.db.rpc('begin_document_upload', { ...beginArgs, server_proof: '0'.repeat(64) })).error);
    const [pendingA, pendingB] = await Promise.all([actors.a.db.rpc('begin_document_upload', beginArgs), actors.a.db.rpc('begin_document_upload', beginArgs)]);
    assert.ifError(pendingA.error); assert.ifError(pendingB.error);
    assert.equal(pendingA.data[0].version_id, pendingB.data[0].version_id);
    const pendingVersion = pendingA.data[0];
    assert.notEqual(pendingVersion.version_id, first.id);
    assert.ok((await actors.a.db.storage.from(bucket).upload(`${staffA}/${id}/${randomUUID()}`, png, { contentType: 'image/png' })).error);
    assert.equal((await request(`/api/documents/${id}/reviews`, 'office', json({ versionId: pendingVersion.version_id,
      decision: 'ACCEPTED_AS_EVIDENCE' }))).status, 409);
    const pendingState = (await (await request(`/api/documents/${id}`, 'a')).json()).request;
    assert.equal(pendingState.workflowStatus, 'REJECTED_ACTION_REQUIRED');
    assert.equal(pendingState.hasPendingUpload, true);
    const stored = await actors.a.db.storage.from(bucket).upload(pendingVersion.object_key, png, { contentType: 'image/png', upsert: false });
    assert.ifError(stored.error);
    assert.ok((await actors.a.db.rpc('finalize_document_upload', { requested_id: id,
      version_id: pendingVersion.version_id, server_proof: '0'.repeat(64) })).error);
    const resumed = await upload(id, 'a', png, 'synthetic-second.png', 'image/png');
    assert.equal(resumed.status, 201, await resumed.text());
    const after = (await (await request(`/api/documents/${id}`, 'office')).json()).request;
    assert.equal(after.workflowStatus, 'AWAITING_REVIEW');
    assert.equal(after.version.number, 2);
    assert.notEqual(after.version.id, first.id);
    assert.equal(after.version.review, null);
    assert.equal(after.versions.length, 2);
    const originalAfter = await actors.admin.db.from('document_versions').select('object_key,sha256,byte_size').eq('id', first.id).single();
    assert.deepEqual(originalAfter.data, original.data);
    const reviewAfter = await actors.admin.db.from('document_reviews').select('*').eq('id', review1.id).single();
    assert.equal(reviewAfter.data.decision, 'REJECTED');
    assert.equal(reviewAfter.data.reviewer_comment, review1.reviewer_comment);
    const secondRow = await actors.admin.db.from('document_versions').select('object_key,sha256,scan_state').eq('id', after.version.id).single();
    assert.notEqual(secondRow.data.object_key, original.data.object_key);
    assert.equal(secondRow.data.sha256, hash(png));
    assert.equal(secondRow.data.scan_state, 'NOT_SCANNED');
    assert.deepEqual(Buffer.from(await (await request(`/api/documents/${id}/versions/${first.id}/file`, 'office')).arrayBuffer()), pdf);
    const bytes2 = await request(`/api/documents/${id}/versions/${after.version.id}/file`, 'office');
    assert.equal(bytes2.status, 200);
    assert.deepEqual(Buffer.from(await bytes2.arrayBuffer()), png);
    assert.equal((await actors.b.db.storage.from(bucket).download(secondRow.data.object_key)).data, null);
    const officeRole = '20000000-0000-4000-8000-000000000002';
    const expired = await actors.admin.db.from('role_assignments').update({ effective_until: new Date(Date.now() - 1000).toISOString() }).eq('id', officeRole);
    assert.ifError(expired.error);
    try {
      const denied = await request(`/api/documents/${id}/reviews`, 'office', json({ versionId: after.version.id, decision: 'ACCEPTED_AS_EVIDENCE' }));
      assert.ok([401,403,404].includes(denied.status));
      assert.deepEqual((await actors.office.db.from('document_reviews').select('id').eq('request_id', id)).data, []);
      assert.ok((await actors.office.db.rpc('review_document_version', { requested_id: id, reviewed_version: after.version.id,
        supplied_decision: 'ACCEPTED_AS_EVIDENCE', supplied_reason: null, supplied_comment: null })).error);
    } finally {
      const restored = await actors.admin.db.from('role_assignments').update({ effective_until: null }).eq('id', officeRole);
      assert.ifError(restored.error);
    }
    const decideArgs = { requested_id: id, reviewed_version: after.version.id,
      supplied_decision: 'ACCEPTED_AS_EVIDENCE', supplied_reason: null, supplied_comment: null };
    const decisions = await Promise.all([actors.office.db.rpc('review_document_version', decideArgs), actors.office.db.rpc('review_document_version', decideArgs)]);
    assert.equal(decisions.filter((r) => !r.error).length, 1);
    assert.equal(decisions.filter((r) => r.error).length, 1);
    const accepted = (await (await request(`/api/documents/${id}`, 'a')).json()).request;
    assert.equal(accepted.workflowStatus, 'ACCEPTED_AS_EVIDENCE');
    assert.equal(accepted.version.review.decision, 'ACCEPTED_AS_EVIDENCE');
    assert.equal(accepted.versions[1].review.decision, 'REJECTED');
    assert.equal((await upload(id, 'a', pdf, 'synthetic-third.pdf', 'application/pdf')).status, 409);
    assert.ok((await actors.a.db.rpc('begin_document_upload', { requested_id: id, supplied_name: 'synthetic-third.pdf',
      supplied_mime: 'application/pdf', supplied_size: pdf.length, supplied_sha256: hash(pdf),
      server_proof: proof('begin', id, 'synthetic-third.pdf', 'application/pdf', String(pdf.length), hash(pdf)) })).error);
    const reviews = await actors.admin.db.from('document_reviews').select('id,version_id,decision').eq('request_id', id);
    assert.equal(reviews.data.length, 2);
    const audit = await actors.admin.db.from('audit_events').select('id,entity_id,after_value').eq('entity_type', 'document_review').in('entity_id', reviews.data.map((r) => r.id));
    assert.equal(audit.data.length, 2);
    assert.ok(audit.data.every((r) => !JSON.stringify(r).includes('all pages')));
    // A temporary synthetic dual role proves self-review is denied even with Super Admin authority.
    const ownRequest = await newRequest(`Synthetic 02B self review ${Date.now()}`);
    assert.equal((await upload(ownRequest, 'a', pdf, 'synthetic-self.pdf', 'application/pdf')).status, 201);
    const ownVersion = (await (await request(`/api/documents/${ownRequest}`, 'a')).json()).request.version.id;
    const grant = await actors.admin.db.from('role_assignments').insert({ person_id: staffA, role_code: 'SUPER_ADMIN',
      granted_by: '10000000-0000-4000-8000-000000000001' }).select('id').single();
    assert.ifError(grant.error);
    try {
      const ownRoute = await request(`/api/documents/${ownRequest}/reviews`, 'a', json({ versionId: ownVersion, decision: 'ACCEPTED_AS_EVIDENCE' }));
      assert.ok([403,404,409].includes(ownRoute.status));
      assert.ok((await actors.a.db.rpc('review_document_version', { requested_id: ownRequest, reviewed_version: ownVersion,
        supplied_decision: 'ACCEPTED_AS_EVIDENCE', supplied_reason: null, supplied_comment: null })).error);
    } finally {
      const revoke = await actors.admin.db.from('role_assignments').update({ revoked_at: new Date().toISOString() }).eq('id', grant.data.id);
      assert.ifError(revoke.error);
    }
  } finally { server.kill(); }
});
