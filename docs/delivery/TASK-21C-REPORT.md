# TASK-21C delivery report — Staffing and Attendance source cards

**Date:** 24 September 2026
**Status:** ACCEPTED — SYNTHETIC DEV by David on 24 September 2026. Implementation commit `442570c`.

## David's formal acceptance

David accepted the read-only, exact Review Period projection of 08A current planned Staffing and 09B recorded Attendance. Required, Allocated, Accepted and Remaining remain separate. Recorded attendance may remain after an allocation is cancelled; it is not worked time. The projection exposes no Person names, notes, reasons, hours or private event detail and derives no readiness, compliance, performance or risk score. Reading the cards changes no Service Delivery, Site Service, demand, allocation or Attendance record.

The exact Service Delivery → Review Period → Site Service → historical Site Client Link authority chain and Office/Super reauthorisation on every read remain required. Operations and Security Staff remain denied. David accepted the evidence below, including the 08A fixture limitation, and directed this lane to stop after a separate acceptance commit.

## Approved boundary and implementation

After accepting TASK-21B, David explicitly approved the Staffing and Attendance first slice of TASK-21C. The Service Delivery detail now presents two factual source cards for an exact, selected Review Period. Staffing reports current required, allocated, accepted and remaining counts from 08A. Attendance reports recorded check-ins, check-outs, current exceptions, no-shows and review-required counts from 09B for the period's inclusive Europe/London service dates. The display distinguishes current planned Staffing from historical recorded Attendance, which can remain after an allocation is cancelled.

The new read-only RPC rechecks Office/Super authority and exact Service Delivery, Review Period, Site Service and historical Site Client Link membership. The API validates IDs and role; the UI fetches fresh data for the selected period. The projection contains aggregate counts, source IDs/state and an as-of timestamp, without names, notes, events, reasons or hours. No Service Delivery source copy or operational write was introduced. The cards carry no readiness score or worked-time, pay, billing or compliance conclusion.

## Synthetic Dev migration and readback

The literal Dev target `dnfhkmmnlbiabqypclqg` was rechecked immediately before migration. The protected Staging project `kwpgjbxepxuhwxxydaca` was not targeted. Source-controlled forward migration `20260924201521_task_21c_staffing_attendance_cards.sql` was applied to Dev, where migration history recorded version `20260924201755`, name `task_21c_staffing_attendance_cards`. No new tables or direct authenticated base-table grants were introduced.

## Verification actually obtained

- `tests/service-delivery-source-cards.test.mjs`: **1/1 passed**. An exact synthetic 09B Service Delivery and manually created November 2046 Review Period returned 4 required, 0 allocated, 0 accepted, 4 remaining, 3 check-ins, 1 checkout, 3 current exceptions/review-required and 0 no-shows. The test compared every count with the 08A and 09B source reads, verified source state before/after the card read, checked that person names/events/reasons were absent, and exercised Office/Super parity, Operations/Staff/wrong-period denial and direct attendance-table denial.
- `tests/service-delivery.test.mjs`: **2/2 passed**. `tests/shell.test.mjs`: **2/2 passed**, including the new source-card route denial.
- `tests/static-attendance.test.mjs`: **1/1 passed** on isolated rerun. Its earlier combined run hit a global pagination-count difference while the shared synthetic Dev fixture was changing.
- `tests/site-shifts.test.mjs`: **failed before its business assertion** in combined and isolated runs because no suitable unallocated synthetic Staff fixture was available for its selected date. David accepted this as a synthetic fixture limitation, not a TASK-21C functional failure. The 21C parity test independently reconciled the exact 08A read-model values used by these cards. No 08A allocation guard, production behaviour or fixture was changed to manufacture a pass. A future controlled regression-maintenance pass may isolate that fixture.
- `npm run build` passed with Webpack and TypeScript. Focused ESLint and `git diff --check` passed.
- Authenticated synthetic Office browser showed nonzero cards on desktop and at 390px. At 390px the document measured `scrollWidth = 390`, and source-card selection/link controls met the 44px minimum. Screenshots are in `output/playwright/task-21c/`. The new component/style scan found no green, emerald, lime or teal tokens.

## Limits and stop point

The browser journey verified source selection and readback, while the permission and source-parity cases were exercised through authenticated integration tests. The shared Dev fixture limitation above remains open for the full 08A regression. This is accepted synthetic Dev evidence only. Site Book, Assets, operational documents/SOPs, incidents, worked time, payable/chargeable time, contracts, SLAs, finance, KPIs, SLA/performance scoring, readiness/compliance scoring, notifications, exports, additional source cards, staging, production and real KSS records were not authorised or changed. This lane is closed. No successor starts automatically; David's limit of no more than two active implementation threads remains in force.
