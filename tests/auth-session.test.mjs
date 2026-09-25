import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signInWithTestSession } from './helpers/auth-session.mjs';

test('synthetic sessions are reused only for the matching project and persona', async () => {
  let signIns = 0;
  let restores = 0;
  const client = () => ({ auth: {
    async signInWithPassword() {
      signIns++;
      return { data: { session: {
        access_token: `test-access-${signIns}`,
        refresh_token: `test-refresh-${signIns}`,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      } }, error: null };
    },
    async setSession(session) {
      restores++;
      return { data: { session }, error: null };
    },
  } });
  const credentials = { email: 'session-cache@example.test', password: 'synthetic-only' };
  await signInWithTestSession(client(), credentials, 'https://one.example.test');
  await signInWithTestSession(client(), credentials, 'https://one.example.test');
  await signInWithTestSession(client(), credentials, 'https://two.example.test');
  assert.equal(signIns, 2);
  assert.equal(restores, 1);
});

test('a refreshed synthetic session replaces the cached token pair', async () => {
  const restored = [];
  const client = () => ({ auth: {
    async signInWithPassword() {
      return { data: { session: { access_token: 'initial-access', refresh_token: 'initial-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null };
    },
    async setSession(session) {
      restored.push(session.refresh_token);
      return { data: { session: { access_token: 'rotated-access', refresh_token: 'rotated-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null };
    },
  } });
  const identity = { email: 'rotating-session@example.test', password: 'synthetic-only' };
  await signInWithTestSession(client(), identity, 'https://rotation.example.test');
  await signInWithTestSession(client(), identity, 'https://rotation.example.test');
  await signInWithTestSession(client(), identity, 'https://rotation.example.test');
  assert.deepEqual(restored, ['initial-refresh', 'rotated-refresh']);
});
