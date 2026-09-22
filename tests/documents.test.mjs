import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash, createHmac } from 'node:crypto';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const bucket = 'enterprise-personnel-evidence';
const staffA = '10000000-0000-4000-8000-000000000003';
const staffB = '10000000-0000-4000-8000-000000000004';
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
function client() { return createClient(projectUrl, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function signed(as) {
  const db = client();
  const { error } = await db.auth.signInWithPassword({ email: people[as][0], password: people[as][1] });
  assert.ifError(error); return db;
}
async function cookieFor(as) {
  let cookies = [];
  const db = createServerClient(projectUrl, key, { cookies: {
    getAll: () => cookies,
    setAll: (items) => { cookies = items.map(({ name, value }) => ({ name, value })); },
  } });
  const { error } = await db.auth.signInWithPassword({ email: people[as][0], password: people[as][1] });
  assert.ifError(error);
  return cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
}
async function port() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const value = server.address().port; server.close(); await once(server, 'close'); return value;
}
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const proof = (...parts) => createHmac('sha256', Buffer.from(process.env.KSS_DOCUMENT_SIGNING_SECRET, 'hex')).update(parts.join('\x1f')).digest('hex');

test('02A private document request, bytes, upload and denial', { timeout: 180000 }, async () => {
  assert.ok(projectUrl && key && Object.values(people).every(([email, password]) => email && password));
  const localPort = await port();
  const base = `http://127.0.0.1:${localPort}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(localPort)], { cwd: process.cwd(), stdio: 'ignore' });
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(base); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    const cookies = Object.fromEntries(await Promise.all(Object.keys(people).map(async (name) => [name, await cookieFor(name)])));
    const db = Object.fromEntries(await Promise.all(['admin','office','officeB','a','b','operations','unmapped'].map(async (name) => [name, await signed(name)])));
    const req = (path, as, options = {}) => fetch(base + path, { redirect: 'manual', ...options,
      headers: { ...(as ? { cookie: cookies[as] } : {}), ...(options.headers ?? {}) } });
    assert.equal((await req('/api/documents')).status, 401);
    assert.equal((await req('/api/documents', 'unmapped')).status, 401);
    assert.equal((await req('/api/documents', 'operations')).status, 403);
    assert.equal((await req('/documents', 'operations')).status, 404);
    assert.ok([400,404].includes((await req('/api/documents/not-a-uuid', 'a')).status));
    const targetA = await req(`/api/documents/targets?siteId=${siteA}`, 'office');
    assert.equal(targetA.status, 200);
    assert.deepEqual((await targetA.json()).targets.map((row) => row.person_id), [staffA]);
    const targetB = await req(`/api/documents/targets?siteId=${siteA}`, 'officeB');
    assert.equal(targetB.status, 200);
    assert.deepEqual((await targetB.json()).targets, []);
    const forged = await req('/api/documents', 'officeB', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetPersonId: staffA, siteId: siteA, title: 'Forbidden synthetic request' }) });
    assert.equal(forged.status, 403);
    const wrongTarget = await req('/api/documents', 'office', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetPersonId: staffB, siteId: siteA, title: 'Forbidden synthetic request' }) });
    assert.equal(wrongTarget.status, 403);
    const created = await req('/api/documents', 'office', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetPersonId: staffA, siteId: siteA, title: `Synthetic 02A evidence ${Date.now()}` }) });
    assert.equal(created.status, 201);
    const { id } = await created.json();
    const before = await req(`/api/documents/${id}`, 'a');
    assert.equal(before.status, 200);
    assert.equal((await before.json()).request.status, 'REQUESTED');
    for (const as of [undefined, 'b', 'officeB', 'operations', 'unmapped']) {
      const response = await req(`/api/documents/${id}`, as);
      assert.ok([401,403,404].includes(response.status), `${as}: ${response.status}`);
      assert.doesNotMatch(await response.text(), /Synthetic 02A evidence|\.pdf|sha256/i);
    }
    assert.deepEqual((await (await req('/api/documents', 'b')).json()).requests, []);
    assert.deepEqual((await db.b.from('document_requests').select('id').eq('id', id)).data, []);
    assert.deepEqual((await db.b.from('document_versions').select('id,object_key,original_filename,sha256')).data, []);
    const invalid = new FormData(); invalid.set('file', new File([pdf], '../bad.pdf', { type: 'application/pdf' }));
    assert.equal((await req(`/api/documents/${id}/upload`, 'a', { method: 'POST', body: invalid })).status, 400);
    const mismatch = new FormData(); mismatch.set('file', new File([png], 'fake.pdf', { type: 'application/pdf' }));
    assert.equal((await req(`/api/documents/${id}/upload`, 'a', { method: 'POST', body: mismatch })).status, 400);
    const oversized = new FormData(); oversized.set('file', new File([Buffer.alloc(5 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' }));
    assert.ok([400,413].includes((await req(`/api/documents/${id}/upload`, 'a', { method: 'POST', body: oversized })).status));
    const chunkedBody = new ReadableStream({
      start(controller) {
        controller.enqueue(Buffer.alloc(3 * 1024 * 1024));
        controller.enqueue(Buffer.alloc(3 * 1024 * 1024));
        controller.close();
      },
    });
    const chunked = await req(`/api/documents/${id}/upload`, 'a', {
      method: 'POST', duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=synthetic' }, body: chunkedBody,
    });
    assert.equal(chunked.status, 413, 'streamed upload without Content-Length must hit the byte cap');
    const deniedUpload = new FormData(); deniedUpload.set('file', new File([pdf], 'synthetic.pdf', { type: 'application/pdf' }));
    assert.equal((await req(`/api/documents/${id}/upload`, 'b', { method: 'POST', body: deniedUpload })).status, 404);
    const forgedKey = `${staffB}/${id}/${crypto.randomUUID()}`;
    assert.ok((await db.b.storage.from(bucket).upload(forgedKey, pdf, { contentType: 'application/pdf' })).error);
    const allowed = new FormData(); allowed.set('file', new File([pdf], 'synthetic.pdf', { type: 'application/pdf' }));
    const uploaded = await req(`/api/documents/${id}/upload`, 'a', { method: 'POST', body: allowed });
    assert.equal(uploaded.status, 201, await uploaded.text());
    const detail = (await (await req(`/api/documents/${id}`, 'office')).json()).request;
    assert.equal(detail.status, 'SUBMITTED');
    assert.equal(detail.version.scanState, 'NOT_SCANNED');
    assert.equal(detail.version.sha256, digest(pdf));
    const downloaded = await req(`/api/documents/${id}/file`, 'office');
    assert.equal(downloaded.status, 200);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), pdf);
    assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff');
    assert.match(downloaded.headers.get('content-disposition'), /^attachment/);
    assert.equal((await req(`/api/documents/${id}/file`, 'a')).status, 200);
    for (const as of [undefined,'b','officeB','operations','unmapped']) {
      const response = await req(`/api/documents/${id}/file`, as);
      assert.ok([401,403,404].includes(response.status));
      assert.notDeepEqual(Buffer.from(await response.arrayBuffer()), pdf);
    }
    const { data: version, error: versionError } = await db.admin.from('document_versions').select('id,object_key').eq('id', detail.version.id).single();
    assert.ifError(versionError);
    assert.deepEqual((await db.b.storage.from(bucket).download(version.object_key)).data, null);
    assert.deepEqual((await db.operations.storage.from(bucket).download(version.object_key)).data, null);
    const direct = await db.office.storage.from(bucket).download(version.object_key);
    assert.ifError(direct.error);
    assert.deepEqual(Buffer.from(await direct.data.arrayBuffer()), pdf);
    const repeated = new FormData(); repeated.set('file', new File([pdf], 'synthetic.pdf', { type: 'application/pdf' }));
    assert.equal((await req(`/api/documents/${id}/upload`, 'a', { method: 'POST', body: repeated })).status, 409);
    assert.equal((await db.admin.from('document_versions').select('id', { count: 'exact' }).eq('id', version.id)).count, 1);
    const audit = await db.admin.from('audit_events').select('entity_type,action,after_value').in('entity_type', ['document_request','document_version']).in('entity_id', [id,version.id]);
    assert.ifError(audit.error);
    assert.equal(audit.data.length, 2);
    assert.ok(audit.data.every((row) => !JSON.stringify(row).includes('synthetic.pdf')));
    // Simulate Storage success followed by an interrupted DB finalisation.
    const pendingRequest = await req('/api/documents', 'office', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetPersonId: staffA, siteId: siteA, title: `Synthetic pending recovery ${Date.now()}` }) });
    assert.equal(pendingRequest.status, 201);
    const pendingId = (await pendingRequest.json()).id;
    const directBypass = await db.a.rpc('begin_document_upload', {
      requested_id: pendingId, supplied_name: 'synthetic.png', supplied_mime: 'image/png',
      supplied_size: png.length, supplied_sha256: digest(png), server_proof: '0'.repeat(64),
    });
    assert.ok(directBypass.error, 'ordinary Staff cannot start an unchecked direct RPC upload');
    const attemptArgs = {
      requested_id: pendingId, supplied_name: 'synthetic.png', supplied_mime: 'image/png',
      supplied_size: png.length, supplied_sha256: digest(png),
      server_proof: proof('begin', pendingId, 'synthetic.png', 'image/png', String(png.length), digest(png)),
    };
    const [attempt, concurrentAttempt] = await Promise.all([
      db.a.rpc('begin_document_upload', attemptArgs), db.a.rpc('begin_document_upload', attemptArgs),
    ]);
    assert.ifError(attempt.error);
    assert.ifError(concurrentAttempt.error);
    assert.equal(attempt.data.length, 1);
    assert.equal(attempt.data[0].version_id, concurrentAttempt.data[0].version_id);
    const storedPending = await db.a.storage.from(bucket).upload(attempt.data[0].object_key, png, { contentType: 'image/png', upsert: false });
    assert.ifError(storedPending.error);
    const directFinalise = await db.a.rpc('finalize_document_upload', {
      requested_id: pendingId, version_id: attempt.data[0].version_id, server_proof: '0'.repeat(64),
    });
    assert.ok(directFinalise.error, 'ordinary Staff cannot finalise without server byte verification');
    const pendingDetail = (await (await req(`/api/documents/${pendingId}`, 'office')).json()).request;
    assert.equal(pendingDetail.status, 'REQUESTED');
    assert.equal(pendingDetail.version, null);
    const resume = new FormData(); resume.set('file', new File([png], 'synthetic.png', { type: 'image/png' }));
    const recovered = await req(`/api/documents/${pendingId}/upload`, 'a', { method: 'POST', body: resume });
    assert.equal(recovered.status, 201, await recovered.text());
    const recoveredDetail = (await (await req(`/api/documents/${pendingId}`, 'office')).json()).request;
    assert.equal(recoveredDetail.status, 'SUBMITTED');
    assert.equal(recoveredDetail.version.sha256, digest(png));
    assert.equal((await db.admin.from('document_versions').select('id', { count: 'exact' }).eq('document_id',
      (await db.admin.from('documents').select('id').eq('request_id', pendingId).single()).data.id)).count, 1);
    const expired = await db.admin.from('role_assignments').update({ effective_until: new Date(Date.now() - 1000).toISOString() }).eq('id', '20000000-0000-4000-8000-000000000003');
    assert.ifError(expired.error);
    try {
      assert.equal((await req(`/api/documents/${id}`, 'a')).status, 401);
      assert.deepEqual((await db.a.storage.from(bucket).download(version.object_key)).data, null);
    } finally {
      const restore = await db.admin.from('role_assignments').update({ effective_until: null }).eq('id', '20000000-0000-4000-8000-000000000003');
      assert.ifError(restore.error);
    }
  } finally { server.kill(); }
});
