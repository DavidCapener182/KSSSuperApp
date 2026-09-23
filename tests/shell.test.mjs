import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { safeReturnTarget } from '../src/lib/auth/return-target.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const users = {
  admin: [process.env.KSS_TEST_ADMIN_EMAIL, process.env.KSS_TEST_ADMIN_PASSWORD],
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  officeB: [process.env.KSS_TEST_OFFICE_B_EMAIL, process.env.KSS_TEST_OFFICE_B_PASSWORD],
  staff: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
  zero: [process.env.KSS_TEST_STAFF_ZERO_EMAIL, process.env.KSS_TEST_STAFF_ZERO_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
  unmapped: [process.env.KSS_TEST_UNMAPPED_EMAIL, process.env.KSS_TEST_UNMAPPED_PASSWORD],
};
const person = { officeB: '10000000-0000-4000-8000-000000000006', operations: '10000000-0000-4000-8000-000000000007' };
function client() { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function cookieFor(as) {
  let cookies = [];
  const db = createServerClient(url, key, { cookies: { getAll: () => cookies, setAll: (items) => { cookies = items.map(({ name, value }) => ({ name, value })); } } });
  const { error } = await db.auth.signInWithPassword({ email: users[as][0], password: users[as][1] });
  assert.ifError(error);
  return cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
}
async function port() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const value = server.address().port; server.close(); await once(server, 'close'); return value;
}
const paths = ['/app', '/sites', '/profile'];

test('return targets allow only implemented local routes', () => {
  for (const path of [...paths, '/sites?view=mine', '/documents', '/documents/10000000-0000-4000-8000-000000000003', '/work', '/work/10000000-0000-4000-8000-000000000003', '/onboarding', '/onboarding/10000000-0000-4000-8000-000000000003']) assert.equal(safeReturnTarget(path), path);
  for (const path of ['//evil.example', 'https://evil.example', '/\\evil', '/sites#fragment', '/sites/../app', '/admin', '/sites%2F..', '/sites?x=1\nLocation: evil']) assert.equal(safeReturnTarget(path), null, path);
});

test('01D shell route, navigation, and role boundaries', { timeout: 180000 }, async () => {
  assert.ok(url && key && Object.values(users).every(([email, password]) => email && password));
  const base = `http://127.0.0.1:${await port()}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', new URL(base).port], { cwd: process.cwd(), stdio: 'ignore' });
  const admin = client();
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(base); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    const cookies = Object.fromEntries(await Promise.all(Object.keys(users).map(async (name) => [name, await cookieFor(name)])));
    const get = (path, as, extra = {}) => fetch(base + path, { redirect: 'manual', headers: { ...(as ? { cookie: cookies[as] } : {}), ...extra } });
    const me = async (as) => { const response = await get('/api/me', as); return [response.status, await response.json()]; };
    for (const path of paths) {
      const anon = await get(path);
      assert.equal(anon.status, 307, `anonymous ${path}`);
      assert.equal(anon.headers.get('location'), `/?next=${encodeURIComponent(path)}`);
      assert.equal(anon.headers.get('cache-control'), 'private, no-store, max-age=0');
      const unmapped = await get(path, 'unmapped');
      assert.equal(unmapped.status, 307, `unmapped ${path}`);
      assert.equal(unmapped.headers.get('location'), `/?next=${encodeURIComponent(path)}`);
    }
    assert.equal((await me(undefined))[0], 401);
    assert.deepEqual(await me('unmapped'), [403, { error: 'No Enterprise access' }]);
    const expected = {
      admin: ['/app', '/work', '/sites', '/documents', '/onboarding', '/profile'], office: ['/app', '/work', '/sites', '/documents', '/onboarding', '/profile'],
      staff: ['/app', '/sites', '/documents', '/onboarding', '/profile'], zero: ['/app', '/sites', '/documents', '/onboarding', '/profile'],
      operations: ['/app', '/profile'],
    };
    for (const [as, links] of Object.entries(expected)) {
      const [status, body] = await me(as);
      assert.equal(status, 200, as);
      assert.deepEqual(body.navigation.map((item) => item.href), links, as);
      assert.equal((await get('/app', as)).status, 200);
      assert.equal((await get('/profile', as)).status, 200);
    }
    assert.equal((await get('/sites', 'operations')).status, 404);
    assert.equal((await get('/work', 'operations')).status, 404);
    assert.equal((await get('/onboarding', 'operations')).status, 404);
    assert.equal((await get('/api/sites', 'operations')).status, 403);
    assert.equal((await get('/sites', 'zero')).status, 200);
    const zeroList = await get('/api/sites', 'zero');
    assert.equal(zeroList.status, 200);
    assert.deepEqual((await zeroList.json()).sites, []);
    assert.equal((await get('/api/access/roles', 'staff')).status, 405);
    assert.equal((await get('/api/people/10000000-0000-4000-8000-000000000001', 'staff')).status, 404);
    const denied = await fetch(base + '/api/access/roles', { method: 'POST', headers: { cookie: cookies.office, 'content-type': 'application/json' }, body: JSON.stringify({ personId: person.officeB, roleCode: 'SUPER_ADMIN' }) });
    assert.equal(denied.status, 403);
    assert.equal((await get('/sites?view=mine', undefined, { 'x-kss-return-target': '//evil.example' })).headers.get('location'), '/?next=%2Fsites%3Fview%3Dmine');

    const login = await admin.auth.signInWithPassword({ email: users.admin[0], password: users.admin[1] });
    assert.ifError(login.error);
    const grant = await admin.from('role_assignments').insert({ person_id: person.officeB, role_code: 'OPERATIONS', effective_from: new Date(Date.now() - 60000).toISOString() }).select('id').single();
    assert.ifError(grant.error);
    try {
      const [status, body] = await me('officeB');
      assert.equal(status, 200);
      assert.deepEqual(body.roles.slice().sort(), ['OFFICE_ADMIN', 'OPERATIONS']);
      assert.deepEqual(body.navigation.map((item) => item.href), expected.office);
      const siteList = await get('/api/sites', 'officeB');
      assert.equal(siteList.status, 200);
      const sites = (await siteList.json()).sites;
      assert.ok(sites.every((row) => row.canManage));
      assert.ok(sites.every((row) => row.id !== '30000000-0000-4000-8000-000000000001'));
    } finally {
      const revoke = await admin.from('role_assignments').update({ effective_until: new Date(Date.now() - 1000).toISOString() }).eq('id', grant.data.id);
      assert.ifError(revoke.error);
    }
    const expired = await admin.from('role_assignments').update({ effective_until: new Date(Date.now() - 1000).toISOString() }).eq('id', '20000000-0000-4000-8000-000000000007');
    assert.ifError(expired.error);
    try {
      assert.deepEqual(await me('operations'), [403, { error: 'No Enterprise access' }]);
      assert.equal((await get('/app', 'operations')).status, 307);
      assert.equal((await get('/profile', 'operations')).status, 307);
      assert.equal((await get('/api/sites', 'operations')).status, 401);
    } finally {
      const restore = await admin.from('role_assignments').update({ effective_until: null }).eq('id', '20000000-0000-4000-8000-000000000007');
      assert.ifError(restore.error);
    }
  } finally { server.kill(); }
});
