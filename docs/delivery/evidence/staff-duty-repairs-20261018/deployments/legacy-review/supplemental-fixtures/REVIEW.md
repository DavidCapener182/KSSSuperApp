# Supplemental U56 legacy fixtures — frozen

External-only review of `staff-shift-entry-local.test.mjs` and `event-deployment-journey-local.test.mjs`. Integration tests/product files untouched; original test snapshots are `.mjs.txt`, adapted snapshots `.mjs.adapted.txt`, with individual patches.

Original38 cases reproduced33pass/5fail, exactly the remaining failures in these two files reported by root. Adapted copies plus first legacy10 and dedicated U5619 pass67/67,0fail/skip. Both current focused readbacks now return the actual next revision; held successful PATCH returns `{revision:2}`. All Event allocation/cancel/role/conflict/lifetime tests and exact Staff endpoint/payload/reason/note/returnWeek assertions remain unchanged.

The explicit-rejection fixture previously returned `ok:false` without any HTTP status and expected no read. It now models an actual409 conflict. The authorised repair performs one read-only current refresh after explicit400/409, retaining the current pending allocation/draft; the updated assertion expects3calls and exactly1PATCH, with the final call read-only, and still requires exact rejection feedback and no success. Its title reflects this controlled semantics change. No handler was changed to satisfy the old fixture.

Negative readback fixtures now start with a valid next-revision receipt/state so wrong-source, changed-after-readback and denied-read tests genuinely reach their intended branch. New GET-count assertions prove that correct/page-denied paths reach both reads and other mismatches stop after the exact read. They cannot pass merely because a malformed/stale receipt failed earlier. Event/Site decline readbacks retain exact typed source, reason, note and expectedRevision.

No new source authority, API shape, permission, real record or network request was introduced. The first U56 fixture/controlled receipt remains immutable. Root separately owns prior-batch chained hash assertions and U57 once frozen. Use beforeSHA checks before applying patches and retain existing U55 receipt. Reproduce the exact67-case set:

`node --test tests/staff-shift-entry-local.test.mjs tests/event-deployment-journey-local.test.mjs tests/ui-staff-duty-local.test.mjs tests/ui-my-deployments-scope-local.test.mjs`
