# TASK-10B — Event worked-time implementation report

**Status: accepted by David in synthetic Dev on 24 September 2026.** Implemented only the approved Event slice. Staging, production and real KSS data were not used.

## Delivered boundary

`event_staff_allocations.id` is the immutable source identity. Staff enter every WORK and BREAK interval explicitly; attendance facts are pinned as evidence and never generate worked intervals. Missing, incomplete or inconsistent evidence does not prevent submission and is shown as a reviewer warning. Return/correction creates a new revision. Manager authority requires an exact Event-scoped capability, review and approval are separate, and the submitter cannot approve their own revision. A later attendance or allocation change preserves the submitted snapshot and flags it for review. A later source change cannot reopen a previously approved revision through this slice.

Included: Staff draft, save, submit, scoped reviewer queue/detail, reasoned return, correction as a new revision, worked-time approval, and immutable history. Excluded: payable or chargeable approval, static Site-shift timesheets, rates, money, payroll, invoices, VAT, accounting, expenses, notifications, integrations, staging, production and real data.

## Migration and database evidence

The accepted 09A and active 09B source adapter were reviewed before adding 10B evidence FKs. The 09B migration was applied first and retained the Event composite keys needed to bind evidence to the same attendance case, Event allocation and Person after its Event/SITE_SHIFT XOR change. 09B-owned files were not edited.

Applied to synthetic Dev project `dnfhkmmnlbiabqypclqg` only:

| Recorded version | Recorded name | Purpose |
| --- | --- | --- |
| `20260924172914` | `event_work_time_10b` | Event work-time cases, immutable revisions/segments/evidence/history, Event grants and guarded RPCs |
| `20260924173434` | `guard_approved_work_time_reopen_10b` | Prevent reopening approved history after a later source-change flag |
| `20260924173727` | `fix_work_time_manager_action_ambiguity_10b` | Qualify revision columns in manager actions and enforce the approved-history guard |

The first migration file is [20260924210000_event_work_time_10b.sql](../../supabase/migrations/20260924210000_event_work_time_10b.sql). Forward corrections are [20260924211000_guard_approved_work_time_reopen_10b.sql](../../supabase/migrations/20260924211000_guard_approved_work_time_reopen_10b.sql) and [20260924212000_fix_work_time_manager_action_ambiguity_10b.sql](../../supabase/migrations/20260924212000_fix_work_time_manager_action_ambiguity_10b.sql). The Supabase migration ledger uses server-generated timestamps that differ from local migration filenames; the recorded names and versions above are the remote readback.

Database readback confirmed eight `event_work_time_*` tables have RLS enabled. Authenticated and `service_role` have no direct table SELECT/INSERT privileges. The seven public work-time RPCs are `SECURITY DEFINER`, use an empty fixed `search_path`, allow execution to authenticated, and deny execution to `service_role`. The approved-history reopen trigger is present. 09B's XOR-compatible attendance FKs remain in use.

## Verification actually run

- Final isolated source snapshot Webpack production build: **passed**, including Next.js TypeScript checking, route generation and static pages. The final regression run used `/private/tmp/task10b-clean-regression`; its `.next` output was built inside that isolated snapshot and was not shared with the checkout.
- Duplicate `.next/dev/types/cache-life.d 2.ts`, `cache-life.d 3.ts`, `routes.d 2.ts`, and `routes.d 3.ts` declarations: **absent** on the final readback after regeneration.
- `npm run smoke`: **passed** (1/1) against the final fresh isolated production build.
- `npm run lint`: **passed**, with two pre-existing unused-variable warnings in `tests/onboarding-queue.test.mjs` and `tests/site-horizon-maintenance.test.mjs`.
- Full serial `npm run test:regression` in the clean isolated snapshot with local PDF fixtures and its own freshly generated `.next`: **passed, 53 tests; 53 passed, 0 failed, 0 cancelled**. The first attempt from a snapshot without a production build was discarded: its route tests could not start `next start` and returned `ECONNREFUSED`. After generating `.next` only inside the isolated snapshot, the complete suite ran successfully, including authenticated routes, smoke, 03C/03D, 08B, TASK-13A, TASK-14A, TASK-09A/09B and focused TASK-10B.
- TASK-13A regression correction: `tests/control-room.test.mjs` now follows the accepted 50-row bound using offset pages, checks the page count stays stable, and aggregates all rows before comparing full-window source counts. The API's safety bound and implementation were not changed. The corrected TASK-13A test passed independently and in the serial suite.
- TASK-14A regression: the allocated-path proof passed independently and in the serial suite. It created an allocation for Staff A, revoked the contributor grant, then successfully read and submitted through the exact allocation. No 14A test, access policy, migration or application behavior was changed. The earlier candidate-block reproduction did not recur in the properly built clean run, so no broader access or fixture bypass was introduced.
- Required local PDF fixtures (`kss-development-terms-v1.pdf`, `kss-development-terms-v2.pdf`, and `synthetic-identity-evidence.pdf`) were present in the isolated snapshot; 03C and 03D both passed in the full serial run.
- Authenticated browser proof completed against synthetic Dev. Staff desktop and 390px showed the exact Event allocation, factual attendance evidence with blank initial worked intervals, explicit WORK and BREAK input, a 50-minute proposal, saved draft and submission. Operations saw the pinned attendance revisions and intervals, returned revision 2 with a reason, and approved the corrected resubmission. Staff correction created revision 3 as a new draft and a new submitted revision; prior revisions remained visible. The self-approval case was tested using an explicit Event-scoped approve grant for the Staff submitter; the UI disabled approval, and the database self-approval denial also passed in `tests/work-time.test.mjs`.
- Browser layout checks at 390px and 1440px: document/body scroll widths matched viewport width, no overflowing elements were found, the new views had no green computed styles, and no pay-rate, payable, chargeable, payroll, invoice or currency content appeared. Manager desktop screenshot was captured; the 390px manager screenshot capture timed out, but the 390px DOM/layout checks completed. Staff desktop/mobile and manager desktop screenshots are under `output/playwright/task-10b/`.
- After visual proof, only the synthetic browser Event/allocation was cancelled and its temporary Event capability grants revoked. A temporary exact Event review grant was then revoked after history readback. The four revisions (50 minutes each) and all return, approval and source-review events remained; the source cancellation left the case `REVIEW_REQUIRED`, with stored minutes unchanged.
- Root `.next` was regenerated once while a command was mistakenly run from the shared repository root during isolation setup; that build completed successfully. Subsequent build, smoke and serial tests ran in the independent copy. Final readback found no duplicate declarations and no listeners on the previously noted local ports 3000/3105.
- `git diff --check`: **passed** for TASK-10B-owned source and report changes.
- No rates, money, payable/chargeable decisions, static shifts, payroll or invoicing were introduced.

## Known gaps and acceptance gate

David accepted TASK-10B in synthetic Dev on 24 September 2026. The manager 390px screenshot did not save because capture timed out; authenticated 390px DOM/layout verification passed with no horizontal overflow or green styling. This is a documentation gap and does not reopen the accepted scope. Staff desktop/390px and manager return/approval journeys were exercised, immutable revision/source-review readback completed, and the full serial regression, build and smoke checks passed.

No payable/chargeable decision rows, rate/money, payroll or invoice data were implemented. TASK-10B is closed at the accepted Event worked-time foundation. Static Site Shift Worked Time and payable/chargeable minute decisions require separate approvals; this acceptance authorises neither. The proposed 10C/10D labels need reconciliation with `docs/delivery/phase-map.json`, which already assigns those identifiers to other roadmap tasks. Concurrent task changes remain outside the TASK-10B-owned commit.
