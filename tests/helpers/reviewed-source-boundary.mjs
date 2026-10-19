import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Keep the historical release inventories immutable. A later functional change
// must name its exact old and reviewed new bytes rather than skip a source file.
const repair = JSON.parse(readFileSync(new URL('../../docs/delivery/evidence/CRM-READ-LIFECYCLE-20261019/source-delta.json', import.meta.url), 'utf8'));
assert.equal(repair.baseCommit, 'a95d85079c33a3fd352bd190599864a79240c27c');
assert.equal(repair.file, 'src/components/crm-operational.tsx');
assert.equal(repair.beforeSha256, '3844f83adf0656d3d640a018b36a068fd7ad8748b32836ffc6c45bc583dc030c');
assert.match(repair.afterSha256, /^[0-9a-f]{64}$/);

export function reviewedPublishedSha(row) {
  if (row.file !== repair.file) return row.sha256;
  assert.equal(row.sha256, repair.beforeSha256, row.file);
  return repair.afterSha256;
}
