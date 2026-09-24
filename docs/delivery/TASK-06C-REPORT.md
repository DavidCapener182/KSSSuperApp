# TASK-06C development completion — Deployment and Staff Allocation

**Status:** Implemented in KSS Enterprise Dev only, pending David's acceptance. Starting commit `507d239`. Staging, live data and production policy are unchanged.

## Delivered

- Exact `event_staffing_requirements.id` → `people.id` allocation with stable ID, current state, requirement revision at allocation, actor/time and immutable typed lifecycle events. Current requirement remains authoritative for Event, Client, Site, role, area and duty times.
- `ALLOCATED` and `ACCEPTED` consume strict capacity; `DECLINED` and `CANCELLED` release it. Required, allocated, remaining and accepted are derived at exact requirement and Event level. No readiness/attendance/payroll result is stored or displayed.
- Office, Operations and Super Admin use guarded exact-requirement candidate search, allocate and cancel operations. Safe candidate results contain display name, Person ID, role label and result/reason codes only. The Event Staffing Plan exposes current allocations and a candidate Sheet at desktop and 390px.
- Active Security Staff sees only their own My Deployments. Staff can accept or decline an `ALLOCATED` row; decline uses a controlled reason and releases capacity. Current allocations precede collapsed history. No confirmation Task was added.
- Non-SIA roles report unconfigured qualification and unknown availability, requiring a synthetic warning acknowledgement and short reason. The versioned SIA → `SECURITY_GUARDING` exact synthetic workflow check is **disabled by normal migration replay** and separately activated only in the approved Dev project by `supabase/dev_only/20260924091837_dev_only_enable_06c_sia.sql`. Its UI says “Synthetic staffing check satisfied”; it is not a live SIA policy.
- Requirement/Person row locking and action-time recomputation guard capacity and overlap. `[report_at, shift_ends_at)` permits equal boundaries and cross-midnight duties. Active allocations block context-changing requirement amendments, quantity reductions below active count and ordinary requirement cancellation. Event date changes with active allocations require reconciliation; Event cancellation atomically cancels active allocations with typed history. Event completion stops new allocation and Staff response.

## Database and security

Dev migrations applied in order:

1. `20260924091434_event_staff_allocations_06c.sql`: policy row disabled by default; allocation/current/history tables; guarded candidate, manager, self and reconciliation operations.
2. `20260924092031_deployment_event_summary_06c.sql`: one guarded factual Event/line count read.
3. `20260924093210_fix_allocation_history_guard_06c.sql`: forward trigger correction found by the first focused test; the failed insertion transaction created no allocation.
4. `20260924094820_my_deployments_current_first_06c.sql`: current Staff work ordered before retained history.

Only Dev project `dnfhkmmnlbiabqypclqg` received the separate synthetic SIA activation. Readback confirmed four public deployment RPCs in the queried set, one enabled version 1 Dev-only SIA rule, and new current/history tables with RLS enabled and **no authenticated SELECT/INSERT/UPDATE grants**. Direct table and typed-history writes failed in focused tests. The Supabase advisor's “RLS enabled no policy” notices for these RPC-only tables are intentional; no broader grants were introduced. Candidate API and browser text were checked for private Profile, SIA reference, document identifiers, filenames and evidence content. No private source rows are returned by the candidate RPC.

Bounded security review covered source-specific RPC grants, active-role and exact Event/requirement checks, Person/capacity lock order, candidate projection fields, Staff actor resolution, SIA private-source containment and immutable history. The first test found the allocation/history trigger dispatch defect; a forward migration fixed it. A direct-access readback and focused negative tests found no remaining 06C authority widening. This was a single-agent review under the repository's single-agent rule; no Astra or delegated model was used.

## Synthetic proof and checks

- Focused `tests/deployment.test.mjs` passed. It creates a separate synthetic Client/Site/football Event with Stand Manager 1, Stand Supervisor 1, Turnstile SIA 2 and Steward 18; checks warning-acknowledged Office/Operations allocation, exact version 1 synthetic SIA passing candidate and blocked candidate, Staff A acceptance, Staff B decline/capacity release, self/peer denial, manager cancellation, requirement reconciliation, Event cancellation, and two concurrent capacity/clash races (one success, one denial in each). The passing SIA allocation was cancelled after proof. No real eligibility conclusion is made.
- `npm ci --ignore-scripts --no-audit --no-fund`, lint, TypeScript and clean Webpack production build passed. Local HTTP smoke passed with loopback permission. Focused 06A Events, 06B Staffing and updated Shell regressions passed independently. The latest 06C test passed after the My Deployments ordering migration.
- An attempted serial run of all Phase 01–06C test files recorded **11 passes and 14 failures**. Most failures followed Supabase Auth “Request rate limit reached” after repeated test-account sign-ins; a controlled-document test also hit an existing development case fixture denial (`Onboarding case denied`). These are reported as incomplete regression evidence, not silently retried or called green. The independent Event/Staffing/Shell and focused allocation runs passed after that attempt. Test cadence/session reuse should be addressed before requiring another full rapid suite.
- Signed-in local production-build browser checks: Office B desktop 1280px Event/candidate Sheet with one accepted allocation; Operations 390px Event/candidate Sheet; Staff A 390px My Deployments. Both mobile document widths equalled viewport width (390/390). Candidate/Staff views showed no private source values. Staff history is collapsed after a UX correction prompted by accumulated Dev fixtures. Anonymous deep link redirects to sign-in. Screenshots: `output/playwright/deployment-06c/office-1280.png`, `operations-390.png`, `staff-390.png`. The signed-in browser actions read data and opened Sheets; mutation workflows were verified through guarded RPC tests, not claimed as browser click proofs.
- No intentional green styling appears in changed 06C UI; it uses the existing blue/graphite/neutral tokens. No credentials or private evidence are in source-controlled fixtures. Staged secret scan and diff check are recorded in the commit evidence.

## Limits and next task

“No recorded allocation clash” is not declared availability. Travel/rest, training, live SIA policy, real qualifications, attendance, check-in, worked/payable hours and finance remain unimplemented. The training provider is still unknown. Recommend a separate **TASK-07A Staff Availability** proposal so Staff can declare availability and managers can see it alongside clash and configured checks. Do not deploy 06C to staging automatically.
