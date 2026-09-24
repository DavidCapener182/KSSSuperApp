# TASK-08D proposal — Static horizon maintenance

**Status:** Approved for synthetic Dev implementation on 24 September 2026, subject to its written gates. Implementation is limited to accepted 08A static demand horizon maintenance. Workforce, availability, and all other read paths remain read-only. See `TASK-08D-REPORT.md` for actual Dev evidence.

**Decision update (24 September 2026):** David approved the database-local `pg_cron` approach for synthetic Dev after confirmation that Cron has no separate fee on the existing plan and `pg_cron` is supported by this Postgres project. The synthetic Dev operational owner is David/KSS Admin. Production ownership remains a pre-live decision. This update supersedes the earlier proposal text below that described cost, plan eligibility, or synthetic operational ownership as unverified. Implementation evidence and outstanding acceptance checks are recorded in `TASK-08D-REPORT.md`.

## Purpose and boundary

Keep the configurable, bounded forward demand window materialised for active Site Services by invoking the delivered 08A generator as scheduled maintenance. The Dev default remains eight weeks; `site_shift_settings.horizon_weeks` remains the configurable control, currently constrained to 1–26. Maintenance creates or reconciles only dates in `[Europe/London today, today + horizon_weeks)`. It does not generate an unbounded future, attendance, finance, or other workforce records.

This is an implementation proposal only. TASK-08A is accepted in synthetic Dev; its desktop/390px UI walkthrough and human review remain outstanding. Do not run this process in staging or production under this proposal.

## Delivered contract and material issue to resolve

The source-controlled 08A contract is in `site_shift_settings`, `site_services`, `site_service_pauses`, `site_shift_template_versions`, `site_shift_demands`, and `site_shift_demand_events` (migrations `20260924150000`–`20260924153400`). `private.site_shift_generate_08a(service, from, until, actor, reason)` locks one Service, bounds the range to `horizon_weeks`, resolves Europe/London report dates and DST-safe UTC instants, and inserts or types changes on stable occurrence IDs. A unique `(template_line_id, service_date)` occurrence key and the Service row lock provide per-Service serialization. Published template versions are immutable; the manager publication path invokes bounded generation. Active `ALLOCATED`/`ACCEPTED` rows block automatic reconciliation where a demand would change or be cancelled. Workforce's `workforce_week_08a` is `STABLE` and only reports `static_horizon_covered`; it does not generate demand.

David resolved the mismatch on 24 September 2026: `PAUSED` and `ENDED` never automatically cancel already-materialised demand; those rows stay visible for explicit manager action. Pause dates suppress creation inside the effective pause. An ended Service suppresses creation on and after its exclusive effective end date. Existing Staff allocations are never moved or cancelled by maintenance. The forward migration changes generator cleanup so it only cancels an unallocated future occurrence when its template line/version no longer produces that service date. This is the narrow correction approved; it does not change allocation semantics.

## Scheduler options and recommendation

I inspected the current Dev Supabase project (`dnfhkmmnlbiabqypclqg`, active, EU West) and repository configuration. The project is on the existing Pro organization, Postgres 17.6.1, and did not have `pg_cron` installed before this task. No `vercel.json` or other Vercel cron config exists in this checkout. Project delivery notes say the separate staging Vercel project is protected and the existing KSS app has no successful deployment. No application scheduler or task worker is configured. Supabase pricing and Cron documentation show no separate Cron fee or paid add-on: `pg_cron` is enabled inside the existing database. The bounded daily job creates no project or compute tier. Normal project compute remains subject to the existing plan and any later operator-approved scaling.

| Option | Fit for this task | Decision |
| --- | --- | --- |
| Application/Next.js scheduler | No confirmed always-on KSS deployment or durable worker in the current project. An app route would need an external caller, secret, retries, and protection from duplicate delivery. | Do not select without a confirmed hosting/worker target and owner. |
| Supabase Cron (`pg_cron`) calling a narrow database maintenance function | Runs beside the source data and generator, can use Postgres transactions/locks, and exposes scheduler run records. The Dev project is on Postgres 17. `pg_cron` is supported and is included without a separate Cron fee on the existing plan. | **Approved and implemented in synthetic Dev.** Use SQL/database functions only; no HTTP secret or service-role token. |
| Vercel Cron → authenticated endpoint → Supabase | Vercel's documented trigger is an HTTP GET to a deployed project's production URL; it requires a configured deployment, protected endpoint, and cross-system retry/idempotency. The KSS deployment target is not confirmed. | Not recommended for this bounded DB-only maintenance. Reconsider only if a real app deployment and operational owner are selected. |

Supabase documents Cron as `pg_cron`, with jobs and run details in Postgres and Dashboard monitoring, and recommends keeping jobs under ten minutes and concurrency at eight or fewer. Vercel documents HTTP GET triggers against a deployment URL and endpoint protection using `CRON_SECRET`. These docs describe product capabilities; the project-specific plan, cost, support and approval checks are recorded above and in `TASK-08D-REPORT.md`. [Supabase Cron](https://supabase.com/docs/guides/cron), [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs), [Vercel Cron management and secrets](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Proposed trigger and processing guard

Install one `pg_cron` job in the dedicated Dev Supabase database at **03:17 UTC daily**. `pg_cron` uses GMT/UTC by default; verify the actual setting after extension install. The database computes the date with the existing `private.uk_today()` Europe/London helper. The run target is half-open `[uk_today, uk_today + horizon_weeks)`. The date, not elapsed 24-hour intervals, controls generation, so spring/autumn clock changes neither omit nor duplicate a London service date.

The scheduled entry calls a private `site_shift_maintenance_run_08d()` function, not a public API, Next.js route, Edge Function, or read RPC. It enumerates `ACTIVE` and `PAUSED` services, plus `ENDED` services whose exclusive effective end is still ahead, in stable UUID order. This materialises only pre-end dates for a future-dated end and never dates on or beyond that boundary. `DRAFT` and already-expired `ENDED` Services are excluded. The generator keeps its existing per-Service row lock and bounded date checks. A global transaction-scoped advisory lock prevents overlapping scheduled runs. A concurrent manager generation/template publish uses the same Service row lock and serializes; stale manager revisions continue to fail through existing optimistic checks.

One Service is one atomic attempt. A failed Service rolls back its demand changes, records a bounded error code and failed outcome in the scheduler-specific ledger, and does not stop later Services. Successful Services commit with typed demand history and per-Service changed counts. An admin-only manual rerun uses the same current window and records its requester; it cannot accept custom dates. The next daily run naturally catches up after a missed run by recomputing from the current London date. It does not backfill older dates or expand beyond the configured horizon. The ledger consists only of one run table and one per-Service outcome table, scoped to this maintenance process.

Do not retry policy/validation failures in a tight loop. Allow one scheduled attempt per day; leave failed rows visible for the next run and operator review. A separately authorised operator may issue a bounded rerun for the same current window after resolving the cause. Retries reuse an idempotency key for a logical run request and create an attempt history rather than overwriting prior failure. Lock contention is recorded distinctly from generator failure. A manager's successful generation may fill demand before maintenance runs; maintenance then reports zero changes for those already-current dates.

## Additive schema and actor history

The scheduler cannot impersonate a human `people.id`. Existing demand and demand-event rows require `updated_by_person_id` and `actor_person_id`; assigning an arbitrary Super Admin or service owner's Person ID would falsify the audit trail. Add narrowly scoped system provenance:

- `site_shift_maintenance_runs`: stable run ID, trigger (`SCHEDULED`/`MANUAL_RERUN`), logical London date/window, horizon value, start/end, overall state, counts, failure summary, and scheduler attempt identity. Enforce one global active run with a database lock; retain attempts immutably.
- `site_shift_maintenance_service_runs`: run and Service IDs, `PENDING`/`RUNNING`/`SUCCEEDED`/`FAILED`/`SKIPPED_LOCKED`, changed/generated/reconciled/cancelled counts, completion time, and a non-sensitive bounded error code. Unique `(run_id, service_id)`.
- Extend typed demand history with `actor_kind` (`PERSON`/`SYSTEM`) and nullable Person actor constrained so PERSON requires a Person FK and SYSTEM requires a maintenance-run FK. Add a nullable `maintenance_run_id` to the event and demand attribution. Add `updated_by_kind`/`updated_by_maintenance_run_id` to demand so a system change remains distinct from a manager update. Preserve current human actor fields for all existing rows and manager actions.

All new tables remain private to server/database authority with RLS enabled and no authenticated direct writes. The scheduler function has a fixed search path, is `SECURITY DEFINER` only if required by the existing private-schema pattern, has execute revoked from `PUBLIC`, `anon`, and `authenticated`, and derives its actor provenance from the current run row. The cron role gets only the execute permission necessary to invoke this function. No service-role key or personal record enters job arguments or logs. Error detail is bounded and redacted; never copy row payloads, staff names, or private data into scheduler logs.

## Template/lifecycle rules for maintenance

- Each occurrence remains bound to the exact published template version selected by its service date. A newly published version affects only dates in its effective interval. An existing unallocated future occurrence retains its demand ID and receives a typed `RECONCILED` revision under the 08A rule; an allocated or accepted row blocks that Service attempt and appears in the failure queue for a manager.
- A partial template version gap is surfaced as a service coverage shortfall. Do not infer a template or manufacture demand to fill a gap. A malformed duty or nonexistent/ambiguous London wall time fails that Service transaction and records the failed horizon segment.
- Effective pause dates, resume dates, and exclusive Service end dates are evaluated as Europe/London service dates. The 24 September approved pause/end rule above is authoritative: existing materialised dated demand remains for explicit manager reconciliation, while pause dates and the exclusive end date suppress new generation. Do not make decisions from UTC midnight or the scheduler's local timezone.
- Exceptions remain attached to their typed demand and history. Maintenance does not rewrite a manual override, cancel an allocated exception, reduce quantity below active allocations, or reinterpret a manager's dated exception. An exception conflict fails that Service and requires manager action.
- For any row with active allocations or future attendance facts, retain the existing explicit reconciliation barrier. This scheduler does not cancel, move, or reassign a Person or allocation.

## Failure visibility, ownership and costs

Provide a manager-readable maintenance status with last successful completion, current window end, configured weeks, Services succeeded/failed/skipped, and the exact dates/services with missing materialisation. Do not show private Person details. A stale success threshold of **36 hours** changes the Workforce/manager status to “horizon maintenance overdue”; Workforce demand queries still return only persisted rows and do not write or imply coverage. The existing coverage indicator remains truthful for the requested week.

For the synthetic Dev proof, the operational owner is **David/KSS Admin**. The owner checks the Supabase Cron run history and KSS maintenance ledger each working day, triages failures, and escalates allocation or policy blockers to the authorised manager. Daily scheduler completion with some failed Services is a **partial failure**, not success. An all-failed or no-success run for 36 hours is a visible alert/action item. No production operational owner or response route is inferred; production remains a pre-live decision. This task does not send email, SMS, Slack, or external notifications.

The DB-local job avoids a separate HTTP function and secret. Supabase plan and Cron cost were checked before migration; no Cron-specific fee, paid add-on, project, or compute scale-up was introduced. Normal project compute and usage charges remain subject to the existing plan.

## Safe rollback and recovery

Disable the exact named cron job first; verify it is inactive and that no run is executing. Keep maintenance ledger and typed `SYSTEM` events for evidence. Do not delete generated demand or reverse system changes wholesale. With the scheduler stopped, an authorised manager may use the existing bounded generation and explicit reconciliation paths to repair selected current dates. If an incorrect unallocated row was system-reconciled, use a new typed, reasoned reconciliation revision to restore the intended schedule. Allocated/accepted rows require per-allocation manager disposition; never reset allocation state or edit old event history. If `pg_cron` itself is disabled, its jobs may be removed by the platform as documented, so record the job definition and owner-controlled recovery steps outside the database. Schema rollback is forward-only: remove the scheduler invocation and retain provenance tables/history; do not drop audit evidence or roll back demand IDs.

## Dev-only verification plan

Use synthetic Services, templates, exceptions, and allocations in the dedicated Dev project. Verify:

1. A daily run fills exactly the current eight-week setting, creates stable demand IDs, preserves exact template version/date, produces typed SYSTEM attribution, and reports generated/reconciled/unchanged counts. Repeating the same logical request creates no duplicate occurrence or revision.
2. A changed horizon setting from eight to a smaller/larger permitted value changes only the bounded target window; no rows are generated before London today or beyond the configured exclusive end.
3. A missed run followed by catch-up fills the then-current window, without historical backfill or double rows. Test executions around both UK DST transition weekends and reject nonexistent/ambiguous local shift times according to the delivered DST helper.
4. Effective template boundary dates, pause/resume, and ended Service behavior follow the clarified contract. No `ALLOCATED` or `ACCEPTED` allocation, Staff response, or future attendance identity is moved, removed, or orphaned.
5. Run two maintenance invocations concurrently; run maintenance against concurrent manager template publication and manager selected-week generation; prove advisory/global lock and per-Service row lock behavior, no duplicate IDs/revisions, no deadlock, and correct optimistic conflict feedback.
6. Force one Service failure (synthetic invalid template or blocked active allocation), a transient database exception, lock contention, and a scheduler outage. Verify successful Services remain committed, failed Service work rolls back atomically, errors are visible/redacted, retry is idempotent, and operator rerun cannot widen dates.
7. Verify RLS/direct table denial; authenticated/anon users cannot call the private scheduler, alter ledger/history, or see another manager's hidden details. Workforce, Site Service display, availability, and Staff reads do not invoke writes. Verify system event actor provenance is distinct from manager actions.
8. Verify disabled job stops new runs; a new correct run and explicit manager reconciliation recover a failed Service without deleting history. Read back the exact job schedule, active state, cron run details, ledger, demand/history counts, and current horizon status.

Run the existing accepted 08A focused regression and relevant allocation/Workforce regressions serially with the project's existing session reuse. Record actual synthetic test evidence, migration/object readback, cron run history, security review, source diff, cost/plan confirmation, and named operational owner in `docs/delivery/TASK-08D-REPORT.md`. Do not claim staging, production, browser, or human acceptance from Dev tests.

## Acceptance criteria and approval boundary

TASK-08D Dev implementation is authorised. Before acceptance, the report must record:

- Pause/end rule applied as specified above.
- Supabase Pro plan and absence of a separate Cron fee verified; no add-on or scale-up introduced.
- Named operational owner and failure response route supplied.
- One daily 03:17 UTC bounded Dev job; no application read-side writes or unbounded generation.
- Global and per-Service concurrency guards, retry/idempotency, partial failure ledger, maintenance system actor, and manager-visible overdue/coverage state verified.
- Allocated/accepted demand and all historical identities/evidence stay intact; effective dates and London DST rules pass negative cases.
- Scheduler can be disabled and recovered without deleting demand or audit history.
- TASK-08D delivery report contains actual Dev evidence and records the outstanding 08A desktop/mobile walkthrough separately.

**Scope stop:** Synthetic Dev only. No staging, production, or real data. Stop after the 08D report and separate commit for David's acceptance.
