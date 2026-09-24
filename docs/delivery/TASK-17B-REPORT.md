# TASK-17B — Time Away Requests Foundation

**Implementation:** 24 September 2026 · synthetic Dev only · pending David's acceptance.

## Delivered

- Dedicated Time Away teams and effective-dated Staff memberships. A request binds to one active team at submission. With no team, Staff may save a draft but cannot submit; with multiple teams, Staff must select an active team. Later membership changes do not move submitted requests.
- Finite, action-specific approver grants independent of Office, Operations and Super Admin roles. Office/Super can administer teams, memberships and grants through attributable guarded RPCs. Approval and cancellation decisions reject the request Person even if that Person has a grant.
- Versioned neutral categories: `ANNUAL_LEAVE`, `UNPAID_LEAVE`, `OTHER_TIME_AWAY`. Ordered London whole-day or explicit partial-day segments, draft edits, preview, submission, withdrawal, approval/decline, cancellation request, cancellation approval/rejection and immutable history. No entitlement, pay, medical or attachment fields are used. Decision notes are disabled pending privacy review; controlled reason codes remain.
- Staff page `/my-time-away`; manager queue, bounded month calendar, exact detail and Event/Site Shift allocation facts at `/time-away`; guarded API at `/api/time-away`. Calendar-only authority cannot open full decision history. A narrow Workforce display extension was optional and was not added.
- Source tables for Availability, Event and Site Shift allocations, attendance, worked time and demand have no TASK-17B writes. The shared Event/static Person allocation guard was not changed.

## Dev schema and authority readback

The configured URL and Supabase project readback both resolved to the approved literal Dev ref `dnfhkmmnlbiabqypclqg` before migration. No call targeted staging `kwpgjbxepxuhwxxydaca` or production.

Source-controlled, applied Dev migrations:

| Version | Migration | Purpose |
| --- | --- | --- |
| `20260924194533` | `time_away_17b` | Teams, membership, grants, request ledger, RPCs and conflict projection |
| `20260924195328` | `time_away_17b_guards` | Immutable history and submitted segment/team guards |
| `20260924195541` | `time_away_17b_note_gate` | DB constraint requiring decision note to be null |
| `20260924200028` | `time_away_17b_calendar` | Scoped exact segment calendar projection |
| `20260924200511` | `time_away_17b_read_scope` | Active-role check and calendar/detail separation |
| `20260924200943` | `time_away_17b_team_lifecycle` | Prevent deactivation while requests remain unresolved |

SQL readback confirmed all six migration history entries. All nine `public.time_away_*` tables have `relrowsecurity=true`. `information_schema.role_table_grants` returned **zero** direct table grants for `authenticated` on these tables. Nine guard triggers were present after the final migration: team revision/open-request lifecycle, membership, grant, request, segment, authority history, request history and decisions. The security advisor reports the intended `rls_enabled_no_policy` information notices for these RPC-only tables and generic `authenticated_security_definer_function_executable` warnings for guarded RPCs; it did not report a Time Away table with RLS disabled. Authenticated direct `SELECT` on requests and memberships failed in the focused test.

Dev readback of the two purpose-built fixtures showed Team A with one active Staff member and one active approver, and Team B with one active Staff member and no active approver after temporary proof grants were revoked. The attributable authority event ledger contained team creation, membership creation/revocation and approver grant creation/revocation entries. A final query of 17 synthetic decision rows returned zero non-null notes.

## Focused proof

`node --env-file=.env.local --env-file=.env.test.local --test tests/time-away.test.mjs` passed after the final read-scope migration. The test authenticated synthetic Super Admin, Office, Operations (Manager A), Staff A, Staff B and Staff Zero. It proved:

- Staff Zero saved a draft with no team and could not submit it. Staff A required an explicit team selection when temporarily in both teams. Submission preserved the selected team after the original membership was revoked and later restored.
- Manager A listed and decided Team A requests. Team B request IDs were denied in manager list, exact detail and coverage; Team B was absent from Team A rows and calendar counts. Office and Super Admin could administer but could not decide without grants. Staff A could not approve their own request even while holding an exact Team A decision grant.
- Revoking a temporary Team B grant removed access immediately. A short finite Team B grant lost access when it expired. A calendar-only Team B grant returned scoped date facts but could not read full request detail.
- A rollback-only SQL check rejected deactivation of Team B while submitted requests remain. A temporary empty team could be deactivated at revision 2; that transaction was rolled back and did not add a fixture.
- Repeated submission and decision calls with the same idempotency key returned the committed result. Two concurrent decisions against revision 2 produced exactly one success and one stale failure. A rejected cancellation returned to `APPROVED` with separate immutable events and decision rows. Terminal transitions had no reopen path.
- A whole-day request across London dates and a valid partial day passed. Autumn `01:30` ambiguity and spring `01:30` nonexistence were rejected. The manager calendar returned the submitted partial day with exact `09:00:00` local context, rendered as `09:00–12:00`.
- The exact 9 November 2026 Site Shift and 10 February 2027 Event allocations were each reported once with their `ACCEPTED` responses. Conflict reads reported `allocationChanged=false`. After leave approval, both source allocation IDs still read `ACCEPTED`: Site Shift `e89594c9-5388-402d-8312-4304d14f4489` and Event `a796d894-b8ab-4c24-9c46-642d5d817ca7`. No migration contains an Availability, allocation, attendance, worked-time or demand write.

One readback request for Staff A remained bound to Team A at revision 5 with five lifecycle events and two decisions; a Staff B request remained bound to Team B at revision 2 with two events and no decision. The direct table and RPC proofs are stronger than a UI-only visibility check, but they do not constitute a production policy review.

## Browser and build evidence

The isolated worktree was built with Next.js 16.3.6 Webpack. `npm run build` compiled, completed TypeScript and generated all 52 static pages. Focused ESLint passed; `npm run smoke` passed one test. The browser used an isolated local production server on port 3017 against synthetic Dev.

- Staff desktop and 390px: [desktop](../../output/playwright/task-17b-staff-desktop.png), [390px](../../output/playwright/task-17b-staff-390.png). The browser previewed 12–14 October individually, saved a draft, submitted it to Team A and showed immutable history. A subsequent browser action showed **Cancellation requested** while the approved period remained effective; the saved final screenshots show the request after manager rejection returned it to Approved.
- Manager desktop and 390px: [desktop detail](../../output/playwright/task-17b-manager-desktop.png), [390px detail](../../output/playwright/task-17b-manager-390.png), [desktop calendar](../../output/playwright/task-17b-manager-calendar-desktop.png), [390px calendar](../../output/playwright/task-17b-manager-calendar-390.png). Manager A saw only Team A, approved the Staff request, saw exact Site Shift conflict facts on a separate approved request, and rejected cancellation back to Approved. The October calendar showed 12–14 October and exact partial-day time on 25 October.
- A Super Admin browser opened the guarded authority screen and read Team A/B membership and the finite Manager A grant. The Super Admin had no manager queue access from role alone.

## Remaining evidence and acceptance boundary

- The final UI reason-control wording, partial-day calendar display and calendar-only read hardening were covered by the final build, lint, authenticated RPC test and refreshed desktop/390px screenshots.
- The focused test was rerun during hardening and left multiple clearly synthetic request/history fixtures in Dev. They are immutable proof records. No real Staff leave record was created.
- The full shared Dev regression suite was not run while other approved lanes were migrating the same Dev project. The TASK-17B test, build, lint and smoke checks passed. No staging, production, live source, notifications, payroll, entitlement policy, scheduling hard block or automatic cover was introduced.
- David's acceptance and any TASK-17C scheduling constraint decision remain separate.
