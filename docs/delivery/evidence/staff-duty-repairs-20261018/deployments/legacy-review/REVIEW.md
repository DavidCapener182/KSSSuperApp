# U56 independent legacy fixture review — frozen

No product or integration file was edited. The current integration legacy test was first saved as `ui-staff-duty-local.test.mjs.txt`; the adapted copy remains external. Its original U55 two-key Schedule receipt is unchanged and additionally SHA-pinned by the new U56 receipt.

The unchanged legacy fixture reproduced6 passes/4 failures against imported U56 source5261b1b595d484923070beaa120c756745b009cb1ed7536916922bf6afda0730. Two static renders lacked the new loaded-selection context; the valid accept path supplied an empty receipt and unchanged read revision; the byte-identity assertion correctly detected the authorised four contract changes. No source relaxation was made.

The adapted10/10 legacy cases pass. The same run with19 unchanged dedicated U56 cases passes29/29,0 failures/skips. Changes are limited to current loaded-selection seeding for current Deployment renders, integer next-revision receipt/readback fixtures, and a pinned U56 controlled contract receipt. Baseline static renders remain baseline. Both legacy response scenarios retain exact Site/Event endpoint, expectedRevision, decline reason/note, exact source read and false-success assertions. Every original test and assertion remains; preservation assertions are strengthened with hashes rather than removed. All Schedule, Attendance, route/role/sharedCSS/prior-batch assertions are unchanged. Existing U55 receipt source text and two-key checks are unchanged.

The U56 receipt pins whole current/preUI files and the four authorised changed extracted contracts (`reader:clearFacts`, `reader:load`, `effect:0`, `fn:respond`), including a null baseline for the new callback. Every unlisted extracted contract still compares byte-for-byte. This extractor has no unaffected named Deployment contracts after the four changes; that limitation is explicit, and the whole component hash prevents unlisted presentation/inline changes from passing unnoticed. Root separately owns prior Staff-record chained hash preservation8ef381→d958→5261.

## Existing source contract and valid-path limits

Both unchanged PATCH routes return `{revision:data}` for their existing guarded Event/Site RPC; they already validate Staff authority, expectedRevision, response and decline reason/note. The GET route retains Staff authority and exact focus/source projection. The new source matches an integer next-revision receipt against one exact focused record and the fresh current page, with exact source/ID/status/revision. It confirms visible current state; it cannot independently prove an audit reason or actor because those facts are not in this reader.

A valid write can remain unconfirmed if a concurrent revision supersedes it or the refreshed current page no longer contains that allocation. This intentionally preserves no-false-success behavior and the existing two-read/page requirement; no write is replayed automatically. Pagination/concurrent-page movement is a usability limitation, not evidence that the server rejected a write. Readback failure/role loss clears old facts; explicit400/409 can retain the exact current decline draft while a changed revision disables submission. Wrong source, malformed/stale receipt, denied refresh, synchronous duplicate, unmount and changed-focus paths are covered by the19 dedicated cases. No hosted persistence/RLS/real response was exercised.

## Root handoff

Apply `legacy-fixture.patch` to the current integration test only after verifying its original SHA; copy `deployments-legacy-contract-revision.json` into integration `output/ui-staff-duty-browser-20261018/`. Keep existing schedule receipt intact. Reproduce from an integration or external runtime with:

`node --test tests/ui-staff-duty-local.test.mjs tests/ui-my-deployments-scope-local.test.mjs`

The external runtime uses read-only source/dependency symlinks and its own test/receipt copies. Browser U56 acceptance is the separate worker's22-case evidence, not rerun or claimed by this review. U57 is untouched and will require a separate revision review once frozen.
