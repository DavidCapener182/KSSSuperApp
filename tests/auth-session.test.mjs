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
