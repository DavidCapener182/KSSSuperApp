# TASK-08D report — Static horizon maintenance

**Status:** **ACCEPTED — SYNTHETIC DEV** by David on 24 September 2026. No staging, production, or real data was used. This report records the accepted implementation evidence and limitations.

## Plan and scheduler cost

The target is the existing synthetic Dev project `dnfhkmmnlbiabqypclqg`, in EU West, on the existing Pro organisation and Postgres 17.6.1. Supabase Cron uses the `pg_cron` Postgres extension; it is not a separate paid service or add-on. No project, compute tier, or paid integration was added. The normal existing project compute/usage charges still apply.

Live readback after the Dev migrations showed `pg_cron` 1.6.4 in `pg_catalog`, `cron.timezone = GMT`, and one active job:

| Job | Schedule | Command | State |
|---|---|---|---|
| `kss-site-shift-horizon-08d` | `17 3 * * *` (03:17 UTC daily) | `select private.site_shift_maintenance_run_08d();` | Active |

To capture a real pg_cron execution without waiting for the next daily window, the same job was temporarily set to every minute in synthetic Dev. It ran at **14:17:00.131 UTC on 24 September 2026**, completed in under one second, and `cron.job_run_details` returned `succeeded` / `1 row`. The authenticated scheduler ledger readback at the same timestamp showed `SUCCEEDED`, **23/23 Services**, zero failed Services, and the London window `2026-09-24` through exclusive `2026-11-19`. The job was restored to `17 3 * * *` immediately afterwards.

Disable/recovery proof: while the daily schedule was configured, `cron.alter_job(..., active => false)` was applied; readback returned the exact job with `active=false`. It was then re-enabled and read back as `active=true`, `schedule=17 3 * * *`. Final readback also confirmed `cron.timezone=GMT`. Four temporary Dev-only migration records accelerated, restored, disabled, and re-enabled the job; a fifth transient failure probe is described below. These operations changed no schedule beyond this verification and the final job is daily/active. No equivalent operation was performed outside Dev.

Final owned-path close-out readback after implementation commit `0d6117c61e38f49356018e43517a6a8a2637e8fe`: `kss-site-shift-horizon-08d` is `active=true`, schedule `17 3 * * *`, command `select private.site_shift_maintenance_run_08d();`, and `cron.timezone=GMT` (`pg_cron` 1.6.4). The deployed runner definition was read back and contains no temporary failure-injection branch. No every-minute schedule remains. This final report/readback update is committed separately from unrelated workspace changes.

## Delivered changes

- Added `20260924135623_task_08d_static_horizon_maintenance.sql`: installs `pg_cron`, creates scheduler-specific run and per-Service outcome ledgers, adds SYSTEM maintenance provenance, applies the approved PAUSED/ENDED generator correction, adds the private bounded runner and read-only status RPC, and schedules the daily job.
- Added `20260924135852_task_08d_bounded_manual_rerun.sql`: adds an authenticated Super Admin current-window rerun with no caller-supplied date range and explicit requester attribution.
- Added `20260924143623_task_08d_health_status.sql`: adds a narrow read-only Admin health projection with current London window, last run, last full success, and the 36-hour overdue flag.
- PAUSED and ENDED no longer trigger automatic cancellation of dated demand. Pause dates suppress creation within their effective interval; ENDED Services suppress creation on and after the exclusive end date. Existing rows and allocations remain for explicit manager reconciliation.
- Maintenance is bounded by the configured horizon (currently eight weeks) from the Europe/London current date. A global advisory lock protects runs; existing per-Service locks remain. Each Service has its own exception boundary and result row, so its failure does not roll back successful Services.
- SYSTEM demand/history changes point to a maintenance run and display as system maintenance; they do not impersonate a Person. Read paths, including Workforce, remain read-only.
- Added `tests/site-horizon-maintenance.test.mjs` and adjusted the 08A regression to scan the full current generated horizon, avoid replacing existing availability declarations, clean up its own declarations through the guarded RPC, and test autumn ambiguous-time rejection.

## Verification completed

The final serial integration, London DST, Workforce, and availability command completed successfully on 24 September 2026:

```text
node --env-file=.env.local --env-file=.env.test.local --test --test-concurrency=1 tests/site-shifts.test.mjs tests/site-horizon-maintenance.test.mjs tests/availability-time.test.mjs tests/workforce.test.mjs tests/workforce-week.test.mjs tests/availability.test.mjs
✔ London all-day ranges preserve 23/25-hour DST days and inclusive date selection
✔ custom London times reject missing/ambiguous local clocks and support overnight ranges
✔ rest of today starts at the current instant and ends at next London midnight
✔ 08D current-window reruns are scoped, recorded and safe under concurrency
✔ 08A stable Site shift demand, strict capacity and shared Event clash
✔ 07B authorised week, gaps, explicit conflicts and own schedule
tests 8; pass 8; fail 0
```

The 08A regression verified stable demand IDs and preservation of PLANNED dated rows through pause, resume, and end; it also exercised template version reconciliation, allocation/capacity rules, availability checks, and cross-source Event/static conflict protection. Its fixture scans the full generated horizon and cleans only the exact availability declarations it creates. The Site shift generator rejects an ambiguous 01:30 London clock on 25 October 2026; failed activation leaves the synthetic Service in DRAFT with zero demand. London DST helper regressions passed spring 23-hour, autumn 25-hour, nonexistent-time, and ambiguous-time cases. The 08D integration verified concurrent bounded manual reruns, role denial, direct private ledger denial, idempotent reruns, and that Workforce reads do not add maintenance history. The Admin health RPC returned the current eight-week London window, `last_run_state=SUCCEEDED`, `overdue=false`, and `overdue_after_hours=36`; Operations was denied. Scheduler job, extension version, schema, timezone, disabled/active states, and exact job definition were read back.

## Accepted limitations

- **Failure isolation and recovery accepted:** a transient synthetic Dev fault probe failed one Service. The ledger recorded `PARTIAL_FAILURE`, one `DATABASE_ERROR`, and 27 successful Services. The runner definition was immediately restored, and a bounded rerun succeeded for the failed Service. No business-row corruption or permanent test hook remains; the run ledger evidence is retained.
- **DST limitation accepted:** spring generator behavior was not tested end-to-end because it lies outside the current eight-week horizon. The London DST helper and guarded autumn generator test are sufficient for this slice. No dates were manufactured to extend coverage.
- **Security limitation accepted:** no separate exhaustive role-matrix suite was run for every new RPC/table. Focused tests covered role denial, private-ledger denial, and read-side behavior; this limitation is not a blocker.
- **UI limitation accepted:** no manager/browser overdue-state walkthrough was completed. That check, along with the 08A desktop/390px walkthrough, remains on the broader hands-on walkthrough list and does not block scheduler acceptance.
- **Ownership:** David/KSS Admin is the operational owner for synthetic Dev only. Production ownership remains unset by design.

## Stop point

Changes and migrations are limited to synthetic Dev. No staging/production action or real data was used. David's acceptance is recorded above. Do not infer production ownership or enable the job outside this Dev project. Stop this implementation lane here.
