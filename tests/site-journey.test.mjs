import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const staffA = '10000000-0000-4000-8000-000000000003';
const staffB = '10000000-0000-4000-8000-000000000004';
const roleA = '20000000-0000-4000-8000-000000000003';
const cred = {
  admin: [process.env.KSS_TEST_ADMIN_EMAIL, process.env.KSS_TEST_ADMIN_PASSWORD],
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  officeB: [process.env.KSS_TEST_OFFICE_B_EMAIL, process.env.KSS_TEST_OFFICE_B_PASSWORD],
  a: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
  b: [process.env.KSS_TEST_STAFF_B_EMAIL, process.env.KSS_TEST_STAFF_B_PASSWORD],
};
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(who) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email: cred[who][0], password: cred[who][1] });
  assert.ifError(error); return c;
}
async function cookieFor(who) {
  let cookies = [];
  const c = createServerClient(url, key, { cookies: { getAll: () => cookies, setAll: items => { cookies = items.map(({ name, value }) => ({ name, value })); } } });
  const { error } = await c.auth.signInWithPassword({ email: cred[who][0], password: cred[who][1] });
  assert.ifError(error); return cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
}
async function port() {
  const s = createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening');
  const p = s.address().port; s.close(); await once(s, 'close'); return p;
}

test('TASK-01C server, RLS, lifecycle, GraphQL and audit', { timeout: 180000 }, async () => {
  assert.ok(url && key && Object.values(cred).every((v) => v[0] && v[1]));
  const [admin, office, officeB, a, b] = await Promise.all(Object.keys(cred).map(signIn));
  const cookies = Object.fromEntries(await Promise.all(Object.keys(cred).map(async who => [who, await cookieFor(who)])));
  const serverPort = await port();
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(serverPort)], { cwd: process.cwd(), stdio: 'ignore' });
  const base = `http://127.0.0.1:${serverPort}`;
  const request = (path, who, method = 'GET', body) => fetch(base + path, { method, headers: { ...(who ? { cookie: cookies[who] } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const list = async (who, term = '') => { const response = await request(`/api/sites?search=${encodeURIComponent(term)}`, who); return [response.status, await response.json()]; };
  const ref = `DEV-01C-${Date.now()}`;
  let siteId; let assignmentId;
  try {
    for (let i = 0; i < 80; i++) { try { await fetch(base); break; } catch { await new Promise(resolve => setTimeout(resolve, 200)); } }
    assert.equal((await request('/api/sites')).status, 401);
    assert.equal((await request('/api/sites?search=DEV')).status, 401);
    assert.equal((await request('/api/sites', undefined, 'POST', {})).status, 401);
    assert.ok((await client().from('sites').select('id')).error);

    const created = await request('/api/sites', 'office', 'POST', { site_reference: ref, name: 'Synthetic Journey Site', address_line1: '10 Example Way', town_city: 'Exampletown', postcode: 'EX1 2AB', reporting_point: 'Reception' });
    assert.equal(created.status, 201); siteId = (await created.json()).site.id;
    assert.equal((await request(`/api/sites/${siteId}`, 'a')).status, 404);
    assert.equal((await request(`/api/sites/${siteId}`, 'officeB')).status, 404);
    assert.equal((await request(`/api/sites/${siteId}`, 'b')).status, 404);
    assert.equal((await list('officeB', ref))[1].count, 0);
    assert.equal((await officeB.from('sites').select('id').eq('id', siteId)).data.length, 0);
    assert.equal((await request(`/api/sites/${siteId}`, 'officeB', 'PATCH', { name: 'Stolen' })).status, 404);
    assert.equal((await request(`/api/sites/${siteId}`, 'office', 'PATCH', { status: 'ACTIVE' })).status, 200);
    assert.equal((await request(`/api/sites/${siteId}`, 'office', 'PATCH', { name: 'Synthetic Updated Site' })).status, 200);
    assert.equal((await request(`/api/sites/${siteId}`, 'office', 'PATCH', { site_reference: 'STOLEN' })).status, 400);
    assert.equal((await request(`/api/sites/${siteId}`, 'a')).status, 404);

    const start = new Date(Date.now() - 60_000).toISOString();
    const end = new Date(Date.now() + 86_400_000).toISOString();
    const grant = { personId: staffA, siteId, effectiveFrom: start, effectiveUntil: end, reason: 'Synthetic 01C access test' };
    assert.equal((await request('/api/access/sites', 'officeB', 'POST', grant)).status, 404);
    assert.equal((await request('/api/access/sites', 'b', 'POST', { ...grant, personId: staffB })).status, 403);
    assert.equal((await request('/api/access/sites', 'office', 'POST', { ...grant, personId: staffB, effectiveUntil: null })).status, 400);
    const shortenedRole = await admin.from('role_assignments').update({ effective_until: new Date(Date.now() + 3_600_000).toISOString() }).eq('id', roleA);
    assert.ifError(shortenedRole.error);
    try { assert.equal((await request('/api/access/sites', 'office', 'POST', grant)).status, 403, 'staff role must cover the entire proposed period'); }
    finally { const restore = await admin.from('role_assignments').update({ effective_until: null }).eq('id', roleA); assert.ifError(restore.error); }
    assert.equal((await request('/api/access/sites', 'office', 'POST', { ...grant, personId: '10000000-0000-4000-8000-000000000002' })).status, 403);
    assert.ok((await office.from('site_assignments').insert({ person_id: staffA, site_id: siteId, effective_from: start, effective_until: 'infinity', granted_by: '10000000-0000-4000-8000-000000000006', change_reason: 'Invalid unbounded' })).error);
    assert.ok((await office.from('sites').update({ created_by_person_id: staffA }).eq('id', siteId)).error);
    const inserted = await request('/api/access/sites', 'office', 'POST', grant);
    assert.equal(inserted.status, 201); assignmentId = (await inserted.json()).id;
    assert.equal((await request(`/api/sites/${siteId}`, 'a')).status, 200);
    assert.equal((await list('a', ref))[1].count, 1);
    assert.equal((await list('b', ref))[1].count, 0);
    assert.equal((await list('officeB', ref))[1].count, 0);
    assert.equal((await request(`/api/sites/${siteId}`, 'b')).status, 404);
    assert.equal((await request(`/api/sites/${siteId}`, 'a', 'PATCH', { name: 'Stolen' })).status, 403);
    assert.equal((await request(`/api/sites/${siteId}/assignments`, 'a')).status, 403);
    assert.equal((await request(`/api/sites/${siteId}/assignments`, 'officeB')).status, 404);
    assert.equal((await request(`/api/access/sites/${assignmentId}`, 'officeB', 'PATCH', { revoke: true, reason: 'Denied' })).status, 404);
    assert.equal((await a.from('sites').select('id').eq('id', siteId)).data.length, 1);
    assert.equal((await b.from('sites').select('id').eq('id', siteId)).data.length, 0);
    assert.equal((await b.from('sites').select('id', { count: 'exact', head: true }).eq('site_reference', ref)).count, 0);
    assert.ok((await b.from('site_assignments').insert({ person_id: staffB, site_id: siteId, effective_from: start, effective_until: end, change_reason: 'Self grant' })).error);
    assert.ok((await office.from('role_assignments').insert({ person_id: staffA, role_code: 'SUPER_ADMIN' })).error);
    assert.ok((await officeB.from('sites').update({ name: 'Stolen' }).eq('id', siteId).select('id')).data.length === 0);

    const tokenB = (await b.auth.getSession()).data.session.access_token;
    const graph = await fetch(`${url}/graphql/v1`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${tokenB}`, 'content-type': 'application/json' }, body: JSON.stringify({ query: `query { sitesCollection(filter: {site_reference: {eq: "${ref}"}}) { edges { node { id } } } }` }) });
    const graphBody = await graph.json();
    assert.equal(graph.status, 200);
    assert.equal(graphBody.data?.sitesCollection?.edges?.length, 0, JSON.stringify(graphBody));

    const expired = await request(`/api/access/sites/${assignmentId}`, 'office', 'PATCH', { effectiveUntil: new Date().toISOString(), reason: 'Expire synthetic access' });
    assert.equal(expired.status, 200);
    assert.equal((await request(`/api/sites/${siteId}`, 'a')).status, 404);
    assert.equal((await list('a', ref))[1].count, 0);
    const fresh = await request('/api/access/sites', 'office', 'POST', { ...grant, reason: 'Renew synthetic access' });
    assert.equal(fresh.status, 201); const renewedId = (await fresh.json()).id;
    assert.equal((await request(`/api/sites/${siteId}`, 'a')).status, 200);
    const spoofGrant = await request('/api/access/sites', 'office', 'POST', { ...grant, reason: 'Revocation integrity test' });
    assert.equal(spoofGrant.status, 201); const spoofId = (await spoofGrant.json()).id;
    const rewrittenRevoke = await office.from('site_assignments').update({ revoked_at: 'infinity', effective_until: new Date(Date.now() + 172_800_000).toISOString(), change_reason: 'Attempt to rewrite period' }).eq('id', spoofId);
    assert.ok(rewrittenRevoke.error, 'revocation must not rewrite the original period');
    const spoofTime = Date.now();
    const spoofedRevoke = await office.from('site_assignments').update({ revoked_at: 'infinity', change_reason: 'Normalize revocation time' }).eq('id', spoofId).select('revoked_at').single();
    assert.ifError(spoofedRevoke.error);
    assert.ok(Math.abs(Date.parse(spoofedRevoke.data.revoked_at) - spoofTime) < 10_000, 'database must set actual revocation time');
    const roleExpired = await admin.from('role_assignments').update({ effective_until: new Date(Date.now() - 1000).toISOString() }).eq('id', roleA);
    assert.ifError(roleExpired.error);
    try { assert.equal((await request(`/api/sites/${siteId}`, 'a')).status, 401); assert.equal((await a.from('sites').select('id').eq('id', siteId)).data.length, 0); }
    finally { const restore = await admin.from('role_assignments').update({ effective_until: null }).eq('id', roleA); assert.ifError(restore.error); }
    const revoked = await request(`/api/access/sites/${renewedId}`, 'office', 'PATCH', { revoke: true, reason: 'Revoke synthetic access' });
    assert.equal(revoked.status, 200);
    assert.equal((await request(`/api/sites/${siteId}`, 'a')).status, 404);
    const finalGrant = await request('/api/access/sites', 'office', 'POST', { ...grant, reason: 'Retirement test access' });
    assert.equal(finalGrant.status, 201);
    assert.equal((await request(`/api/sites/${siteId}`, 'a')).status, 200);
    assert.equal((await request(`/api/sites/${siteId}`, 'office', 'PATCH', { status: 'RETIRED' })).status, 200);
    assert.equal((await request(`/api/sites/${siteId}`, 'a')).status, 404);
    assert.equal((await list('a', ref))[1].count, 0);
    assert.equal((await request(`/api/sites/${siteId}`, 'office')).status, 200);
    assert.equal((await request(`/api/sites/${siteId}`, 'admin')).status, 200);
    assert.equal((await request(`/api/sites/${siteId}`, 'office', 'PATCH', { status: 'ACTIVE' })).status, 400);
    const historyResponse = await request(`/api/sites/${siteId}/history`, 'office');
    assert.equal(historyResponse.status, 200);
    const history = (await historyResponse.json()).events;
    assert.ok(history.length >= 8);
    assert.ok(history.some(event => event.entity_type === 'site_assignment' && event.before_value?.effective_until && event.after_value?.effective_until && event.reason));
    const assignmentHistory = await request(`/api/sites/${siteId}/assignments`, 'office');
    assert.equal(assignmentHistory.status, 200);
    assert.ok((await assignmentHistory.json()).assignments.length >= 3);
  } finally {
    if (siteId) await request(`/api/sites/${siteId}`, 'office', 'PATCH', { status: 'RETIRED' }).catch(() => {});
    server.kill('SIGTERM'); if (server.exitCode === null) await once(server, 'exit');
  }
});
