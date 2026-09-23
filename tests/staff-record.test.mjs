import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const people = { staffA: '10000000-0000-4000-8000-000000000003', staffB: '10000000-0000-4000-8000-000000000004' };
const users = {
  officeA: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  officeB: [process.env.KSS_TEST_OFFICE_B_EMAIL, process.env.KSS_TEST_OFFICE_B_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
  staffA: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
  staffB: [process.env.KSS_TEST_STAFF_B_EMAIL, process.env.KSS_TEST_STAFF_B_PASSWORD],
};
function client() { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function signed(as) {
  const value = client();
  const { error } = await value.auth.signInWithPassword({ email: users[as][0], password: users[as][1] });
  assert.ifError(error);
  return value;
}
async function cookie(as) {
  let cookies = [];
  const value = createServerClient(url, key, { cookies: { getAll: () => cookies,
    setAll: (items) => { cookies = items.map(({ name, value }) => ({ name, value })); } } });
  const { error } = await value.auth.signInWithPassword({ email: users[as][0], password: users[as][1] });
  assert.ifError(error);
  return cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
}
async function port() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const value = server.address().port; server.close(); await once(server, 'close'); return value;
}

test('04B Staff Record composes authorised sources without directory leakage', { timeout: 180000 }, async () => {
  assert.ok(url && key && Object.values(users).every(([email, password]) => email && password));
  const [staff, officeB, operations] = await Promise.all(['staffA', 'officeB', 'operations'].map(signed));
  const profile = await staff.from('person_profiles').select('contact_email,mobile,address_line1').eq('person_id', people.staffA).single();
  assert.ifError(profile.error);
  assert.ok(profile.data.contact_email);
  assert.deepEqual((await officeB.from('person_profiles').select('person_id').eq('person_id', people.staffA)).data, []);
  assert.deepEqual((await operations.from('person_sia_credentials').select('person_id').eq('person_id', people.staffA)).data, []);
  const base = `http://127.0.0.1:${await port()}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', new URL(base).port], { cwd: process.cwd(), stdio: 'ignore' });
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(base); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    const cookies = Object.fromEntries(await Promise.all(Object.keys(users).map(async (as) => [as, await cookie(as)])));
    const get = (path, as) => fetch(base + path, { headers: { cookie: cookies[as] } });
    const officeA = await (await get(`/people/${people.staffA}`, 'officeA')).text();
    assert.ok(officeA.includes(profile.data.contact_email), 'case-authorised Office sees current Profile');
    assert.ok(officeA.includes('Training provider not connected'));
    assert.ok(officeA.includes('Activity timeline not yet available'));
    assert.ok(!officeA.includes('synthetic_reference'), 'no SIA reference field is rendered');
    for (const as of ['officeB', 'operations']) {
      const page = await (await get(`/people/${people.staffA}`, as)).text();
      assert.ok(page.includes('Directory access does not include private personnel records.'));
      assert.ok(!page.includes(profile.data.contact_email));
      assert.ok(!page.includes(profile.data.mobile));
      assert.ok(!page.includes(profile.data.address_line1));
      assert.ok(!page.includes('Open request'));
    }
    const own = await (await get(`/people/${people.staffA}`, 'staffA')).text();
    assert.ok(own.includes('Open my Profile'));
    assert.ok(own.includes(profile.data.contact_email));
    assert.equal((await get(`/people/${people.staffB}`, 'staffA')).status, 404);
    assert.equal((await get(`/people/${people.staffA}`, 'staffB')).status, 404);
    assert.equal((await get(`/api/people/${people.staffA}`, 'operations')).status, 404);
  } finally {
    server.kill('SIGTERM');
    if (server.exitCode === null) await once(server, 'exit');
  }
});
