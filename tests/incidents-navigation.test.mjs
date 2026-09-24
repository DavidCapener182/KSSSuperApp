import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigationFor } from '../src/lib/auth/capabilities.ts';
import { safeReturnTarget } from '../src/lib/auth/return-target.ts';

const principal=(roles,incidentReviewer=false)=>({userId:'synthetic',personId:'10000000-0000-4000-8000-000000000003',displayName:'Synthetic User',roles,incidentReviewer});
const hrefs=(p)=>navigationFor(p).map((item)=>item.href);

test('TASK-12A navigation follows explicit Incident authority',()=>{
 assert.ok(hrefs(principal(['SECURITY_STAFF'])).includes('/incidents'));
 assert.ok(!hrefs(principal(['OPERATIONS'])).includes('/incidents'));
 assert.ok(hrefs(principal(['OPERATIONS'],true)).includes('/incidents'));
 assert.ok(!hrefs(principal(['OFFICE_ADMIN'])).includes('/incidents'));
 assert.ok(hrefs(principal(['SUPER_ADMIN'])).includes('/incidents'));
 assert.ok(hrefs(principal(['SUPER_ADMIN'])).includes('/access/incident-reviewers'));
});

test('TASK-12A return targets preserve Incident destinations after sign-in',()=>{
 for(const path of ['/incidents','/incidents/10000000-0000-4000-8000-000000000003','/access/incident-reviewers'])assert.equal(safeReturnTarget(path),path);
 for(const path of ['//elsewhere.invalid/incidents','/incidents/../app','/incidents#report'])assert.equal(safeReturnTarget(path),null);
});
