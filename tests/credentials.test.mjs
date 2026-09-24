import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const staffId = '10000000-0000-4000-8000-000000000003';
const officeId = '10000000-0000-4000-8000-000000000002';
const people = {
  admin: [process.env.KSS_TEST_ADMIN_EMAIL, process.env.KSS_TEST_ADMIN_PASSWORD],
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  officeB: [process.env.KSS_TEST_OFFICE_B_EMAIL, process.env.KSS_TEST_OFFICE_B_PASSWORD],
  staff: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
  staffB: [process.env.KSS_TEST_STAFF_B_EMAIL, process.env.KSS_TEST_STAFF_B_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
};
async function actor(name) {
  let cookies = [];
  const session = createServerClient(url, key, { cookies: {
    getAll: () => cookies,
    setAll: (items) => { cookies = items.map(({ name, value }) => ({ name, value })); },
  } });
  const signed = await signInWithTestSession(session, { email: people[name][0], password: people[name][1] });
  assert.ifError(signed.error);
  return {
    cookie: cookies.map(({ name, value }) => `${name}=${value}`).join('; '),
    db: createClient(url, key, { global: { headers: { Authorization: `Bearer ${signed.data.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false } }),
  };
}
async function port() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const value = server.address().port; server.close(); await once(server, 'close'); return value;
}
const post = (value) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');

test('16B synthetic exact evidence, reviewer authority and immutable current state', { timeout: 300000 }, async () => {
  assert.ok(url && key && Object.values(people).every(([email, password]) => email && password));
  const actors = Object.fromEntries(await Promise.all(Object.keys(people).map(async (name) => [name, await actor(name)])));
  const localPort = await port();
  const base = `http://127.0.0.1:${localPort}`;
  const serverArgs = process.env.KSS_TEST_DEV === '1'
    ? ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(localPort)]
    : ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(localPort)];
  const server = spawn(process.execPath, serverArgs, { cwd: process.cwd(), stdio: 'ignore' });
  let grantId;
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error('Synthetic app server exited before readiness');
      try { await fetch(base); ready = true; break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); }
    }
    assert.ok(ready, 'synthetic app server did not become ready');
    const req = (path, name, options = {}) => fetch(base + path, { redirect: 'manual', ...options,
      headers: { ...(name ? { cookie: actors[name].cookie } : {}), ...(options.headers ?? {}) } });
    const json = async (path, name, options = {}) => { const response = await req(path, name, options);
      const body = await response.json().catch(() => ({})); return { status: response.status, body }; };
    assert.equal((await req('/api/credentials')).status, 401);
    assert.equal((await req('/api/credentials', 'operations')).status, 403);
    assert.equal((await req(`/api/credentials?personId=${staffId}`, 'staffB')).status, 403);
    assert.equal((await req(`/api/credentials?personId=${staffId}`, 'officeB')).status, 200);
    assert.deepEqual((await json(`/api/credentials?personId=${staffId}`, 'officeB')).body.claims, []);
    const grant = await json('/api/credentials', 'admin', post({ action: 'grant', personId: staffId,
      reviewerId: officeId, category: 'DOOR_SUPERVISION', untilAt: new Date(Date.now() + 7 * 86400000).toISOString() }));
    assert.equal(grant.status, 201, JSON.stringify(grant.body)); grantId = grant.body.id;
    const reference = `SYN-SIA-16B-${Date.now()}`;
    const created = await json('/api/credentials', 'staff', post({ action: 'save', category: 'DOOR_SUPERVISION',
      reference, issuedOn: null, expiresOn: '2029-02-26' }));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const claimId = created.body.id;
    const before = await json(`/api/credentials?personId=${staffId}`, 'office');
    assert.equal(before.body.claims.find((row) => row.id === claimId).latest_revision_id, null);
    const adminDirect = await actors.admin.db.from('credential_claims_16b').select('id').eq('id', claimId);
    assert.ifError(adminDirect.error); assert.deepEqual(adminDirect.data, []);
    const adminOversight = await json(`/api/credentials?personId=${staffId}`, 'admin');
    assert.equal(adminOversight.status, 200); assert.ok(adminOversight.body.claims.some((row) => row.id === claimId));
    for (const name of ['officeB', 'operations', 'staffB']) {
      const direct = await actors[name].db.from('credential_claims_16b').select('id').eq('id', claimId);
      assert.ifError(direct.error); assert.deepEqual(direct.data, []);
      assert.equal((await actors[name].db.from('credential_revisions_16b').select('id').eq('claim_id', claimId)).data.length, 0);
    }
    assert.ok((await actors.staff.db.from('credential_claims_16b').insert({ person_id: staffId, type_code: 'SECURITY_GUARDING' })).error);
    assert.ok((await actors.office.db.rpc('decide_credential_16b', { requested_revision: crypto.randomUUID(),
      supplied_decision: 'VERIFIED', supplied_method: 'EXTERNALLY_CONFIRMED', supplied_reason: null })).error);
    const evidence = await json('/api/credentials', 'office', post({ action: 'requestEvidence', personId: staffId, category: 'DOOR_SUPERVISION' }));
    let evidenceId = evidence.body.id;
    if (evidence.status === 409) {
      const requests = await json(`/api/credentials?personId=${staffId}`, 'staff');
      evidenceId = requests.body.documents.find((row) => row.title === 'Synthetic credential evidence: DOOR_SUPERVISION' && row.status === 'REQUESTED')?.id;
    }
    assert.ok(evidenceId, JSON.stringify(evidence.body));
    const noFile = await json(`/api/documents/${evidenceId}/upload`, 'staff', { method: 'POST' });
    assert.equal(noFile.status, 400, JSON.stringify(noFile));
    const file = new FormData(); file.set('file', new File([pdf], 'synthetic-16b.pdf', { type: 'application/pdf' }));
    assert.equal((await req('/api/credentials', 'staff')).status, 200, 'staff session before upload');
    const documentBefore = await json(`/api/documents/${evidenceId}`, 'staff');
    assert.equal(documentBefore.status, 200, JSON.stringify({ evidenceId, documentBefore }));
    const uploaded = await json(`/api/documents/${evidenceId}/upload`, 'staff', { method: 'POST', body: file });
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    const versionId = uploaded.body.versionId;
    assert.equal((await json('/api/credentials', 'staff', post({ action: 'submit', claimId, versionId }))).status, 409,
      'submitted evidence without a separate acceptance cannot create a revision');
    assert.equal((await req(`/api/documents/${evidenceId}/file`, 'operations')).status, 403);
    const accepted = await json(`/api/documents/${evidenceId}/reviews`, 'office', post({
      versionId, decision: 'ACCEPTED_AS_EVIDENCE', reasonCode: null, comment: null }));
    assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
    const submitted = await json('/api/credentials', 'staff', post({ action: 'submit', claimId, versionId }));
    if (submitted.status !== 201) { const diagnostic = await actors.staff.db.rpc('submit_credential_16b', { requested_claim: claimId, requested_version: versionId });
      assert.equal(submitted.status, 201, JSON.stringify({ submitted: submitted.body, dbError: diagnostic.error?.message })); }
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    const revisionId = submitted.body.id;
    assert.equal((await actors.office.db.from('credential_revisions_16b').select('id').eq('id', revisionId)).data.length, 1);
    assert.deepEqual((await actors.officeB.db.from('credential_revisions_16b').select('id').eq('id', revisionId)).data, []);
    assert.ok((await actors.officeB.db.rpc('decide_credential_16b', { requested_revision: revisionId,
      supplied_decision: 'VERIFIED', supplied_method: 'OFFICE_CHECKED_EVIDENCE', supplied_reason: null })).error);
    const verified = await json('/api/credentials', 'office', post({ action: 'decide', revisionId,
      decision: 'VERIFIED', method: 'OFFICE_CHECKED_EVIDENCE' }));
    assert.equal(verified.status, 201, JSON.stringify(verified.body));
    const snapshot = await json(`/api/credentials?personId=${staffId}`, 'staff');
    assert.equal(snapshot.body.decisions.find((row) => row.revision_id === revisionId).decision, 'VERIFIED');
    assert.ok((await actors.staff.db.from('credential_decisions_16b').update({ decision: 'REJECTED' }).eq('id', verified.body.id)).error);
    assert.equal((await json('/api/credentials', 'staff', post({ action: 'save', category: 'DOOR_SUPERVISION',
      reference: `${reference}-CHANGE`, issuedOn: null, expiresOn: '2029-02-26' }))).status, 201);
    assert.equal((await json('/api/credentials', 'staff', post({ action: 'save', category: 'DOOR_SUPERVISION',
      reference, issuedOn: null, expiresOn: '2029-02-26' }))).status, 201);
    const changed = await json(`/api/credentials?personId=${staffId}`, 'staff');
    const oldRevision = changed.body.revisions.find((row) => row.id === revisionId);
    const currentClaim = changed.body.claims.find((row) => row.id === claimId);
    assert.ok(currentClaim.draft_change_seq > oldRevision.draft_change_seq, 'value reversal cannot reactivate verification');
    assert.equal((await json('/api/credentials', 'office', post({ action: 'decide', revisionId,
      decision: 'REJECTED', method: 'OFFICE_CHECKED_EVIDENCE', reasonCode: 'CORRECTION' }))).status, 409);
    const revoked = await json('/api/credentials', 'office', post({ action: 'decide', revisionId,
      decision: 'REVOKED', method: 'OFFICE_CHECKED_EVIDENCE', reasonCode: 'CORRECTION' }));
    assert.equal(revoked.status, 201, JSON.stringify(revoked.body));
    const after = await json(`/api/credentials?personId=${staffId}`, 'staff');
    assert.ok(after.body.decisions.some((row) => row.revision_id === revisionId && row.decision === 'REVOKED'));
    const withdrawn = await json('/api/credentials', 'staff', post({ action: 'withdraw', claimId }));
    assert.equal(withdrawn.status, 201, JSON.stringify(withdrawn.body));
    const rows = await actors.admin.db.from('audit_events').select('after_value').in('entity_type',
      ['credential_claim','credential_revision','credential_decision','credential_reviewer_grant'])
      .eq('affected_person_id', staffId);
    assert.ifError(rows.error);
    assert.ok(rows.data.every((row) => !/SYN-SIA-|synthetic-16b.pdf/.test(JSON.stringify(row))));
  } finally {
    if (grantId) await actors.admin.db.rpc('revoke_credential_reviewer_16b', { requested_grant: grantId });
    if (server.exitCode === null) { server.kill(); await once(server, 'exit').catch(() => {}); }
  }
});
