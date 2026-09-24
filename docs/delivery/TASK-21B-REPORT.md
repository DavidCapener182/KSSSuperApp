# TASK-21B delivery report — Service Delivery Foundation

**Date:** 24 September 2026
**Status:** Implemented in synthetic Dev; awaiting David's acceptance. No 21C work, staging, production or real KSS records were added.

## Approved boundary and implementation

David approved TASK-21B on 24 September 2026. The implementation adds one stable Service Delivery record for an exact `(Site Service ID, historical Site Client Link ID)` pair. It retains Client, Site, link, Service, source, creator, owner and creation time. A unique database constraint includes terminal records, so a duplicate or restart for the same pair is rejected. Neither source relationship changes nor Service Delivery closure repoint or mutate the Site Service.

Start is an explicit Office/Super action. `MOBILISATION_HANDOVER` checks an exact handed-over 18A Mobilisation, its approved `HANDOVER` decision and linked exact Site Service in the same transaction. `LEGACY_EXISTING` requires `LEGACY_EXISTING_SERVICE`, a 10–500 character explanation and a non-draft Site Service. It does not create a Mobilisation. No source or clock trigger creates a Service Delivery record.

The new domain has guarded owner reassignment, deliberate `PROPOSED → ACTIVE → CLOSING → CLOSED` or `PROPOSED → CANCELLED` transitions, non-overlapping custom London review dates, reasoned open-period correction, explicit period closure, scheduled/rescheduled/held/cancelled meetings with separate scheduled and actual times, management actions, blockers and paginated typed history. The database rejects nonexistent and ambiguous London wall times. Outstanding work remains visible after closure and requires an explanation for Service Delivery closure. Action completion is rejected while a blocker is open; blocker resolution does not complete the action. No source module is updated by these management actions.

Office and Super have route and guarded-RPC access. Operations and Staff have none. The seven new public tables have RLS enabled and zero `authenticated` table grants. Service Delivery history is read from the beginning in 25-row pages. No private source cards, scoring, notifications, exports, finance or external integration were added. UI uses the existing blue/graphite/neutral shell and never presents a readiness score or traffic light.

## Synthetic Dev migration and readback

The literal target `dnfhkmmnlbiabqypclqg` was rechecked through the Supabase project read immediately before the first migration. The protected staging project `kwpgjbxepxuhwxxydaca` was not targeted. All three local forward migrations were created through the Supabase CLI and applied to Dev:

| Source-controlled file | Dev history version | Purpose |
|---|---:|---|
| `20260924193740_task_21b_service_delivery.sql` | `20260924194705` | Tables, exact start, guarded changes, projections |
| `20260924194814_task_21b_blocker_reason_fix.sql` | `20260924194835` | Resolve a PL/pgSQL variable/column collision found by authenticated test |
| `20260924195952_task_21b_owner_null_guard.sql` | `20260924200012` | Reject null oversight and draft legacy source edge cases |

Readback found RLS enabled on all seven tables, zero authenticated base-table grants, the six public guarded RPCs, and zero Service Delivery triggers on CRM Opportunity, Site Service, Mobilisation or handover decision sources. The security advisor reports the expected informational no-policy entries for six RPC-only tables and the expected executable security-definer warnings for the six guarded RPCs; no authenticated table exposure was found for 21B.

## Verification actually obtained

- `tests/service-delivery.test.mjs`: **2/2 passed** after the final migrations. It exercised legacy reason and exact source, exact 18A decision, no start from handover alone, duplicate and concurrent single-winner starts, lost-response key retry, stale revision, owner reassignment, date correction and overlap rejection, explicit period closure and closed-period edit denial, scheduled versus held meeting and DST rejection, action/blocker rules, reasoned closure with outstanding work and unchanged Site Service state, history from creation, Office/Super read and Operations/Staff/direct-table denial.
- Database exclusion constraint plus current-revision serialisation protects overlapping period creation. The test checked concurrent same-revision creation and an overlapping creation at the next current revision.
- `npm run build` passed on Next.js 16.3.6 Webpack with TypeScript. Focused ESLint and `git diff --check` passed.
- Focused source regressions: 05A CRM, 05B CRM operational, 06A Event/Client Site, 08A Site Service/shift, and 18A Mobilisation passed. The first combined 06A run failed with a transient `CRM action denied` at synthetic contact creation while Dev was receiving other migrations; the isolated 06A rerun passed. Shared shell/return-target/navigation tests passed **2/2** after adding the Office/Super link and Staff/Operations route denials.
- Authenticated Office browser on the built local app: desktop and 390px list/detail rendered exact Client → Site → Service, source provenance, counts, sections and history. At 390px both pages measured `scrollWidth = 390`, visible Service Delivery controls were at least 44px, and an action was created through the browser form and read back in the detail and history. Screenshots are in `output/playwright/task-21b/`. The 21B component and style scan found no green/emerald/lime/teal tokens; visual screenshots show blue/graphite/neutral UI.
- A rollback-only SQL check revoked a synthetic Office role inside a transaction and returned `owner_ok = false`; no role change persisted. The UI shows `Owner reassignment required` from that eligibility predicate and does not alter historical ownership.

## Evidence limits and acceptance gate

The current 06A source contract prevents transferring a Site Client Link, so a live transfer/reparent scenario was not executed. The immutable stored IDs, exact foreign keys and no reparent mutation path were inspected; a later source transfer feature will need a fresh regression. The rollback-only owner-loss check did not exercise a full authenticated browser reassignment after role loss. No Client login fixture was available; the server role predicate and navigation map provide no Client grant. The authenticated browser checked list/detail and an action save, while deeper form transitions were covered through guarded RPC integration tests.

These checks establish a synthetic Dev implementation, not human acceptance or production readiness. David's review is the stop gate. TASK-21C source cards and later work remain unauthorised.
