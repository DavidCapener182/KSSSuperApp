import assert from 'node:assert/strict';
import { test } from 'node:test';
import { londonDueToIso } from '../src/lib/crm/due-time.ts';
import { crmDueStatus } from '../src/lib/crm/due-status.ts';

test('05B London due times reject DST gaps and overlaps',()=>{
 assert.equal(londonDueToIso('2026-07-01T09:00'),'2026-07-01T08:00:00.000Z');
 assert.equal(londonDueToIso('2026-01-01T09:00'),'2026-01-01T09:00:00.000Z');
 assert.equal(londonDueToIso('2026-03-29T01:30'),undefined);
 assert.equal(londonDueToIso('2026-10-25T01:30'),undefined);
 assert.equal(londonDueToIso('2026-02-30T09:00'),undefined);
 assert.equal(londonDueToIso(null),null);
});

test('05B due labels use only actual due times and a controlled clock',()=>{
 const now=new Date('2026-09-23T10:00:00Z');
 assert.equal(crmDueStatus(null,now),'No due date');
 assert.equal(crmDueStatus('2026-09-23T09:59:59Z',now),'Overdue');
 assert.equal(crmDueStatus('2026-09-23T16:00:00Z',now),'Due today');
 assert.equal(crmDueStatus('2026-09-24T08:00:00Z',now),'Upcoming');
});
