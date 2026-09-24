# TASK-17C — Leave Scheduling Constraint Policy

**Status:** Implemented in synthetic Dev on 24 September 2026; awaiting David's acceptance. TASK-17B is accepted at `b8cac06`. No TASK-17D work is authorised or included.

## Scope and applied migrations

The configured Supabase project and URL resolved to `dnfhkmmnlbiabqypclqg`. No migration or test targeted protected staging `kwpgjbxepxuhwxxydaca`, production or real Staff leave data. The work was made in an isolated checkout based on the accepted 17B implementation. The 17C brief's stale 17B status was corrected before coding.

| Dev migration version | Name | Applied purpose |
| --- | --- | --- |
| `20260924222117` | `leave_scheduling_constraint_17c` | Private effective approved Time Away predicate; Event and Site Shift candidate, allocation and Staff response gates; Person lock coordination with 17B approval/cancellation; immutable reconciliation issue/event ledger; guarded operational list and explicit close RPCs; accepted 17B overlap backfill |
| `20260924222558` | `leave_workforce_projection_17c` | Safe Workforce week/person conflict projections and conflict filter |

Migration history readback confirmed both versions in Dev. The first migration's backfill created five Event and eight Site Shift issues for already approved synthetic 17B overlaps. At final readback, the ledger contained 15 `REVIEW_REQUIRED` and 21 explicitly `CLOSED` synthetic issues, including later test runs. The authenticated database role had zero direct read/write table privileges on the two reconciliation tables, and guarded RPC tests denied direct reads/writes and forged IDs.

## Delivered policy

- `APPROVED` and `CANCELLATION_REQUESTED` leave hard block a new overlapping Event or Site Shift allocation and Staff acceptance of an existing `ALLOCATED` duty. Rejected cancellation remains effective; final approved cancellation ends future blocking. Other request states do not hard block.
- The predicate uses half-open exact intervals. Event uses requirement report to shift end, static uses demand report to shift end, and whole days use successive London midnights. Existing availability, capacity and cross-source allocation guards remain in force. Candidate preview is advisory; writes recheck after the Person lock. `APPROVED_TIME_AWAY_CONFLICT` is the only scheduling reason exposed.
- Leave approval over an existing active allocation commits without mutating that allocation. One durable, typed, revision-bound issue is created per affected allocation and approval revision. The issue stores no leave category, reason or notes. Operational managers use existing guarded duty workflows to resolve the duty, then explicitly close the issue after the current source state is rechecked. Cancellation of leave or duty never deletes or automatically closes history; an active approved overlap cannot be closed as an accepted exception.
- Event/static allocation screens show safe candidate conflict text and exact allocation reconciliation controls. Workforce shows a separate approved Time Away indicator and count. Time Away manager detail retains its authorised existing-allocation conflict view. Scheduling roles receive no general Time Away request read authority.

## Synthetic verification

Focused authenticated Dev tests: `tests/leave-scheduling.test.mjs` **4/4 passed** on the final run. They covered Event/static candidate and transaction blocks, Event/static Staff acceptance, whole and partial days, non-overlap and touching boundaries, overnight duty, spring/autumn London DST, nonblocking states, cancellation requested/rejected/final, unchanged existing `ALLOCATED`/`ACCEPTED` allocations on approval, one exact issue per source, explicit closure, stale revisions, idempotent approval retry, forged issue/source IDs, direct table denial, privacy projection and unchanged Availability revision. Five controlled concurrent cases ran with `Promise.all`: approval versus Event allocation, approval versus static allocation, approval versus Staff acceptance, final cancellation versus allocation, and Event versus static allocation. The final run observed Event allocation win followed by an issue, static approval win followed by allocation denial, approval win followed by acceptance denial, final cancellation permitting allocation, and Event winning the shared Person allocation race. Prior runs observed the opposite winning order for some races. All passed the no unexplained committed overlap invariant.

The final focused run used separate available synthetic dates in May–August 2028 to avoid collisions with earlier test fixtures. Earlier fixed-date reruns had failed from already approved synthetic leave, not from the new gate. Final readback found **zero active** Event and zero active Site Shift allocations among `17C` synthetic fixtures. Immutable synthetic request, decision and issue history remains by design.

Accepted 17B Time Away, Event Attendance 09A, static Attendance 09B, Worked Time 10B, Workforce 07B and the relevant staffing DST regression passed in the shared Dev run. The Event staffing regression passed with a temporary fixture expectation updated from exactly eight role choices to at least eight; Dev currently has nine, and no accepted test file was changed. Two existing availability/site-shift regression files did not pass unchanged because their synthetic fixtures collided with accumulated Dev records or fell outside the default first 25 deployment results. Temporary wider-page reruns then hit the same fixture collision. These are remaining shared-regression evidence gaps, not a clean full-suite pass. No Attendance, Worked Time or demand mutation from leave approval was observed in the guarded source and integration checks; exhaustive mutation snapshots across every fixture were not completed.

The final `npm run build` passed Next.js 16.3.6 compile, TypeScript and page generation. Focused ESLint passed. Both migration files parsed as SQL before application.

## Browser evidence and acceptance boundary

An isolated local production server opened the app in the in-app browser, but that browser had no authenticated synthetic Dev session and redirected to sign-in. A request to inspect the existing Safari session was rejected by automatic approval review because it could expose unrelated private browser content. That rejection was not bypassed. **Authenticated desktop and 390px browser verification, including focus and overflow checks, remains outstanding.** The code/build/RPC checks do not establish UI acceptance.

TASK-17C is ready for David's review with the stated regression and browser evidence gaps. No staging, production, real Staff leave, deployment, automatic duty change, Availability change, Attendance change, Worked Time change, demand change, exception override or TASK-17D work is claimed.
