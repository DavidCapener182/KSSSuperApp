# TASK-10B — Event worked-time implementation report

**Status: implementation evidence recorded; awaiting David's acceptance.** Implemented only the approved synthetic-Dev Event slice. Staging, production and real KSS data were not used.

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

- Focused serial TASK-10B synthetic-Dev integration test: **passed** (`tests/work-time.test.mjs`). It exercised exact allocation binding, no attendance-derived intervals, explicit breaks, idempotent draft/submit, pinned attendance event and case revision, missing-evidence submission, review/approval capability separation, return/new correction revision, immutable old values, self-approval denial, grant revocation, attendance correction and allocation cancellation review flagging, and approved-history reopening denial.
- Accepted TASK-09A Event attendance regression in the serial suite: **passed**.
- `npm run lint`: **passed**, with two existing unused-variable warnings in `tests/onboarding-queue.test.mjs` and `tests/site-horizon-maintenance.test.mjs`.
- Scoped source TypeScript check excluding generated `.next` declarations: **passed** (`npx tsc --noEmit --pretty false --project /private/tmp/task10b-tsconfig.json`).
- `npm run build`: Webpack compilation **passed**. Build type-check **failed** on duplicate generated `.next/dev/types/cache-life.d 2.ts`, `cache-life.d 3.ts`, `routes.d 2.ts`, and `routes.d 3.ts` declarations. No TASK-10B source type errors appeared in the scoped check.
- `npm run smoke`: **failed** because the Next.js process exited after the build type-check failure.
- Full serial `tests/*.test.mjs` regression: run for 10 minutes then stopped after harness failures/timeouts. The accepted 09A test and 10B focused test passed independently; several other integration tests could not connect to ephemeral `127.0.0.1` ports, 03C timed out at 300 seconds, and subsequent tests were cancelled when stopping the run. This is not a passing full regression.
- `git diff --check`: **passed** for the worktree and the reviewed shared auth/navigation files.
- No-green scan of the new worked-time styles: **passed**; blue, graphite, neutral and warning/error colors only.
- Authenticated browser journeys and 390px desktop/mobile visual checks: **not completed**. The smoke app could not start with the current generated-type build error.

## Known gaps and acceptance gate

The implementation is not ready to claim full regression or browser acceptance until the duplicate generated Next.js type declarations are resolved safely and the authenticated Staff/manager browser journeys are captured at desktop and 390px. The whole serial suite also needs to run in its intended environment where the required ephemeral Supabase endpoints are available. No claim of deployment, staging, human acceptance or production readiness is made.

No payable/chargeable decision rows, rate/money, payroll or invoice data were implemented. Stop for David's acceptance before any next slice. Concurrent task changes remain outside the TASK-10B-owned commit.
