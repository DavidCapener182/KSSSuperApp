import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createServerClient } from '@supabase/ssr';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const users = {
  admin: [process.env.KSS_TEST_ADMIN_EMAIL, process.env.KSS_TEST_ADMIN_PASSWORD],
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
  staff: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
};
const staffPersonId = '10000000-0000-4000-8000-000000000003';
async function cookiesFor(name) {
  let cookies = [];
  const client = createServerClient(url, key, { cookies: {
    getAll: () => cookies,
    setAll: items => { cookies = items.map(({ name, value }) => ({ name, value })); },
  } });
  const { error } = await signInWithTestSession(client, { email: users[name][0], password: users[name][1] });
  assert.ifError(error);
  return cookies.map(({ name, value }) => name + '=' + value).join('; ');
}
async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; server.close(); await once(server, 'close'); return port;
}

test('PRODUCT-07 exact HTTP event receipts for synthetic issue and return', {
  skip: process.env.KSS_PRODUCT07_MUTATION_PROOF !== '1', timeout: 180000,
}, async () => {
  assert.ok(url && key && Object.values(users).every(([email, password]) => email && password));
  const port = await freePort(); const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    { cwd: process.cwd(), stdio: 'ignore' });
  let grantId;
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(base); break; } catch { await new Promise(resolve => setTimeout(resolve, 200)); } }
    const cookies = {};
    for (const name of Object.keys(users)) cookies[name] = await cookiesFor(name);
    const get = async (path, as) => {
      const response = await fetch(base + path, { headers: { cookie: cookies[as] } });
      return { status: response.status, body: await response.json() };
    };
    const post = async (as, body) => {
      const response = await fetch(base + '/api/assets', { method: 'POST',
        headers: { cookie: cookies[as], 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, requestKey: crypto.randomUUID() }) });
      return { status: response.status, body: await response.json() };
    };
    const admin = await get('/api/assets?admin=1', 'admin'); assert.equal(admin.status, 200);
    const store = admin.body.data.scopes.find(scope => scope.kind === 'STORE'); assert.ok(store);
    const grant = await post('admin', { action: 'GRANT', personId: '10000000-0000-4000-8000-000000000007',
      scopeKind: 'STORE', scopeId: store.id, until: new Date(Date.now() + 3600000).toISOString(),
      reason: 'PRODUCT-07 synthetic source-event proof' });
    assert.equal(grant.status, 200); grantId = grant.body.result; assert.match(grantId, /^[0-9a-f-]{36}$/i);
    const suffix = Date.now().toString(36).toUpperCase();
    const registered = await post('office', { action: 'REGISTER', reference: 'P07-' + suffix,
      class: 'RADIO', description: 'PRODUCT-07 synthetic handover proof', condition: 'GOOD', storeId: store.id });
    assert.equal(registered.status, 200, JSON.stringify(registered.body));
    assert.equal(registered.body.receipt.eventId, registered.body.result.eventId);
    assert.equal(registered.body.receipt.action, 'REGISTER');
    const assetId = registered.body.result.id;
    const issued = await post('operations', { action: 'ISSUE', assetId, expectedRevision: 1,
      holderKind: 'PERSON', holderId: staffPersonId, condition: null,
      expectedReturnAt: new Date(Date.now() + 86400000).toISOString(), reason: null });
    assert.equal(issued.status, 200, JSON.stringify(issued.body));
    assert.equal(issued.body.receipt.eventId, issued.body.result.eventId);
    assert.equal(issued.body.receipt.action, 'ISSUE');
    assert.equal(issued.body.receipt.holderId, staffPersonId);
    assert.equal((await get('/api/assets?receipt=' + issued.body.result.eventId, 'staff')).body.data, null,
      'recipient cannot read an Operations event receipt');
    const acknowledged = await post('staff', { action: 'ACK_ISSUE', assetId, expectedRevision: 2,
      condition: null, reason: null });
    assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged.body));
    assert.equal(acknowledged.body.receipt.action, 'ACK_ISSUE');
    const returned = await post('operations', { action: 'RETURN', assetId, expectedRevision: 3,
      holderKind: 'STORE', holderId: store.id, condition: 'SERVICEABLE', expectedReturnAt: null,
      reason: 'Synthetic return observation' });
    assert.equal(returned.status, 200, JSON.stringify(returned.body));
    assert.equal(returned.body.receipt.action, 'RETURN');
    assert.equal(returned.body.receipt.holderId, store.id);
    const receiving = await post('operations', { action: 'ACK_RETURN', assetId, expectedRevision: 4,
      condition: null, reason: null });
    assert.equal(receiving.status, 200, JSON.stringify(receiving.body));
    const history = await get('/api/assets?assetId=' + assetId, 'office');
    assert.equal(history.status, 200);
    for (const event of [registered, issued, acknowledged, returned, receiving])
      assert.ok(history.body.data.events.some(value => value.id === event.body.result.eventId));
  } finally {
    if (grantId) {
      // Revoke only this test-created grant. History remains attributable.
      const cookies = await cookiesFor('admin');
      await fetch(base + '/api/assets', { method: 'POST', headers: { cookie: cookies, 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE_GRANT', grantId,
          reason: 'PRODUCT-07 synthetic proof completed', requestKey: crypto.randomUUID() }) });
    }
    server.kill('SIGTERM'); if (server.exitCode === null) await once(server, 'exit');
  }
});
