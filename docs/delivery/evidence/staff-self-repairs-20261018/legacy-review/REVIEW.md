# Independent Staff legacy fixture review

Frozen handoff: 17 existing legacy tests retained, 17 passed, zero skipped/failed in the external review runtime. Integration source/tests/tracker were not edited. Root already imported the two independently supplied product files; this review reads those exact hashes. The runtime uses read-only symlinks to integration source, baseline output and docs, plus its own test/receipt files. No hosted call, real write, permission action or publication occurred.

## Apply only these files

1. Apply legacy-fixture.patch to tests/ui-staff-records-local.test.mjs, or copy the adapted .mjs.txt after confirming the original .mjs.txt SHA matches the integration test. Original SHA: 1fa80694b51658cea9fc8be19b357a63e106208d07057e4c78308cfeab288fcf.
2. Copy legacy-fixture-revision.json to output/ui-staff-self-browser-20261018/legacy-fixture-revision.json. This is a new functional revision receipt, not a rewrite of the older UI-only receipt.
3. Run node --test tests/ui-staff-records-local.test.mjs together with the two newly imported dedicated Staff tests, then root’s normal full offline checks. The standalone adapted legacy run is saved in adapted-run-final.tap. review-receipt.json freezes old/adapted test, patch, revision receipt and result hashes.

## What changed in the fixture

The hook boundary now supports persistent refs and seeds live/current-source availability for mutation tests. Static snapshots explicitly represent a loaded authorised source; unavailable snapshots remain unavailable. Availability preview seeds include their exact request fingerprint and reviewed cancellation revision. Synthetic POST receipts and current/history readbacks now expose the fields already returned by the API. The Worked Time mock distinguishes POST from a GET carrying cache options and returns the exact new revision, segments and history before expecting the idempotency key to clear. Unconfirmed feedback assertions recognise the new safe wording without dropping any payload, revision, key, interval, call-count, role or rejection assertion.

The old blanket function-equality assertion now recognises exactly the authorised two-file functional revision: complete component hashes, pre-UI baseline hashes and each changed contract’s before/after hash are pinned in the new receipt. Thirteen Availability contract entries and eight Worked Time entries changed or were added. The nine unaffected extracted contract entries still compare byte-for-byte. TimeAwayClient remains fully byte-identical for all named functions/effects, and its five-state manager markup plus both manager/shared stylesheets remain exactly compared. All route-role tests, no-inferred-segment checks and existing predecessor receipts remain intact. No test was removed. The legacy overlapping Work/Break example tests component payload serialization, not SQL interval acceptance; it must not be described as persisted valid-time acceptance.

## API and SQL shape review

Existing availability POST/PATCH return numeric next revision; current and history readers return integer revisions/totals and the history kind/state/period/lifecycle fields used by the new guards. The source SQL records CREATED/CANCELLED at the same returned revision. Timestamp comparisons normalise instants where format may differ.

Existing Worked Time POST returns result.case_id, revision_id, revision and status. The read projection returns the allocation/Event/allocation revision, current case/revision/status, source-ordered revision list and existing DRAFT_SAVED/SUBMITTED events. Segments retain input segment_no ordering, and readback normalises their timestamps. These guards are supported by the present projection. The read projection does not expose the revision-row UUID; the guard can validate receipt UUID shape and matching case/revision but cannot independently match that UUID against a readback field that is absent. No extra identity is invented.

## Unresolved valid-write/unconfirmed limitation

Availability history is limited to the first 25 rows, ordered by occurred_at descending and UUID descending. A valid replacement across many existing ranges can create more than 25 history events in one transaction with the same timestamp. The matching CREATED event can fall outside that first page, so a valid accepted write may be reported unconfirmed even when its current revision matches. This is safe against false success and does not imply rejection; it is a remaining confirmation-coverage limitation. A concurrent later revision also deliberately produces an unconfirmed outcome. No automatic replay, API expansion, SQL change or relaxation of the exact guard is proposed in this patch.

A cancelled staffing requirement is also not independently exposed in the Worked Time self projection; existing server RPC checks remain authoritative. Local/browser mocks do not prove real authentication, RLS, persistence, interval validity or hosted approval.
