import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addCivilDays, londonWeekStart, validDate } from '../src/lib/events/workforce-week.ts';

test('London schedule weeks use civil Monday dates without shifting DST weeks',()=>{
 assert.equal(londonWeekStart('2027-06-19'),'2027-06-14');
 assert.equal(londonWeekStart('2027-03-28'),'2027-03-22');
 assert.equal(londonWeekStart('2027-10-31'),'2027-10-25');
 assert.equal(addCivilDays('2027-03-28',1),'2027-03-29');
 assert.equal(validDate('2027-02-29'),false);
 assert.equal(londonWeekStart('2027-02-29'),null);
 assert.equal(londonWeekStart('2027-13-01'),null);
});
