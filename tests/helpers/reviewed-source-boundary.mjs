import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Keep the historical release inventories immutable. A later functional change
// must name its exact old and reviewed new bytes rather than skip a source file.
const repair = JSON.parse(readFileSync(new URL('../../docs/delivery/evidence/CRM-READ-LIFECYCLE-20261019/source-delta.json', import.meta.url), 'utf8'));
assert.equal(repair.baseCommit, 'a95d85079c33a3fd352bd190599864a79240c27c');
assert.equal(repair.file, 'src/components/crm-operational.tsx');
assert.equal(repair.beforeSha256, '3844f83adf0656d3d640a018b36a068fd7ad8748b32836ffc6c45bc583dc030c');
assert.match(repair.afterSha256, /^[0-9a-f]{64}$/);
const attendance = JSON.parse(readFileSync(new URL('../../docs/delivery/evidence/STAFF-ATTENDANCE-RETRY-20261019/source-delta.json', import.meta.url), 'utf8'));
assert.equal(attendance.baseCommit, 'c31c660981532e3beac8238a869153f37fec65b6');
assert.equal(attendance.file, 'src/components/my-attendance-client.tsx');
assert.equal(attendance.beforeSha256, '1b1b7902ea4bd07b70bdde14a08053a5a5beec863a1662263cd8d56d7cca2856');
assert.match(attendance.afterSha256, /^[0-9a-f]{64}$/);

export function reviewedPublishedSha(row) {
  const reviewed = [repair, attendance].find(change => change.file === row.file);
  if (!reviewed) return row.sha256;
  assert.equal(row.sha256, reviewed.beforeSha256, row.file);
  return reviewed.afterSha256;
}
