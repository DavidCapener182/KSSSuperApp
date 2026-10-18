# CRM and commercial browser review — U34–U38

Status: four-product source and browser packet frozen for coordinator review. No integration files, live sources or production services changed by this worker.

## Source and boundaries

Actual CRM/lead/Organisation/Opportunity/handoff route pages and components run on published shared foundation cc477fe3f23238b7ecf963d54692ebdd4101bf21. BEFORE uses exact route/component bytes at 9b958f67c874ddbae16be3b4fed450525ee44d1a; AFTER uses current integration plus the four authorised isolated repairs. Synthetic identity, API responses and Supabase boundaries are explicit. `/api/me` now matches rendered person, roles and incidentReviewer and returns exact foundation navigationFor results. Every browser request outside its localhost origin is aborted. Records, people, activities and mutations are simulated, with no real external communication. This is not hosted Auth/RPC/RLS acceptance.

## Reproduced repairs

1. The 834px active Pipeline crushed five columns and overflowed its canvas. The Pipeline now has a scoped container and keyboard-scrollable five-column tablet board; closed history retains its two-column structure. Phone view-switch controls wrap.
2. Organisation detail retained an intrinsic two-column grid at tablet width; scoped record CSS stacks it and constrains selects. CRM overview action links wrap at 320px.
3. Follow-up dialogs let Tab escape to background controls. A minimal archived pre-fix case still fails with corrected shell authority. The bounded UI effect controls initial focus, Tab/ShiftTab containment, Escape and exact trigger return; pending wrappers reject synchronous duplicate submission and dismissal. Original mutation/read functions are byte-identical.
4. A current denied list refresh retained previous Organisation rows/count/create controls. Both actual-source VM and 320px DOM reproduced it. Snapshot identity now includes current Person/view/id/page/search/filter, and reads retire previous facts and use latest-request/lifetime guards. Failed reads retire cached modal state; Retry recovers from a fresh read. Mutation completion respects current context and rejects duplicate pending submissions. Original payloads, API calls, query semantics, exact readback conditions and accepted page compositions are preserved mechanically.

The initial isolated crm-client copy carried older presentation; existing tests caught two regressions before freeze. Only guard spans were transplanted onto exact pinned 8e6c44c9 integration source. That rejected intermediate is retained diagnostically and is excluded from import. A shadowed guard name was also caught by TypeScript and corrected before the frozen receipt.

## Frozen source and local checks

External packet: `ui-milestone-evidence/operations-commercial-resumed-20261018/crm-commercial/crm-four-product-final/`. `source-manifest.json` pins exact before/after hashes and `review.patch` contains only the four approved files.

Fresh offline verification: 42 tests passed (28 existing commercial page/presentation, 8 dedicated source-state/action, 4 exact read/action/UI contracts and 2 modal contracts), zero failures/skips. Full archive TypeScript and focused TSX lint exit0. Commands and output hashes are recorded in `offline-checks.json`; logs are external `final-offline.log`, `final-types.log`, `final-lint.log`. No hosted-precondition suites run.

## Remaining gates

Final browser results: 108 main records and 32 supplemental records; 149 final images. Both matrices passed at 1440/834/390/320. There were zero page errors, external requests or current horizontal overflow. Four dialog types at each width passed initial focus, repeated Tab/ShiftTab, Escape, exact trigger return and held double-submit/dismissal checks. Denied refresh retired stale rows/count/create controls and Retry recovered at each width. There are 69 runtime-file hash checks and 57 authoritative-source comparisons, with zero mismatches. The 42 offline checks, fresh types and lint remain green. `browser-evidence.json` pins the final images and `runtime-parity.json` records the source comparisons. The quartet `checkpoint-crm-final` is ready for coordinator delivery; prior Handoff screenshots remain immutable.

A portable eight-test actual-source regression and its synthetic DOM helper are supplied under the external packet `tests/` for coordinator import. Source contract checks and original red evidence remain external; no existing integration assertions were changed by this worker. Root owns integration/full candidate checks and publication. Real session, RPC permission, persistence and company-data acceptance require authorised hosted fixtures and remain separate.
