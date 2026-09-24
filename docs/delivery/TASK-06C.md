# TASK-06C proposal — Deployment and Staff Allocation

**Status:** approved by David and implemented in synthetic development. TASK-06B accepted at `507d239`; see `TASK-06C-REPORT.md` for actual results and limitations. Staging remains unchanged.

## Purpose and boundary

Connect an actual `people.id` to an exact, stable `event_staffing_requirements.id`. The allocation inherits Event, Client, Site, operational role, service date, area and report/shift instants from that requirement. It must not copy those changing facts into a second current record. The chain becomes **Event demand → named allocation → optional Staff response**. It stops before availability declarations, attendance, check-in, worked hours, payroll, invoice or deployment readiness.

These remain separate facts: **required ≠ allocated ≠ passes configured checks ≠ Staff accepted ≠ checked in ≠ worked ≠ payable**. A synthetic SIA workflow record never establishes a real licence or legal suitability. A filled requirement is a staffing count, not an Event-ready or compliant verdict. Preserve the 06A Client/Site/Event model, 06B role and requirement identities, and all People/Profile/Document/CRM boundaries.

## Proposed 06C decisions

1. **Manual allocation only.** Office, Operations or Super Admin selects a candidate for a particular requirement. No bulk scheduler, AI assignment, implied SiteAssignment or automatic allocation from onboarding.
2. **Strict capacity.** An active allocation consumes one position. Lock the requirement and active allocations in the guarded operation; reject the next allocation when count would exceed `required_quantity`. No reserve/overfill concept in 06C. An override needs its own future rule.
3. **Minimal Staff response included.** An Office/Operations allocation starts `ALLOCATED` (awaiting Staff response). The named Staff Person may move only their own row to `ACCEPTED` or `DECLINED` in My Deployments. Decline returns capacity immediately. `ACCEPTED` means an explicit response about this allocation, not availability for other work, arrival or work completed. No Task adapter or notification in 06C.
4. **Two active states, two terminal states.** `ALLOCATED` and `ACCEPTED` consume capacity and participate in clash checks. `DECLINED` and `CANCELLED` are historical and do not. A terminal row cannot reopen. A replacement allocation is a new row; history remains. Office/Operations cancellation requires a reason. Staff decline may use a short controlled reason code (`CANNOT_ATTEND`, `TIMING_CONFLICT`, `OTHER`) with an optional bounded plain-text note; no medical/HR information is requested.
5. **No global eligible flag.** Candidate evaluation is recomputed for an exact Person, requirement and time. It returns separate check results and a short safe explanation. The result is never persisted as a permanent Person attribute.
6. **Availability unknown.** No overlap is phrased `No recorded allocation clash`, never `Available`. The missing availability module is an explicit warning until Phase 07.

## Allocation model and authoritative counts

Propose `event_staff_allocations`:

| Field | Purpose |
| --- | --- |
| `id` UUID | Stable allocation identity. |
| `requirement_id` FK | Exact 06B demand line; a composite FK with Event ID is optional if it improves guarded joins, but the Event is derived. |
| `person_id` FK | Exact KSS Person, not AuthIdentity or free text. |
| `status` | `ALLOCATED`, `ACCEPTED`, `DECLINED`, `CANCELLED`. |
| `requirement_revision_at_allocation` | Provenance showing the plan revision the allocator saw; not a second copy of role/time/area. |
| `allocated_by_person_id`, `allocated_at` | Database-controlled attribution. |
| `responded_at`, `cancelled_at`, `updated_at`, `revision` | Current lifecycle and optimistic concurrency; timestamps database-controlled. |

Current row updates occur only through guarded operations. A partial unique index prevents two active allocations of the same Person to the same requirement; a Person may be reallocated after a terminal row by creating a new record. Do not persist `filled`, `remaining`, `eligible` or `available` columns. Per planned requirement: `Required = required_quantity`; `Allocated = count(status in ALLOCATED, ACCEPTED)`; `Remaining = Required − Allocated`. Also show `Accepted = count(ACCEPTED)` separately. Event totals sum current planned lines. Cancelled requirements are excluded from current demand, while history remains. Counts and lists use the same exact Event permission predicate and are computed server/database side. `22/22 allocated` still does not say confirmed, attended, eligible or ready.

`event_staff_allocation_events` is immutable typed history: exact allocation/requirement/Person, kind (`ALLOCATED`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `EVENT_CANCELLED`), previous/new status and revision, actor, database time, controlled reason and `requirement_revision_at_allocation`. Audit ledger gets IDs/action/changed field names, not private evidence or free text. No direct authenticated insert/update/delete on current or history tables; both have RLS and guarded RPCs with explicit grants, search path and mapped active actor checks.

## Candidate discovery and access

A new exact-requirement candidate endpoint/RPC may search active `SECURITY_STAFF` People by safe display name with server pagination. It is not a raw `people`/Profile/SIA join exposed to the browser. The request binds to one Event and one planned requirement; Office/Operations/Super authority is checked before any search or count. Return only Person ID, display name, active operational Staff role label, **safe derived check outcomes**, and a limited summary of relevant recorded allocation conflicts. Do not return address, email, mobile, DOB, SIA reference/category raw value, onboarding IDs/comments, document request/version IDs, filenames, evidence bytes, contact data or HR notes. SiteAssignment may be shown as contextual work history if justified, but grants no candidate or allocation authority.

A guessed Person ID cannot skip candidate checks: allocation RPC recomputes all blocking checks transactionally against the chosen ID. A candidate outside the search page can still be rejected by the same guards. Search/count/pagination share the exact role/Event predicate; Staff, Operations with expired role, anonymous and unmapped identities get no broader data. Operations receives no CRM pipeline or private People source access through the new projection.

## Explainable checks and first role policy

Use a narrow, versioned **operational role check policy**, keyed to a stable `operational_role_definitions.id` and effective policy version. This is a staffing check configuration, not an HR qualification database. Initially:

- Every candidate must be an active mapped KSS Person with active `SECURITY_STAFF` role at action time. This is a hard gate, independent of onboarding case ownership or SiteAssignment.
- Every candidate must have no other active allocation whose half-open duty interval overlaps this requirement. This is a hard gate, independent of Staff response.
- For non-SIA catalogue roles, no role-specific credential rule has been approved. Report `Role qualification rule not configured` and `Availability not recorded`; allow a **synthetic, reasoned Office/Operations allocation with warnings**, without labelling that Person qualified or eligible for live duty. Do not imply Supervisor/Manager/Search competency from a role label.
- For the generic `SIA` operational role, do **not** interpret any SIA record as sufficient. Proposal for the synthetic proof: an explicit `SIA → SECURITY_GUARDING synthetic onboarding verification` rule can be configured only after David approves this exact category mapping for the test. It checks a current submitted credential revision, unexpired synthetic expiry date, exact accepted evidence/version and separate requirement verification through the existing source logic, without returning protected details. This would mean only `synthetic check satisfied`; it would not prove licence register validity, suitability for every SIA post, or real deployability. Until that mapping is approved/implemented, return `SIA policy not configured` and block SIA allocation rather than silently passing it.
- Training provider is `NOT_CONNECTED`. If a role's later policy requires training, report that dependency as `UNKNOWN / provider not connected`; never pass it. No role gains a fake training completion.
- Onboarding progress is informational only. Neither 5/6 nor future 6/6 automatically passes an operational role check.

Assessment response is structured as `BLOCKED` (hard fact such as role/clash, or required SIA policy missing), `REVIEW_REQUIRED` (no configured role credential rule / availability unknown), or `SYNTHETIC_CHECKS_PASSED_WITH_WARNINGS` (only when an exact approved synthetic rule passes, while availability/training limits remain visible). Avoid a plain `Eligible` badge. If David wants a categorical eligibility decision for live operations, that requires a separate KSS policy and evidence source. The UI shows the rule version, safe reason codes and a synthetic-only label. An allocation with review warnings requires a short Office/Operations acknowledgement reason stored on the allocation event; hard blockers cannot be overridden in 06C.

## Clash semantics

Use exact timestamptz instants and the half-open interval `[report_at, shift_ends_at)` for active allocations. Two duties overlap when `a.report_at < b.shift_ends_at AND b.report_at < a.shift_ends_at`. Equality at a boundary is not an overlap; back-to-back shifts are technically permitted but receive a `Travel/rest not assessed` warning when useful. Cross-midnight and DST are handled by stored instants; no local string comparison. For the same Person, lock a per-Person advisory key (or equivalent serialisation) while checking overlap and inserting, so two simultaneous allocations to different requirements cannot both pass. Add an index supporting Person/active-status/requirement lookup and a guarded exact-time conflict query; an exclusion constraint may be used only if it can safely join changing requirement times without duplicating unsynchronised ranges. No journey-time, fatigue or employment-law conclusion in 06C.

## Requirement and Event reconciliation

Extend the existing 06B guards narrowly; do not rewrite its typed history or change stable IDs.

| Change with active allocations | 06C rule |
| --- | --- |
| Quantity increase | Allowed under existing 06B reason/history rule; existing allocations stay. |
| Quantity reduction to at least active count | Allowed with existing 06B reason/history; nobody is arbitrarily removed. |
| Quantity reduction below active count | Rejected with count and instruction to cancel named allocations deliberately first. |
| Role, service date, report/shift time, area, instructions | Rejected while active allocations exist. Explicitly cancel/reallocate affected People first, then amend; no silent moving or stale Staff acceptance. This deliberately conservative first rule can be refined with approved reassignment semantics later. |
| Requirement cancellation | Rejected while active allocations exist. Cancel allocations with reasons, then cancel requirement; historical rows persist. |
| Event date change | Existing 06B service-date guard remains. Changes that would alter active allocated requirement context are rejected; no automatic shift or reacceptance. |
| Event cancellation | One explicit, atomic guarded Event cancellation operation records the Event reason, transitions every active allocation to `CANCELLED` with typed `EVENT_CANCELLED` history, then sets Event `CANCELLED`. If any transition fails, all roll back. No attendance/work claim. |
| Event `COMPLETED` | Normal new allocation/responses/cancellation stop. Existing allocation and response history remains descriptive; completion is not attendance. |

All mutation paths, including direct 06B RPCs and 06A Event status operations, must enforce the same reconciliation. This requires narrow forward corrections to those guards, not a browser-only check. Lock ordering should be Event → requirement → Person allocation key/rows for predictable concurrency; document the order and test simultaneous capacity/clash attempts. If the existing 06A/06B functions cannot be extended without materially broadening authority, stop before migration with the exact conflict.

## Authority and Staff self view

| Actor | 06C scope |
| --- | --- |
| Active Super Admin | Audited operational oversight and guarded allocation/cancellation; not a Staff response proxy. |
| Active Office Admin | Candidate search, plan/allocations and guarded allocate/cancel for authorised Events; no automatic private Profile/Document access. |
| Active Operations | Same operational allocation actions for authorised Events and safe candidate projection; no CRM pipeline, Contact details, private personnel evidence or Site administration. |
| Active Security Staff | Read only own allocated/historical Event work through a self endpoint and accept/decline only own `ALLOCATED` row. No broad Event plan or other Staff list. |
| Anonymous/unmapped/expired roles | Denied. |

Existing 06A Event authority currently covers active Office/Operations/Super organisation-wide, not exclusive owner scope; 06C should use that exact approved scope rather than inventing a team model. SiteAssignment alone grants no Event allocation or self-deployment record. A dual-role Person cannot respond for another Person or use management authority to fabricate Staff acceptance. Self-allocation should be prohibited in 06C even if the allocator also has Office/Operations/Super authority; a different authorised manager can allocate them. Staff role expiry removes self-action authority, while authorised managers can still see/cancel historical allocations. Staff self response uses the exact authenticated mapped Person, never a browser-supplied `person_id`.

Provide `/my-deployments` (or an equivalent Staff destination) with own Event name, Site name/reporting point, service date, role/area, report/shift instants in Europe/London, allocation state and accept/decline actions. Show synthetic status and no attendance/work/pay claim. No client CRM, client Contact, other Staff, full requirement plan or hidden private document. This is not a general Staff Events workspace. My Work remains for actual Task sources; no allocation Task in 06C, avoiding shared Task guard changes and duplicate response state. Staff notification/reminder design is Phase 07/later.

## Operations and Office product flow

Event detail evolves to a combined `Staffing Plan / Allocation` view, grouped by service date. Each line shows Required, Allocated, Remaining and separately Accepted; cancelled demand stays in history. Open a line to see its currently allocated People and a server-paginated candidate selector with safe check reasons. Desktop supports a compact operational table and side Sheet; 390px uses date groups, cards and a full-width Sheet with comfortable touch targets and no horizontal overflow. Allocate, cancel and Staff response refresh authoritative server counts; avoid optimistic success. Include pending, empty, conflict and stale-revision states. Candidate search does not download all People. No bulk assignment in the first slice.

The Event header may show derived totals, e.g. `22 required · 18 allocated · 4 remaining`; it must not say `fully staffed`, `eligible`, `confirmed`, `ready` or `deployable` solely from that count. Use the established shadcn/iOS-inspired blue, graphite and neutral design with text/icon status cues and no green. Staff sees only their own card, not a count that exposes colleagues.

## Proposed API and database shape

- `event_staff_allocations` and `event_staff_allocation_events` as above; RLS enabled, direct authenticated read/write revoked where exact guarded projections are used. Stable FKs to requirement and Person; partial unique active `(requirement_id, person_id)`; revision and status constraints; actor/timestamp guards.
- Optional small `operational_role_check_policies` keyed by role/version only if the explicit synthetic SIA category mapping is approved. No generic rules engine, universal qualification table or persisted eligibility flag. A source-specific private evaluator composes only existing current SIA/onboarding verification facts when configured.
- Guarded RPCs or equivalently protected operations: candidate search/evaluation for exact requirement; list exact allocations/counts; allocate; cancel; Staff own list; Staff accept/decline; typed history. Server routes call with the signed-in Supabase client, not a service key, and recheck role before invoking them. Direct guessed IDs give no broader projection.
- Minimal forward guards on 06B amendment/cancellation and 06A Event cancellation/date transitions. All active-count, clash, requirement-revision and lifecycle checks occur inside the same transaction as the write.
- Indexes for requirement/status, Person/status, event/requirement lookup and history order; no redundant current Event/Client/Site/role/time columns on allocation. If performance later requires a materialised read model, propose it separately.

## Synthetic proof and tests

Use new synthetic Dev People and Event/requirements; do not repair unrelated fixture history or touch staging. Football-style plan includes Stand Manager ×1, Stand Supervisor ×1, Turnstile SIA ×2 and Steward ×18. Allocate several non-SIA positions with explicit review-warning acknowledgement, leaving visible remaining demand; test the exact SIA synthetic rule only if its category mapping is approved. Show one candidate passing configured synthetic checks where applicable, one review-warning candidate, and one hard-blocked clash/role candidate. Demonstrate no-recorded-clash wording, same-Person overlapping cross-midnight rejection, back-to-back boundary behaviour, Office and Operations actions, Staff own allocation/accept/decline, decline reopening a gap, quantity-reduction conflict, requirement cancellation reconciliation and Event cancellation cascade. No Person is marked attended/worked/payable.

Focused negative matrix:

- Staff cannot allocate, self-allocate through a privileged second role, list peers, see full plan or respond for someone else.
- Office/Operations cannot manufacture Staff acceptance; Operations candidate responses reveal no private Profile, SIA reference, evidence metadata/bytes, onboarding comments or CRM pipeline.
- SiteAssignment grants no deployment; guessed Person/requirement/allocation/Event IDs and cross-Event pairings are rejected without existence leaks.
- Direct table/history/audit writes and internal/helper RPC bypasses are denied; expired manager or Staff role removes action access.
- Capacity and same-Person overlap hold under concurrent calls; a stale requirement/allocation revision conflicts; cancelled/terminal line/Event rejects new allocation.
- Requirement role/date/time/area/instruction mutation with active allocations is rejected; quantity below active count rejected; ordinary requirement cancellation rejected until reconciled; Event cancellation atomically cancels active allocations without marking work done.
- Accepted/declined/cancelled state history cannot be rewritten; terminal rows do not reopen; Staff decline releases capacity; acceptance does not change eligibility or Event status.
- Existing 06B history/totals, 06A Events, Operations projection, People directory, Profile/SIA/Document/Storage and shared Task regressions remain intact.

Run clean install, lint, typecheck, Webpack build, smoke, focused direct RPC/RLS and concurrency tests, relevant Phase 01–06B regressions, migration/readback, staged secret/no-green scans, Office/Operations desktop and 390px journeys, Staff 390px self view and accessibility focus checks. Log any Dev Auth throttling separately from product failures. Use synthetic data only.

## Phase 07 and later seams

Phase 07 may add declared Staff availability, invitations/notifications, recurring scheduling, travel/rest policies and roster optimisation. Later operational tasks may add briefing acknowledgement, check-in/out, attendance, verified worked time and payroll/invoicing approvals. A future live eligibility policy must specify role-to-credential mappings (including which SIA category is appropriate for each duty), training prerequisites, recheck cadence, override authority and the legal evidence source. 06C does not infer those from an operational role name or onboarding completion. Training provider remains unknown/`NOT_CONNECTED`.

## Approval questions and stop condition

The proposal requests approval for: (1) the minimal Staff accept/decline flow inside My Deployments without Tasks; (2) strict capacity and conservative requirement reconciliation; (3) warning-acknowledged **synthetic** allocation for non-SIA roles when no qualification/availability rule is configured; and (4) whether to configure the explicit `SIA → SECURITY_GUARDING` **synthetic test rule** now or leave SIA allocation blocked until KSS defines the operational category policy. The fourth decision must be explicit before implementing SIA candidate eligibility; it must never be inferred from any SIA record.

**Stop here.** No allocation table/migration, Person assignment, availability system, staging deployment or implementation is part of this proposal. Return this document for David's approval before TASK-06C implementation.
