# TASK-08A delivery report — synthetic Dev

Date: 24 September 2026. Scope: approved Static Guarding / Site Shift Demand at the accepted TASK-07B / E-01 baseline. This report records development evidence, not human acceptance or production readiness.

## Acceptance decision — 24 September 2026

David accepted TASK-08A at delivered commit `40277b7`: the Static Guarding / Site Shift Demand foundation is complete in synthetic Dev. Acceptance does not imply production or staging approval. Two follow-ups remain: an authenticated Office, Operations and Staff UI walkthrough at desktop and 390px when the Mac is available; and a later design for safe scheduled maintenance of the configurable materialisation horizon. Workforce reads must remain read-only. Neither follow-up reopens the accepted 08A architecture.

## Delivered

- Kept CRM Organisation as Client and the existing Site identity. Added Site Service as the ongoing operational identity; versioned weekly template lines; effective-dated pause periods; stable, materialised dated demand with typed revisions; and a dedicated static allocation table. An eight-week horizon is a configurable Dev default, with bounded explicit generation and a Workforce coverage indicator.
- Office/Super own Service and recurring template actions. Operations can manage bounded dated exceptions and staffing using safe projections. Staff can accept or decline only their own static allocations. All new tables have RLS enabled and no direct authenticated table write grants; guarded RPCs enforce record and action scope.
- Event and static allocation writers call the same private Person overlap and availability authority while holding the same Person row lock. Static capacity is checked under its dated-demand lock. Event allocation semantics and existing identities are preserved. Cross-source availability preview, change acknowledgement, candidate and conflict indicators use the same duty set.
- Workforce, My Schedule and My Deployments compose Event and ongoing Site shift rows with explicit source identities. Site and Service pages expose safe operational planning actions and typed history. These views do not infer attendance, approved hours, pay, charge or compliance.
- No real client records, attendance, payroll, charging, patrol execution, external messages or staging changes were made.

## Dev migration and proof

The dedicated Dev project was verified as `dnfhkmmnlbiabqypclqg` before applying the 08A source-controlled migrations `20260924150000` through `20260924153400` (with forward correction files where an early Dev test found trigger field/PLPGSQL ambiguity). The protected staging project was not targeted.

The synthetic proof is **Synthetic Logistics Ltd → Synthetic Distribution Centre → 24/7 Security Service**. For the week of 9 November 2026 it yielded 14 dated shifts: seven 06:00–18:00 day demands of one and seven 18:00–06:00 overnight demands of two. The overnight end is on the following date. A separate synthetic Event appeared in the same Workforce week. Readback showed 15 combined rows, 23 required positions, two allocated and accepted positions, one explicit availability conflict and remaining gaps. A dated exception, own Staff schedule/deployment and typed `RECONCILED` history were read back. The historical night-template version changes quantity from one through 31 October to two from 1 November without replacing dated IDs. The proof script is `scripts/seed-08a-proof.mjs` and verifies the Dev URL before writing.

The focused `tests/site-shifts.test.mjs` integration test passed against Dev. It exercised stable demand IDs and idempotent generation; template reconciliation of an unallocated row with revision/history; effective pause and resume; overnight and equal-boundary duties; strict capacity; Staff self isolation; Operations template and private-table denial; safe Workforce/person/schedule projections; availability hard block and acknowledgement; and a simultaneous Event/static allocation race for the same Person and overlapping interval. Exactly one race allocation committed. The test cancels its successful allocations at completion. An earlier failed run left six synthetic active allocations; each was cancelled through the guarded RPC and active Event/static allocation counts for those exact fixtures were read back as zero.

`npx tsc --noEmit`, owned-file ESLint and `git diff --check` passed. The 08A security/architecture review concentrated on the shared Person lock, Service/template authority and Operations privacy; its findings were incorporated into the migrations and negative checks.

## Limits and follow-up review points

- The generator is bounded and explicit; a manager can reconcile a selected week. Workforce reports missing horizon coverage rather than presenting an incomplete week as complete. A proposed read-side Workforce auto-materialisation was rejected by automatic approval review because a read would mutate every Service. No such migration was applied. An approved maintenance trigger or scheduler is needed before describing the eight-week horizon as automatically rolling.
- The Mac was locked during verification, so authenticated desktop and 390px browser walkthrough/readback could not be completed. The local checks above do not establish visual or human acceptance.
- No production or staging migration was run. The delivered SQL and synthetic Dev state require review before any later environment promotion.

## Source ownership

This commit contains only TASK-08A paths. Parallel TASK-08B Action Centre and TASK-09A Event attendance work in the shared checkout remains separate. Stop after this report for David's review before another feature.

## Dated migration-version clarification — 25 September 2026

The `20260924150000`–`20260924153400` range above identifies the original local filenames used when this report was written. It is not the actual synthetic Development migration-ledger version range. The contemporaneous [protected staging alignment ledger](STAGING-SYNC-RELEASE.md) records the local-to-Development mappings, including original `20260924150000_site_shift_foundation_08a.sql` → Development `20260924115024`, `20260924153000_site_shift_schedule_08a.sql` → `20260924115956`, and `20260924153400_workforce_horizon_indicator_08a.sql` → `20260924121209`. The frozen Integrated Baseline v1 source uses ten canonical 08A filenames with those actual Development versions, from `20260924115024_site_shift_foundation_08a.sql` through `20260924121209_workforce_horizon_indicator_08a.sql`. INT-04 matched all ten by exact version and descriptive name against a fresh read-only Development ledger. This clarification does not alter the applied SQL, migration history, or the original verification result.
