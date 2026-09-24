import { signInWithTestSession } from './helpers/auth-session.mjs';
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
  const { error } = await signInWithTestSession(db, { email: users[as][0], password: users[as][1] });
  assert.ifError(error);
  return cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
}
async function port() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const value = server.address().port; server.close(); await once(server, 'close'); return value;
}
const paths = ['/app', '/assets', '/my-equipment', '/sites', '/profile', '/people', '/workforce', '/mobilisations', '/my-schedule', '/my-deployments', '/my-work-time', '/my-attendance', '/my-availability', '/action-centre'];

test('return targets allow only implemented local routes', () => {
  for (const path of [...paths, '/sites?view=mine', '/training', '/training-admin', '/training/10000000-0000-4000-8000-000000000003?page=2', '/documents', '/documents/10000000-0000-4000-8000-000000000003', '/work', '/work/10000000-0000-4000-8000-000000000003', '/onboarding', '/onboarding/10000000-0000-4000-8000-000000000003', '/people/10000000-0000-4000-8000-000000000003', '/mobilisations/10000000-0000-4000-8000-000000000003', '/events/10000000-0000-4000-8000-000000000003?requirement=10000000-0000-4000-8000-000000000004', '/events/10000000-0000-4000-8000-000000000003/attendance', '/events/10000000-0000-4000-8000-000000000003/work-time']) assert.equal(safeReturnTarget(path), path);
  for (const path of ['//evil.example', 'https://evil.example', '/\\evil', '/sites#fragment', '/sites/../app', '/admin', '/sites%2F..', '/sites?x=1\nLocation: evil']) assert.equal(safeReturnTarget(path), null, path);
});

test('01D shell route, navigation, and role boundaries', { timeout: 180000 }, async () => {
  assert.ok(url && key && Object.values(users).every(([email, password]) => email && password));
  const base = `http://127.0.0.1:${await port()}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', new URL(base).port], {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: {
      ...process.env,
      KSS_MAGSECURE_URL: 'https://magsecure.example.test/portal',
      KSS_FOOTASYLUM_AUDITS_URL: 'https://audits.example.test/home',
      KSS_TRAINING_URL: 'https://training.example.test/login',
    },
  });
  const admin = client();
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(base); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    const cookies = Object.fromEntries(await Promise.all(Object.keys(users).map(async (name) => [name, await cookieFor(name)])));
    const get = (path, as, extra = {}) => fetch(base + path, { redirect: 'manual', headers: { ...(as ? { cookie: cookies[as] } : {}), ...extra } });
    const me = async (as) => { const response = await get('/api/me', as); return [response.status, await response.json()]; };
    const createRole = async (personId, roleCode, effectiveUntil = null) => {
      const response = await fetch(base + '/api/access/roles', {
        method: 'POST',
        headers: { cookie: cookies.admin, 'content-type': 'application/json' },
        body: JSON.stringify({ personId, roleCode, effectiveFrom: new Date(Date.now() - 60000).toISOString(), effectiveUntil }),
      });
      assert.equal(response.status, 201, `grant ${roleCode}`);
      return response.json();
    };
    const revokeRole = async (id) => {
      const response = await fetch(`${base}/api/access/roles/${id}`, { method: 'PATCH', headers: { cookie: cookies.admin } });
      assert.equal(response.status, 200, `revoke role ${id}`);
    };
    for (const path of paths) {
      const anon = await get(path);
      assert.equal(anon.status, 307, `anonymous ${path}`);
      assert.equal(anon.headers.get('location'), `/?next=${encodeURIComponent(path)}`);
      assert.match(anon.headers.get('cache-control') ?? '', /private.*no-store/);
      const unmapped = await get(path, 'unmapped');
      assert.equal(unmapped.status, 307, `unmapped ${path}`);
      assert.equal(unmapped.headers.get('location'), `/?next=${encodeURIComponent(path)}`);
    }
    assert.equal((await me(undefined))[0], 401);
    assert.deepEqual(await me('unmapped'), [403, { error: 'No Enterprise access' }]);
    const expected = {
      admin: ['/app', '/work', '/people', '/crm', '/sites', '/events', '/mobilisations', '/workforce', '/control-room', '/assets', '/documents', '/onboarding', '/profile', '/incidents', '/access/incident-reviewers'], office: ['/app', '/work', '/people', '/crm', '/sites', '/events', '/mobilisations', '/workforce', '/control-room', '/assets', '/documents', '/onboarding', '/profile'],
      staff: ['/app', '/sites', '/my-schedule', '/my-deployments', '/my-equipment', '/my-work-time', '/action-centre', '/my-availability', '/documents', '/onboarding', '/profile', '/incidents'], zero: ['/app', '/sites', '/my-schedule', '/my-deployments', '/my-equipment', '/my-work-time', '/action-centre', '/my-availability', '/documents', '/onboarding', '/profile', '/incidents'],
      operations: ['/app', '/people', '/sites', '/events', '/workforce', '/control-room', '/assets', '/profile'],
    };
    for (const [as, links] of Object.entries(expected)) {
      const [status, body] = await me(as);
      assert.equal(status, 200, as);
      assert.deepEqual(body.navigation.map((item) => item.href), links, as);
      assert.equal((await get('/app', as)).status, 200);
      assert.equal((await get('/profile', as)).status, 200);
    }

    const homeHtml = async (as) => (await get('/app', as)).text();
    const staffHome = await homeHtml('staff');
    assert.match(staffHome, /MagSecure/);
    assert.match(staffHome, /Training/);
    assert.doesNotMatch(staffHome, /Footasylum Audits/);
    for (const [label, href] of [
      ['MagSecure', 'https://magsecure.example.test/portal'],
      ['Training', 'https://training.example.test/login'],
    ]) {
      assert.match(staffHome, new RegExp(`href="${href.replaceAll('.', '\\.')}"`));
      assert.match(staffHome, new RegExp(`aria-label="Open ${label} in a new tab"`));
    }
    assert.match(staffHome, /target="_blank" rel="noopener noreferrer"/);
    assert.doesNotMatch(staffHome, /href="https:\/\/audits\.example\.test/);
    assert.doesNotMatch(staffHome, /href="https:\/\/[^"?]+\?/);

    const [, staffPrincipal] = await me('staff');
    const expiresAt = new Date(Date.now() + 10000).toISOString();
    await createRole(staffPrincipal.person.id, 'OFFICE_ADMIN', expiresAt);
    assert.match(await homeHtml('staff'), /Footasylum Audits/);
    await new Promise((resolve) => setTimeout(resolve, 10200));
    const afterExpiry = await homeHtml('staff');
    assert.match(afterExpiry, /MagSecure/);
    assert.match(afterExpiry, /Training/);
    assert.doesNotMatch(afterExpiry, /Footasylum Audits/);
    assert.equal((await get('/sites', 'operations')).status, 200);
    assert.equal((await get('/events', 'operations')).status, 200);
    assert.equal((await get('/events', 'staff')).status, 404);
    assert.equal((await get('/mobilisations', 'office')).status, 200);
    assert.equal((await get('/mobilisations', 'operations')).status, 404);
    assert.equal((await get('/mobilisations', 'staff')).status, 404);
    assert.equal((await get('/api/mobilisations', 'operations')).status, 403);
    assert.equal((await get('/workforce', 'staff')).status, 404);
    assert.equal((await get('/workforce', 'operations')).status, 200);
    assert.equal((await get('/my-schedule', 'staff')).status, 200);
    assert.equal((await get('/my-schedule', 'operations')).status, 404);
    assert.equal((await get('/api/workforce', 'staff')).status, 403);
    assert.equal((await get('/api/my-schedule', 'operations')).status, 403);
    assert.equal((await get('/my-deployments', 'staff')).status, 200);
    assert.equal((await get('/my-deployments', 'operations')).status, 404);
    assert.equal((await get('/action-centre', 'staff')).status, 200);
    assert.equal((await get('/action-centre', 'operations')).status, 404);
    assert.equal((await get('/action-centre', 'office')).status, 404);
    assert.equal((await get('/my-availability', 'staff')).status, 200);
    assert.equal((await get('/my-availability', 'operations')).status, 404);
    assert.equal((await get('/api/availability/me', 'operations')).status, 403);
    assert.equal((await get('/api/deployments/me', 'operations')).status, 403);
    assert.equal((await get('/api/events', 'staff')).status, 403);
    assert.equal((await get('/api/events/staffing-roles', 'staff')).status, 403);
    assert.equal((await get('/api/events/b2fef3a7-68ae-4241-a1ce-2a9cb36c8490/staffing-requirements', 'staff')).status, 403);
    assert.equal((await get('/api/events/b2fef3a7-68ae-4241-a1ce-2a9cb36c8490/staffing-requirements', 'operations')).status, 200);
    assert.equal((await get('/crm', 'operations')).status, 404);
    assert.equal((await get('/work', 'operations')).status, 404);
    assert.equal((await get('/onboarding', 'operations')).status, 404);
    assert.equal((await get('/people', 'operations')).status, 200);
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
    const grant = await createRole(person.officeB, 'OPERATIONS', new Date(Date.now() + 3600000).toISOString());
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
      await revokeRole(grant.id);
    }
  } finally { server.kill(); }
});
