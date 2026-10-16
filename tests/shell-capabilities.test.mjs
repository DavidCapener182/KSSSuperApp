import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capabilitiesFor, navigationFor } from '../src/lib/auth/capabilities.ts';

for (const role of ['SUPER_ADMIN', 'OFFICE_ADMIN', 'OPERATIONS', 'SECURITY_STAFF']) {
  test(`existing Time Away and Service Delivery entry scope: ${role}`, () => {
    const principal = { roles: [role], incidentReviewer: false };
    const capabilities = capabilitiesFor(principal);
    const paths = navigationFor(principal).map((item) => item.href);
    const staff = role === 'SECURITY_STAFF';
    const serviceManager = ['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(role);

    assert.equal(capabilities.has('TIME_AWAY_SELF'), staff);
    assert.equal(paths.includes('/my-time-away'), staff);
    // Manager entry does not confer a finite team/action approval grant.
    assert.equal(capabilities.has('TIME_AWAY_ENTRY'), !staff);
    assert.equal(paths.includes('/time-away'), !staff);
    assert.equal(capabilities.has('SERVICE_DELIVERY_USE'), serviceManager);
    assert.equal(paths.includes('/service-delivery'), serviceManager);
  });
}

test('no active role receives neither Time Away nor Service Delivery entry', () => {
  const principal = { roles: [], incidentReviewer: false };
  assert.equal(capabilitiesFor(principal).size, 0);
  assert.deepEqual(navigationFor(principal), []);
});
