import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {createHash} from 'node:crypto';

const baseline='tests/fixtures/ui-work-inbox-baseline/';
for(const file of ['src/components/crm-task-actions.tsx','src/components/action-centre-client.tsx']) {
  test(`${file}: source reads, mutation, validation and confirmation handlers remain exact`, async()=>{
    const [before,after]=await Promise.all([readFile(baseline+file,'utf8'),readFile(file,'utf8')]);
    assert.equal(after.split('  return <main')[0],before.split('  return <main')[0]);
  });
}
for(const file of ['src/app/(enterprise)/work/page.tsx','src/app/(enterprise)/work/[taskId]/page.tsx','src/app/(enterprise)/action-centre/page.tsx']) {
  test(`${file}: actual server identity, capability and source handoff boundary unchanged`, async()=>{
    const [before,after]=await Promise.all([readFile(baseline+file),readFile(file)]);assert.deepEqual(after,before);
  });
}
test('all sixteen reviewed Stage1 product contracts remain frozen during U04–U06',async()=>{
  const {files}=JSON.parse(await readFile('tests/fixtures/ui-stage1-receipts/stage1-frozen-source-hashes.json','utf8'));
  const revision=JSON.parse(await readFile('tests/fixtures/ui-stage1-receipts/stage1-revision-2-workforce-height.json','utf8'));
  for(const {file,sha256}of files)assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),file===revision.file?revision.sha256:sha256,file);
});
