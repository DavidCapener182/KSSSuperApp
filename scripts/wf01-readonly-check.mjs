import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';
import { signInWithTestSession } from '../tests/helpers/auth-session.mjs';

const base = process.env.WF01_LOCAL_BASE ?? 'http://127.0.0.1:3101';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key);

async function cookie(email, password) {
  assert.ok(email && password);
  let values = [];
  const client = createServerClient(url, key, { cookies: {
    getAll: () => values,
    setAll: items => { values = items.map(({ name, value }) => ({ name, value })); },
  } });
  const { error } = await signInWithTestSession(client, { email, password });
  assert.ifError(error);
  return values.map(({ name, value }) => `${name}=${value}`).join('; ');
}

const [office, staff] = await Promise.all([
  cookie(process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD),
  cookie(process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD),
]);
const check = async (path, session) => (await fetch(base + path, {
  redirect: 'manual', headers: session ? { cookie: session } : {},
})).status;
const routes = [
  ['/workforce?week=2026-09-21&day=2026-09-25', 200, 404],
  ['/api/workforce?week=2026-09-21', 200, 403],
  ['/my-schedule?week=2026-09-21', 404, 200],
  ['/api/my-schedule?week=2026-09-21', 403, 200],
];
for (const [path, expectedOffice, expectedStaff] of routes) {
  const actualOffice = await check(path, office);
  const actualStaff = await check(path, staff);
  assert.equal(actualOffice, expectedOffice, `${path} Office status`);
  assert.equal(actualStaff, expectedStaff, `${path} Staff status`);
  console.log(`${path}: Office ${actualOffice}, Staff ${actualStaff}`);
}
