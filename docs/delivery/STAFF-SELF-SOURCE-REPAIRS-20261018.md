# Staff self-service: verified local source repairs

Status: LOCAL_VERIFIED_AWAITING_INTEGRATION. Two product components only. Root owns independent integration and publication.

## Problem and resulting behaviour

Actual Chromium tests reproduced two defects in the frozen Staff source: a denied Availability refresh retained previous declarations and action buttons; an exact Worked Time allocation selection rendered an unrelated allocation returned by its synthetic API. Both failed at1440px and390px. Original source and failing images are preserved at task-3/output/ui-staff-self-browser-20261018/red-checkpoint01. The corresponding cases now pass against the final exact component bytes.

Availability now clears inaccessible current facts, history and stale action panels after denied/unavailable reads. A denied preview also clears current action authority. Loading and unavailable states do not claim an empty authorised source. A synchronous pending guard and disabled native fieldset preserve the reviewed range while a request is pending. Changed drafts need another preview, and replacement/deployment acknowledgements remain mandatory. Save/cancellation confirmation requires the returned next revision, the same current read revision and the matching existing history kind/state/period/lifecycle at that revision. The source already returns these history fields; no reader, API or SQL changed. Cancellation still targets the exact declaration ID and previews its exact current state/range before the write. Preview/cancellation/POST results are ignored after unmount or retired read lifetime. Sheet dismissal restores the exact connected action trigger, with the declaration trigger as fallback.

Worked Time now rejects responses outside the exact selected allocation and hides old facts immediately when selection changes. Denied/failed reads clear facts, edits and write affordances. A synchronous pending guard and native fieldset lock prevent duplicate writes and in-flight draft edits. Draft/submission success requires the existing receipt's case/revision/status, the exact current allocation/Event/allocation revision/case/revision/status, matching saved intervals and matching existing history. Cancelled Event sources cannot offer an edit that the existing RPC rejects. No attendance interval is inferred; incomplete attendance remains eligible for the existing submission workflow. Proposed minutes remain separate from payable/billable approval.

Unconfirmed writes never produce a success notice or automatic POST retry. Availability requires reload. Worked Time retains the existing persisted idempotency key until exact readback confirmation; a deliberate refresh and identical manual retry reuses that key. Late writes after unmount do not start old-context reads or confirmation. This does not abort a write or assert that the server rejected it.

## Exact scope and preservation

Product files:
- src/components/my-availability-client.tsx
- src/components/my-work-time-client.tsx

New dedicated tests:
- tests/ui-staff-self-readback-local.test.mjs
- tests/ui-staff-self-boundaries-local.test.mjs

No Time Away manager/client, API, auth, globals/shared Sheet, schema, SQL, grants, policy, credentials or deployment changes.409 other tracked source files in the isolated archive are preserved; copied CSS baseline dependencies remain byte-identical. Both original integration component hashes remain unchanged until root imports the reviewed packet. The archive started at810136361023ac513f8c484aee1a2bca3614ba3a, with the two owned frozen Staff components and CSS dependencies overlaid from verified current integration bytes; the frozen Staff UI was newer than that archive commit.

## Verification

54/54 explicit offline tests passed:31 actual-component source tests plus23 actual route/API source tests. These execute real source with synthetic hooks/JSX/HTTP/principal/RPC projections. Covered: current-source denial, exact selected allocation, valid/mismatched receipt and readback, wrong case/Event/allocation revision/status/interval/history, changed selection, late POST/JSON lifetime, pending duplicate writes, stable idempotency, preview invalidation, cancellation acknowledgement and source-history readback, exact trigger focus callback, absent/non-Staff page/API gates, generic errors and finite self-source RPC arguments. No hosted requests occur.

Scoped ESLint and TypeScript exit0. Native Next typegen supplied generated framework route types in the isolated archive; no product config change is included.

Final actual Chromium evidence: task-3/output/ui-staff-self-browser-20261018/green-run03/browser-results.json.43/43 named checks passed, including an eight-variant Worked Time readback matrix at each of1440/390. All three routes have matching before/after captures at1440/834/390/320. Document overflow checks passed for all candidate captures. Real Sheet keyboard Tab containment, Escape and Declare/Change trigger restoration passed at all four widths. Other representative flows: explicit conflict acknowledgement/stale revision, denied refresh, Time Away draft without team stays non-submittable, manual identical idempotency retry, source mismatch denial, exact saved revision/history, pending duplicate/unmount and Availability cancellation.58 captures were saved as116 full-page/viewport images. Browser process exited0 and fixture servers were closed by the harness. Zero external browser requests were recorded.

The immutable final visual packet is task-3/output/ui-staff-self-browser-20261018/visual-checkpoint02-final. It includes hashes for all116 images, browser results and the effective before/after source manifest. Both phases use published3c8ba25 shared foundation; the before route-local source is the frozen StaffRecords baseline. The actual route pages run against clearly labelled synthetic cookie principals, and API responses/mutations are intercepted locally. Unmatched APIs and writes return403. Existing held Operations browser commands were not run.

## Limits and integration handoff

These are synthetic local browser/source results, not authentication, hosted RPC, RLS, database persistence, real record acceptance or full77-route acceptance. No production writes or publication occurred. All remaining route-family holds remain unchanged.

Existing ui-staff-records-local.test.mjs asserts handler byte identity from the earlier UI-only phase and seeds older hook projections. Root must record this authorised two-file functional revision and adapt that legacy fixture's current-source/pending/lifetime preconditions while preserving its meaningful action assertions. This lane does not edit that legacy file, its frozen manifests or the integration tracker. New source tests and before hashes provide the bounded regression evidence for independent review.

Earlier diagnostic browser runs remain preserved. They include selector/timing issues and an intermediate repair cleanup failure; only green-run03 and its exact source hashes are the final acceptance evidence. The transport-interrupted write was inspected on authorised resume before further edits; no uncertain action was replayed.

Integrate only the five files enumerated in frozen-source/source-manifest.json after verifying the two existing before hashes. Source patch, local check exits, preservation receipt and final browser receipt accompany the frozen handoff.
