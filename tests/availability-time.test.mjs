import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAvailabilityRange } from '../src/lib/events/availability-time.ts';

test('London all-day ranges preserve 23/25-hour DST days and inclusive date selection',()=>{
 const spring=parseAvailabilityRange({mode:'ALL_DAY',startDate:'2027-03-28',endDate:'2027-03-28'});
 const autumn=parseAvailabilityRange({mode:'ALL_DAY',startDate:'2026-10-25',endDate:'2026-10-25'});
 assert.equal((new Date(spring.ends)-new Date(spring.starts))/3600000,23);
 assert.equal((new Date(autumn.ends)-new Date(autumn.starts))/3600000,25);
 assert.equal(autumn.starts,'2026-10-24T23:00:00.000Z');
 assert.equal(autumn.ends,'2026-10-26T00:00:00.000Z');
 assert.equal(parseAvailabilityRange({mode:'ALL_DAY',startDate:'2026-02-30',endDate:'2026-02-30'}),null);
});

test('custom London times reject missing/ambiguous local clocks and support overnight ranges',()=>{
 assert.equal(parseAvailabilityRange({mode:'CUSTOM',startsLocal:'2027-03-28T01:30',endsLocal:'2027-03-28T04:00'}),null);
 assert.equal(parseAvailabilityRange({mode:'CUSTOM',startsLocal:'2026-10-25T01:30',endsLocal:'2026-10-25T04:00'}),null);
 const overnight=parseAvailabilityRange({mode:'CUSTOM',startsLocal:'2027-02-10T22:00',endsLocal:'2027-02-11T06:00'});
 assert.equal((new Date(overnight.ends)-new Date(overnight.starts))/3600000,8);
 assert.equal(parseAvailabilityRange({mode:'CUSTOM',startsLocal:'2027-02-11T07:00',endsLocal:'2027-02-11T06:00'}),null);
});

test('rest of today starts at the current instant and ends at next London midnight',()=>{
 const now=new Date('2026-10-25T12:42:00.000Z');
 const range=parseAvailabilityRange({mode:'REST_TODAY'},now);
 assert.equal(range.starts,now.toISOString());
 assert.equal(range.ends,'2026-10-26T00:00:00.000Z');
});
