# U57 independent legacy contract review — frozen

External-only adaptation of current integration `tests/ui-staff-duty-local.test.mjs`, beforeSHAa881e82a120186df778e543292d474e9c4775ef0f89e5c21044461d90aba201d. No product/integration edits. Root's imported My Attendance source1b1b7902ea4bd07b70bdde14a08053a5a5beec863a1662263cd8d56d7cca2856 matches the worker frozen packet.

The exact40-case set reproduced39pass/1fail: only the legacy assertion requiring all Attendance handlers to remain byteidentical. The approved repair changes three extracted contracts (`reader:load`, `effect:0`, `fn:act`). The adapted legacy file adds only the pinned U57 contract branch and hashes. No fixture state/field/payload or existing test assertion was altered. Nine test bodies are byteidentical; the tenth preservation test retains all preceding assertions and extends the controlled revision receipt. All10 names remain identical. Schedule U55 and Deployment U56 branches and receipt bytes remain unchanged and are SHA-pinned again. Whole current/preUI Attendance file hashes prevent unlisted inline/presentation changes passing unnoticed; all unlisted extracted contracts still compare byte-for-byte. This extractor has no unaffected named Attendance contracts after the three explicit changes.

Adapted UI10 + dedicated U5720 + existing Staff attendance10 pass40/40,0fail/skip. Original role/payload/action/route/sharedCSS/manager/preceding-family guards remain. The existing Staff role-loss test's previously imported patch was reviewed but not modified: its formerly empty POST receipt now contains attributable event/revision/mode/method/time so the test actually reaches the denied GET; no-success/no-old-facts assertions remain.

## Existing API/source shape review and limits

The unchanged POST route validates Staff principal, allocation UUID, Event/Site source, CHECK_IN/CHECK_OUT, integer expectedRevision, actualAt and idempotency UUID; it passes the exact existing RPC result as `{result:data}`. GET validates the exact focused source/ID and offset0 before guarded `my_attendance_09b`. Source-controlled Event/Site receipt/summary definitions expose event_id, revision, replayed, events.revision/actor_mode/method/actual_at. No separate Person ID is exposed in this client projection; ownership remains server-authoritative. No actor-ID comparison was invented.

A successful-looking POST is confirmed only after its attributable STAFF_SELF/AUTHENTICATED_ONLINE event and exact current read match. Confirmation is of that selected allocation/event, not refresh of every appended page, identity of a named actor, or worked/payable time. Superseded summary revision, inaccessible/disappeared current source or a missing matching event leaves the result unconfirmed and keeps the safe retry payload. A later correction may change effective timestamps; existence of the recorded self event does not certify an absence of manager corrections.

A retained token after an explicit stale409 can continue to reject on manual retry if its expectedRevision remains obsolete; the component has no explicit discard-token control. This is a pre-existing retry-token retention limitation, not a reason to relax the no-false-success guard. No automatic replay occurs and no source/API/SQL expansion was made. Synthetic tests do not prove hosted authentication/RPC/RLS/persistence. Browser23-case evidence belongs to the separate frozen worker packet and was not rerun by this review.

## Handoff

Apply `legacy-fixture.patch` only after original SHA verification. Copy `attendance-legacy-contract-revision.json` to integration `output/ui-staff-duty-browser-20261018/`; retain Schedule and Deployment receipts unchanged. Reproduce:

`node --test tests/ui-staff-duty-local.test.mjs tests/ui-my-attendance-readback-local.test.mjs tests/staff-attendance-contract-local.test.mjs`

`preserved-test-bodies.json`, `legacy-red.tap`, `combined-green.tap` and `review-receipt.json` identify the immutable evidence. External runtime source/dependency links are read-only; local test and receipt copies are isolated.
