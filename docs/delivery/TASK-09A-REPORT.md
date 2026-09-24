# TASK-09A delivery report — synthetic Dev

Date: 24 September 2026. Scope: Event allocation attendance only. This report records synthetic development evidence, not human acceptance or production readiness.

## Delivered

- Added immutable, attributed attendance cases and facts bound to the exact `event_staff_allocations.id` and `person_id`. The factual set is `CHECK_IN`, `CHECK_OUT`, `NO_SHOW_RECORDED`, `EXCUSED_ABSENCE_RECORDED`, `CHECK_IN_NOT_POSSIBLE`, `REVIEW_REQUIRED` and `CORRECTION`.
- Staff self actions require an active Staff identity, the exact allocation Person and `ACCEPTED` status. No allocation is accepted during check-in. Database functions serialize each case, bind actor identity from the Auth session, reject stale revisions and support idempotent replay.
- A recorded no-show is preserved. A manager must append an attributable resolution before a late observed check-in is included in the current projection. Event allocation cancellation preserves attendance and appends `REVIEW_REQUIRED`.
- Office, Operations and Super Admin use existing active operational roles for Event attendance. No named supervisor permission or impersonation path was added.
- Planned and actual times remain separate. Persisted values are timestamptz instants with database `recorded_at`; display uses Europe/London. A 60-second maximum future client-time tolerance is an input-integrity guard only.
- Added online Staff and Event operational views. Staff read is own-person scoped; operational output contains only the relevant Event allocation, schedule, site/report point, Person name and attendance facts. No hours, pay, charge, location, SIA, onboarding, profile or CRM details are derived or included.
- Staff history omits free-text operational reason notes; manager views retain attributable reasons for exception/correction review.
- Attendance notifications are not emitted. Static Site shift attendance remains disabled; no static schema was guessed or altered. The 08A report and migrations were inspected: `site_shift_allocations.id` is the exact identity, it binds immutable `demand_id` and `person_id`, and 08A uses the shared `people` row lock plus `private.person_allocation_overlap_08a` across Event and static allocations. This Event-first slice does not yet add the static adapter.

## Database and access readback

Applied `20260924170000_event_attendance_09a.sql` to synthetic Dev project `dnfhkmmnlbiabqypclqg`; no protected staging project was targeted. Migration readback reported version `20260924121758`.

Readback verified both attendance tables have RLS enabled, with no authenticated `SELECT` or `INSERT` table privilege. The six public RPCs are `SECURITY DEFINER`, use an empty `search_path`, have `EXECUTE` granted to `authenticated`, and denied to `anon`. The Supabase security advisor reported its general `RLS Enabled No Policy` informational lint for these two tables because there is intentionally no direct table access; authenticated access is through the guarded RPCs. Other project-wide advisor findings were pre-existing/shared and are not changed by this task.

The migration includes exact composite case/event/person binding, immutable event triggers, fixed actor binding, manager-only correction RPCs and a cancellation trigger. Static adapter remains off pending a separately implemented explicit FK path.

## Verification

- Passed: full `npm run lint`.
- Passed: full `npx tsc --noEmit --pretty false` after the production build generated `.next/types`. Running the build and typecheck simultaneously caused a transient missing generated-types race; serial rerun passed.
- Passed: `npm run build` (Next.js 16.3.6, Webpack), including `/my-attendance`, `/events/[id]/attendance` and the attendance API routes.
- Passed: `npm run smoke` with local loopback access; the default sandbox denied its temporary `127.0.0.1` listener with `EPERM`, then the same test passed when run with the narrowly scoped local-loopback permission.
- Passed: targeted `tests/shell.test.mjs` return-target test after adding the two implemented attendance routes to the allow-list.
- Passed: `git diff --check` for current changes.
- Passed: no-green review of the Staff and operational attendance views/styles; the design uses blue, graphite and neutral colours, with no green tokens or color values.
- Passed: bounded secret-pattern scan across the TASK-09A source, migrations, docs and tests; no credentials or secret values were introduced. No standalone `gitleaks` or `trufflehog` binary is installed in this environment.
- Passed: `tests/attendance.test.mjs` against synthetic Dev, including `ALLOCATED` denial, accepted self check-in/out, retry idempotency, direct table denial, cross-person denial, no-show preservation and resolution, concurrent Staff/manager check-in (one fact only), cancellation review, future client timestamp rejection, stale correction denial, and correction cross-allocation denial. The test cancels its own remaining allocations on success.
- Passed: clean dependency install (`npm ci --ignore-scripts --no-audit --no-fund`); no dependency manifest changes were required.
- Regression run against synthetic Dev: TASK-09A attendance and 06C deployment passed; the 07B workforce-week DST helper passed. 07A availability failed with `Availability replacement confirmation required`, and the 07B workforce integration failed with `Candidate blocked`. These suites touch separate feature areas; no 07A/07B files were changed. The prior regression run also showed an availability interval-count mismatch, so the 07A failure is unresolved and its exact error varied with fixture state.
- Not verified: authenticated Staff 390px browser flow and Office/Operations operational browser walkthrough. Playwright reports its managed Chrome profile is already in use by another app task; its CLI session also hung during snapshot/tab operations. No authenticated browser flow is claimed.
- Passed: bounded secret-pattern scan across TASK-09A source, migrations, docs and tests; no credentials or secret values were introduced. No standalone `gitleaks` or `trufflehog` binary is installed in this environment.
- Passed: no-green review of attendance views/styles; the design uses blue, graphite and neutral colours only.
- Passed: Dev readback after the forward idempotency migration confirmed the latest migration, both RLS-enabled tables without authenticated direct `SELECT`/`INSERT`, and six public attendance RPCs with empty `search_path`, authenticated execute and anon denial.

## Boundaries and follow-up

- This delivery enables Event allocation attendance only. Static attendance is not enabled; after accepted 08A, its exact allocation identity and shared cross-source guard have been inspected as inputs for a later explicit static adapter.
- No offline, GPS, QR, NFC, biometric, device-trust or background tracking implementation.
- No timekeeping, timesheet, worked/payable/chargeable hour, break deduction, payroll, invoicing or attendance notification implementation.
- Stop after the separate TASK-09A commit for David's review. The browser walkthrough is an evidence gap, and the unrelated 07A/07B regression failures remain unresolved.
