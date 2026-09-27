import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { createServerClient } from '@supabase/ssr';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function cookieFor(email, password) {
  let cookies = [];
  const client = createServerClient(url, key, { cookies: { getAll: () => cookies, setAll: (items) => { cookies = items.map(({ name, value }) => ({ name, value })); } } });
  const { error } = await signInWithTestSession(client, { email, password });
  assert.ifError(error);
  return cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
}

test('Today’s Duty and Control Room keep separate roles and source return context', { timeout: 90000 }, async () => {
  assert.ok(url && key && process.env.KSS_TEST_STAFF_A_EMAIL && process.env.KSS_TEST_STAFF_A_PASSWORD && process.env.KSS_TEST_OPERATIONS_EMAIL && process.env.KSS_TEST_OPERATIONS_PASSWORD);
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; socket.close(); await once(socket, 'close');
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: process.cwd(), stdio: 'ignore', env: process.env });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(base); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    const [staff, operations] = await Promise.all([
      cookieFor(process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD),
      cookieFor(process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD),
    ]);
    const anonymous = await fetch(`${base}/my-duty`, { redirect: 'manual' });
    assert.equal(anonymous.status, 307);
    assert.equal(anonymous.headers.get('location'), '/?next=%2Fmy-duty');
    assert.match(anonymous.headers.get('cache-control') ?? '', /private.*no-store/);
    const staffPage = await fetch(`${base}/my-duty`, { headers: { cookie: staff } });
    assert.equal(staffPage.status, 200);
    assert.match(await staffPage.text(), /Today’s Duty/);
    assert.equal((await fetch(`${base}/my-duty`, { headers: { cookie: operations } })).status, 404);
    assert.equal((await fetch(`${base}/api/my-schedule`, { headers: { cookie: operations } })).status, 403);
    assert.equal((await fetch(`${base}/api/deployments/me`, { headers: { cookie: operations } })).status, 403);
    const staffNavigation = await (await fetch(`${base}/api/me`, { headers: { cookie: staff } })).json();
    assert.ok(staffNavigation.navigation.some((item) => item.href === '/my-duty'));
    assert.equal((await fetch(`${base}/control-room`, { headers: { cookie: staff } })).status, 404);
    const desk = await fetch(`${base}/control-room?tab=attendance&offset=0`, { headers: { cookie: operations } });
    assert.equal(desk.status, 200);
    assert.match(await desk.text(), /Control Room/);
    const source = await (await fetch(`${base}/api/control-room`, { headers: { cookie: operations } })).json();
    const card = source.snapshot?.cards?.[0];
    assert.ok(card, 'synthetic Dev has an authorised Control Room source');
    const returnTo = `/control-room?tab=attendance&offset=0&focus=${card.source}:${card.source_id}:${card.service_date ?? ''}`;
    const destination = card.source === 'EVENT' ? `/events/${card.source_id}/attendance` : `/sites/${card.site_id}/services/${card.source_id}/attendance`;
    const sourcePage = await fetch(`${base}${destination}?returnTo=${encodeURIComponent(returnTo)}`, { headers: { cookie: operations } });
    assert.equal(sourcePage.status, 200);
    assert.match(await sourcePage.text(), /Return to Control Room/);
  } finally { server.kill('SIGTERM'); }
});
