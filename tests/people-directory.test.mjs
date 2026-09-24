import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const users = {
  admin: [process.env.KSS_TEST_ADMIN_EMAIL, process.env.KSS_TEST_ADMIN_PASSWORD],
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  staffA: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
  staffB: [process.env.KSS_TEST_STAFF_B_EMAIL, process.env.KSS_TEST_STAFF_B_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
};
const ids = {
  office: '10000000-0000-4000-8000-000000000002',
  staffA: '10000000-0000-4000-8000-000000000003',
  staffB: '10000000-0000-4000-8000-000000000004',
  operations: '10000000-0000-4000-8000-000000000007',
};
const supabase = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(as) {
  const client = supabase();
  const { error } = await signInWithTestSession(client,{ email: users[as][0], password: users[as][1] });
  assert.ifError(error);
  return client;
}
async function cookieFor(as) {
  let cookies = [];
  const client = createServerClient(url, key, { cookies: { getAll: () => cookies, setAll: (items) => { cookies = items.map(({ name, value }) => ({ name, value })); } } });
  const { error } = await signInWithTestSession(client,{ email: users[as][0], password: users[as][1] });
  assert.ifError(error);
  return cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
}
async function port() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const value = server.address().port; server.close(); await once(server, 'close'); return value;
}
function safeOnly(row) {
  assert.deepEqual(Object.keys(row).sort(), ['completed', 'displayName', 'id', 'onboardingCaseId', 'onboardingState', 'roles', 'sites', 'totalRequirements']);
  const raw = JSON.stringify(row).toLowerCase();
  for (const forbidden of ['contact_email', 'mobile', 'address_line', 'postcode', 'synthetic_reference', 'filename', 'object_key', 'review_comment'])
    assert.ok(!raw.includes(forbidden), forbidden);
}

test('04A directory projection, direct RLS and protected routes', { timeout: 180000 }, async () => {
  assert.ok(url && key && Object.values(users).every((u) => u[0] && u[1]));
  const [admin, office, staffA, staffB, ops] = await Promise.all(Object.keys(users).map(signIn));
  const anon = await supabase().rpc('people_directory_04a');
  assert.ok(anon.error, 'anonymous RPC denied');
  const officeList = await office.rpc('people_directory_04a');
  assert.ifError(officeList.error);
  assert.ok(officeList.data.items.some((row) => row.id === ids.staffA));
  assert.ok(officeList.data.items.some((row) => row.id === ids.staffB));
  officeList.data.items.forEach(safeOnly);
  assert.deepEqual((await office.from('people').select('id')).data.map((row) => row.id), [ids.office], 'base people RLS stays narrow');
  assert.deepEqual((await office.from('person_profiles').select('person_id').eq('person_id', ids.staffB)).data, [], 'directory does not grant profile RLS');
  const opsList = await ops.rpc('people_directory_04a');
  assert.ifError(opsList.error);
  assert.ok(opsList.data.items.some((row) => row.id === ids.staffA));
  opsList.data.items.forEach((row) => { safeOnly(row); if (row.id !== ids.operations) { assert.equal(row.completed, null); assert.equal(row.totalRequirements, null); assert.equal(row.onboardingCaseId, null); } });
  assert.deepEqual((await ops.from('person_profiles').select('person_id').eq('person_id', ids.staffA)).data, []);
  const staffList = await staffA.rpc('people_directory_04a');
  assert.ifError(staffList.error);
  assert.deepEqual(staffList.data.items.map((row) => row.id), [ids.staffA]);
  const staffOther = await staffA.rpc('people_directory_04a', { requested_person: ids.staffB });
  assert.ifError(staffOther.error);
  assert.equal(staffOther.data.total, 0);
  assert.deepEqual(staffOther.data.items, []);
  assert.deepEqual((await staffB.from('people').select('id').eq('id', ids.staffA)).data, []);
  const filtered = await office.rpc('people_directory_04a', { role_filter: 'SECURITY_STAFF', search_text: 'Synthetic', page_size: 1 });
  assert.ifError(filtered.error);
  assert.ok(filtered.data.total >= filtered.data.items.length);
  assert.ok(filtered.data.items.length <= 1);
  const invalid = await office.rpc('people_directory_04a', { page_size: 500 });
  assert.ok(invalid.error);
  assert.ifError((await admin.rpc('people_directory_04a', { requested_person: ids.staffA })).error);
  const operationsRoleId = '20000000-0000-4000-8000-000000000007';
  try {
    assert.ifError((await admin.from('role_assignments').update({ effective_until: new Date(Date.now() - 1000).toISOString() }).eq('id', operationsRoleId)).error);
    const expiredDirectory = await ops.rpc('people_directory_04a');
    assert.ok(expiredDirectory.error, 'expired Operations role removes directory authority');
  } finally {
    assert.ifError((await admin.from('role_assignments').update({ effective_until: null }).eq('id', operationsRoleId)).error);
  }

  const base = `http://127.0.0.1:${await port()}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', new URL(base).port], { cwd: process.cwd(), stdio: 'ignore' });
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(base); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    const cookies = Object.fromEntries(await Promise.all(Object.keys(users).map(async (as) => [as, await cookieFor(as)])));
    const get = (path, as) => fetch(base + path, { redirect: 'manual', headers: as ? { cookie: cookies[as] } : {} });
    assert.equal((await get('/people')).status, 307);
    assert.equal((await get('/api/people')).status, 401);
    assert.equal((await get('/people', 'office')).status, 200);
    assert.equal((await get('/people', 'operations')).status, 200);
    assert.equal((await get('/people', 'staffA')).status, 404);
    assert.equal((await get(`/people/${ids.staffA}`, 'staffA')).status, 200);
    assert.equal((await get(`/people/${ids.staffB}`, 'staffA')).status, 404);
    assert.equal((await get(`/api/people/directory/${ids.staffB}`, 'staffA')).status, 404);
    const officeResponse = await get(`/api/people/directory/${ids.staffB}`, 'office');
    assert.equal(officeResponse.status, 200);
    safeOnly(await officeResponse.json());
    assert.equal((await get(`/api/people/${ids.staffB}`, 'office')).status, 404, 'old private route remains narrow');
    const opsResponse = await get(`/api/people/directory/${ids.staffA}`, 'operations');
    assert.equal(opsResponse.status, 200);
    assert.equal((await opsResponse.json()).completed, null);
    assert.equal((await get('/api/people?limit=500', 'office')).status, 400);
    const page = await (await get(`/people/${ids.staffA}`, 'office')).text();
    assert.ok(page.includes('This record does not establish compliance'));
    assert.ok(!page.includes('contact_email'));
  } finally {
    server.kill('SIGTERM');
    if (server.exitCode === null) await once(server, 'exit');
  }
});
