import test from 'node:test';
import assert from 'node:assert/strict';
import { externalAppShortcutsForRoles } from '../src/lib/external-apps.ts';

const config = {
  KSS_MAGSECURE_URL: 'https://secure.example.test/portal',
  KSS_FOOTASYLUM_AUDITS_URL: 'https://audits.example.test/home',
  KSS_TRAINING_URL: 'https://learn.example.test/login',
};

test('external shortcut role visibility matches the approved matrix', () => {
  const visible = (role) => externalAppShortcutsForRoles([role], config).map((item) => item.id);
  assert.deepEqual(visible('SUPER_ADMIN'), ['magsecure', 'footasylum-audits', 'training']);
  assert.deepEqual(visible('OFFICE_ADMIN'), ['magsecure', 'footasylum-audits', 'training']);
  assert.deepEqual(visible('OPERATIONS'), ['magsecure', 'footasylum-audits', 'training']);
  assert.deepEqual(visible('SECURITY_STAFF'), ['magsecure', 'training']);
});

test('multi-role shortcuts use the union of roles supplied by the active server principal', () => {
  assert.deepEqual(externalAppShortcutsForRoles(['SECURITY_STAFF', 'OFFICE_ADMIN'], config).map((item) => item.id), [
    'magsecure', 'footasylum-audits', 'training',
  ]);
  assert.deepEqual(externalAppShortcutsForRoles(['SECURITY_STAFF'], config).map((item) => item.id), ['magsecure', 'training']);
  // An expired Office role drops out of the current server principal's role list.
  assert.deepEqual(externalAppShortcutsForRoles([], config), []);
});

test('missing and malformed destinations fail closed', () => {
  for (const value of [undefined, '', 'not-a-url', 'http://secure.example.test', 'https://user@secure.example.test', 'https://secure.example.test?token=x', 'https://secure.example.test#top', 'https://localhost', 'https://secure.example.test:8443']) {
    const cards = externalAppShortcutsForRoles(['SECURITY_STAFF'], { ...config, KSS_MAGSECURE_URL: value });
    assert.equal(cards.find((item) => item.id === 'magsecure')?.href, null, String(value));
  }
});

test('only configured HTTPS URLs matching their approved host are returned', () => {
  assert.deepEqual(externalAppShortcutsForRoles(['OFFICE_ADMIN'], config).map(({ id, href }) => ({ id, href })), [
    { id: 'magsecure', href: 'https://secure.example.test/portal' },
    { id: 'footasylum-audits', href: 'https://audits.example.test/home' },
    { id: 'training', href: 'https://learn.example.test/login' },
  ]);
});
