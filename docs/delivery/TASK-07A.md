# TASK-07A — Staff Availability (approved design)

**Status:** Approved by David and implemented in synthetic development. See `TASK-07A-REPORT.md` for delivered behaviour and verification limits.

**Starting point:** TASK-06C accepted at `ce28b70`.
**Environment:** Synthetic development only. Protected staging is unchanged.

## Purpose and boundary

Let Security Staff declare when they can or cannot work, then evaluate that declaration for the **exact** 06B staffing requirement in the 06C candidate and allocation flow. An absent declaration means **Not declared**. Availability is a Staff statement, not a deployment decision.

Keep these independent: **required demand, declaration, configured candidate checks, allocation, Staff acceptance, attendance, worked time and payable time**. Declared available cannot create or accept an allocation. An accepted allocation cannot create an availability declaration. No readiness verdict follows from either.

07A adds individual date/range declarations and a first-class **My Availability** page. It adds no recurrence engine, rota, notification, attendance, finance, or manager-written Staff declarations. The existing synthetic SIA check remains explicitly development-only. No real Staff or staging data is involved.

## Proposed business rules

### Declarations and intervals

- Persist only two declaration values: `AVAILABLE` and `UNAVAILABLE`. **Not declared** and **Not fully covered** are derived assessment labels, never stored states.
- Each declaration belongs to one `people.id` and describes a half-open instant interval `[starts_at, ends_at)`. Require `ends_at > starts_at`. Adjacent intervals do not overlap.
- The first release supports individual future ranges: whole London-local days, part days, overnight ranges and multiple separately entered dates. No weekly repeat template or bulk recurrence expansion.
- Propose a technical booking horizon of 12 months from entry and a maximum single entry of 31 calendar days. These are anti-error bounds, not KSS availability policy. Revisit with real usage. Past intervals remain historical; Staff cannot retrospectively rewrite them. A whole-day entry starts at London midnight and ends at the next London midnight. A current day can be declared only from the current instant forward, labelled **Rest of today**, rather than falsely claiming the elapsed part of the day.
- Store exact `timestamptz` instants. Display and collect Europe/London local values. A whole day spanning a DST transition can be 23 or 25 elapsed hours. For custom local times, reject a nonexistent or ambiguous local clock time and request an explicit valid choice; do not silently normalise it. Use the existing London-time validation approach already used for CRM due dates and 06B/06C time input.
- Optional note: short plain text (proposed 300 characters), visible to the Staff member in their own history. The form says: **“Optional note — do not include medical or sensitive personal information.”** No note in candidate, manager allocation, search, audit payload or error response.

### Overlap and replacement

There must be **at most one current declaration state at any instant for a Person**. A guarded write locks that Person, locates intersecting current intervals and applies one atomic replacement. It does not use an unrecorded last-write-wins update.

If a new interval overlaps an existing current interval, the UI previews the replacement and requires confirmation. The previous interval becomes `SUPERSEDED`; unaffected left and right portions remain as new current fragments with a common change-set identifier; the requested interval becomes current. Each fragment and superseded row retains provenance to the original declaration and change event. For example, replacing 16:00–17:00 with `UNAVAILABLE` inside an existing 12:00–20:00 `AVAILABLE` declaration leaves current availability at 12:00–16:00 and 17:00–20:00. The entire operation commits or rolls back together. Staff can cancel a future current interval; the row remains historical and is no longer effective. Amendments use the same replacement operation with an expected revision, and a stale edit conflicts.

The evaluator checks effective **current** intervals only. An overlapping `UNAVAILABLE` interval takes precedence for the duty even when other portions are `AVAILABLE`. Superseded/cancelled rows are history, never current input. A database-level current-interval exclusion constraint should backstop the guarded operation if the required PostgreSQL extension/index is available; otherwise the Person lock, overlap guard and revoked direct writes must be proven under concurrent requests. This is scoped to availability, not a generic temporal engine.

### Exact requirement evaluation

Compare current declarations to the requirement's actual `[report_at, shift_ends_at)` interval. Use exact instants, including overnight and DST changes.

| Effective declaration for the duty | Derived candidate label | Allocation effect |
| --- | --- | --- |
| Any `UNAVAILABLE` overlaps | Declared unavailable | Hard `BLOCKED`; no 07A override |
| Union of adjacent `AVAILABLE` intervals fully contains the duty, with no unavailable overlap | Declared available | Positive signal; all other 06C checks still apply |
| Some available time, but the whole duty is not covered | Not fully covered | `REVIEW_REQUIRED`; show precise safe reason code |
| No effective declaration touches the duty | Not declared | `REVIEW_REQUIRED`; never infer available |

An availability declaration that starts at 12:00 and ends at 18:00 fully covers a 13:00–17:00 duty. It does not fully cover a 10:00–14:00 duty. An unavailable interval that touches any nonzero part of the duty blocks it. Equality at an interval boundary is not overlap.

The existing 06C checks remain separate: active Security Staff role, exact allocation clash, configured role check, synthetic SIA policy and training connection state. **Declared available is not a generic eligibility pass.** For non-SIA roles, the unconfigured qualification rule remains a warning requiring the existing synthetic-development acknowledgement and reason. For SIA, the versioned synthetic `SIA → SECURITY_GUARDING` check remains a synthetic check only. Training remains `NOT_CONNECTED`. A partial or missing availability declaration must never upgrade the candidate result; under the existing 06C synthetic warning path it can be acknowledged with a reason when there is no hard blocker. `UNAVAILABLE` and overlap clashes cannot be acknowledged away.

### Existing allocations and Staff response

Staff may save a future `UNAVAILABLE` declaration that intersects an `ALLOCATED` or `ACCEPTED` deployment. Before save, show the exact affected own deployment(s) and require acknowledgement that **availability does not cancel or decline a deployment**. Save the declaration and preserve the allocation and Staff response state. Show **Availability conflict with existing allocation** in My Availability/My Deployments and a safe exact-allocation conflict indicator in the authorised Office/Operations Event view. The manager must resolve it through the existing explicit deployment actions; 07A sends no automatic cancellation, decline, Task or notification. A removed/shortened `AVAILABLE` range can likewise surface **Declaration no longer covers this allocation**, distinctly from an explicit unavailable conflict.

The 06C manager candidate search and the `deployment_allocate` action must call the same availability evaluator. The allocation action rechecks after its existing Person lock, within the same transaction as clash and capacity checks. Availability writes take the Person lock before changing current intervals. This serialises an availability edit against allocation for that Person, so the result follows committed order; an earlier candidate screen is never sufficient authority. Keep 06C's existing Event → requirement → Person lock order for allocation, and do not acquire Event locks in an availability self-write.

## Minimum additive data proposal

| Object | Proposed contents and guard |
| --- | --- |
| `staff_availability_declarations` | UUID, `person_id` FK, `state` (`AVAILABLE`/`UNAVAILABLE`), `starts_at`, `ends_at`, lifecycle (`CURRENT`/`SUPERSEDED`/`CANCELLED`), revision, optional private note, `origin_declaration_id`, `change_set_id`, creator/last actor, database created/updated timestamps. Current intervals cannot overlap for a Person. |
| `staff_availability_history` | Append-only typed `CREATED`, `REPLACED`, `FRAGMENT_CREATED`, `CANCELLED` events with exact declaration/person, actor, database time, previous/new controlled state/interval, expected/new revision and change-set link. Private note text is excluded from generic audit and manager projections. |
| Guarded functions | Resolve Staff Person from authenticated `AuthIdentity`; create/replace/cancel self declarations with Person lock, revision check, interval/horizon validation, split/supersession and history; exact-requirement private evaluator; bounded self list/history and manager safe projection. |
| Indexes/constraints | Person/current/time overlap lookup; Person/history pagination; interval validity; lifecycle/state checks; unique revision/event identity. Add a current-interval exclusion constraint when compatible with existing extension policy, with concurrent guard tests either way. |

No copied availability state on `people`, allocations, opportunities or Events. No persisted candidate verdict. No schema for health/absence reasons. No manager override table in 07A. Apply any migration through the accepted source-controlled migration path only **after** approval; this proposal applies none.

## Authority and privacy

| Actor | Read | Write |
| --- | --- | --- |
| Active Security Staff | Own current declarations and own typed history; own deployment conflicts | Own future declarations through guarded operations only |
| Active Office Admin / Operations | Safe derived availability result for an exact authorised staffing requirement; exact allocation conflict in an authorised Event | No Staff declaration edits |
| Super Admin | Same bounded operational projection unless a later explicit personnel-admin workflow is approved | No ordinary impersonated Staff declaration edit in 07A |
| Other, expired, anonymous or unmapped | None | None |

The browser must not choose a Staff `person_id` for a self action. Resolve it from the authenticated identity. Manager candidate evaluation remains behind the exact Event/requirement authority from 06C; it returns controlled labels/reason codes, **not** raw intervals, notes, private Profile/SIA/evidence, or all Staff declarations. Staff self-list/history is scoped by Person, with server-side pagination. No search/count endpoint may widen this scope. Revoke raw table writes for ordinary clients and deny direct history/audit writes. A privileged database function must set a safe search path and independently check the caller, Person and source. RLS remains a second boundary, not a substitute for the guarded mutation. SiteAssignment, CRM access or Staff Record discovery grants no availability authority.

The exact candidate response can add a bounded `availability` object such as `{ status, reason_codes }`; it must not include Staff notes or private source IDs. Do not render protected values into HTML, error messages or logs. Office and Operations see the same safe staffing result without gaining Profile, Documents, credential references, CRM pipeline, or onboarding evidence.

## Product surfaces

### Staff: My Availability

- Add a role-scoped **My Availability** destination, distinct from **My Deployments**.
- Show upcoming current declarations grouped by London-local date, with explicit Available/Unavailable text, time range, whole-day label and an honest **Not declared** empty state. Past/superseded/cancelled history is available in a separate bounded history view, with change time and actor, not raw audit JSON.
- Create or replace through a responsive form: Available/Unavailable, all day or custom times, start/end, optional note, overlap replacement preview, and affected own deployment warning. Cancel a future declaration through confirmation; do not silently delete history. Use clear save/error/conflict feedback.
- At ~390px, use readable cards and a viewport-fitting sheet, comfortable touch targets, date/time labels, visible focus, keyboard-operable controls and no horizontal page overflow. Desktop can use a compact range list and detail/entry panel. Do not build a full rota calendar.
- Use the existing blue/graphite/neutral shadcn visual standard; **no green**, including “Available”. Status has text and an icon where useful.

### Manager: candidate and deployment workflow

- Candidate rows show one safe availability label (`Declared available`, `Declared unavailable`, `Not fully covered`, `Not declared`) next to the already separate clash and configured-check results. Explain blocked/warning causes without revealing declaration notes or private evidence.
- The allocate action reports an authoritative conflict if availability changed after search; refresh that exact requirement's candidates/counts. No optimistic success display.
- Current allocation rows can show the safe **Availability conflict** indicator after a later declaration, including for `ACCEPTED`; status and actor history remain unchanged. Operations can act through the existing explicit cancellation/reallocation flow.
- Keep the Office/Operations desktop requirement → allocation → candidate journey efficient. At ~390px, keep the candidate sheet and allocation cards readable. No seven-column grid or manager access to raw Staff availability history.

### Routes and service seam

Propose `/my-availability` plus bounded self read/mutation handlers or guarded RPCs under the existing auth pattern. Do not add a browser-accessible global availability API. Extend the current `deployment_candidates` projection and the private `candidate_check_06c`/`deployment_allocate` path in place, with a versioned availability reason-code contract. Deep links and direct RPC calls re-authorise independently. The self view must work without any manager/CRM role.

## Positive acceptance proof

Use separate synthetic development People/Events so accepted historical fixtures are untouched:

1. Staff A declares `AVAILABLE` 12:00–20:00 London. A 13:00–18:00 requirement is **Declared available**; a 10:00–14:00 requirement is **Not fully covered**.
2. A Person with no current declaration is **Not declared**, not Available.
3. Staff A replaces part of the available range with `UNAVAILABLE`, preserving outer available fragments and typed history; any overlapping duty is hard blocked.
4. An overnight declaration and cross-midnight requirement evaluate by exact instants. London all-day declarations on DST-change days span the correct 23/25 elapsed hours; invalid or ambiguous custom input is rejected.
5. Office and Operations receive only the exact requirement's safe derived label/reason code. Staff A sees only Staff A declarations; another Staff member sees only their own.
6. Staff A later declares unavailable over an already `ACCEPTED` allocation. The allocation remains accepted, its history is intact, Staff sees the save warning/conflict, and Operations sees a safe Event conflict for explicit resolution.
7. Concurrent declaration replacement and allocation are serialised; the allocation-time check reflects committed availability. Adjacent available fragments can jointly cover a duty, while a gap cannot.
8. Desktop Office/Operations candidate flow and 390px Staff My Availability/My Deployments flows are usable and accessible without horizontal overflow or green styling.

## Negative and regression matrix

- Staff cannot read, edit, cancel or guess another Person's declaration/history. Browser-supplied Person/actor IDs cannot redirect a self action.
- Operations cannot write Staff declarations; Office and Super cannot impersonate Staff through this ordinary flow. Expired roles/mappings lose access at read/action time.
- Concurrent or direct writes cannot leave contradictory current intervals. Stale revision edits fail. Cancelled/superseded history cannot be rewritten; ordinary clients cannot write audit/history rows.
- Any unavailable overlap blocks allocation despite adjacent available time. Partial coverage is not a full pass. No declaration does not imply availability. Equal half-open boundaries do not falsely clash.
- Custom DST gap/overlap inputs fail clearly; all-day 23/25-hour dates and overnight spans evaluate correctly.
- Availability mutation cannot allocate, accept, decline, cancel or complete a deployment; an accepted deployment remains accepted after a conflicting declaration.
- Candidate/list/count/error responses contain no note, home/contact field, SIA reference, evidence ID, document metadata or protected Profile value. Guessed requirement/Person/allocation IDs and direct RPC/table/Storage attempts remain scoped.
- Role expiry and SiteAssignment do not widen manager/self or private-source access.
- Existing 06C capacity/concurrent clash, Staff response, synthetic SIA, candidate projection, Event cancellation and My Deployments tests remain green, alongside relevant Phase 01–06B People/Profile/Documents/Tasks/CRM/Sites/Events tests.
- After approval, run clean install, lint, typecheck, Webpack build, smoke, focused availability/RLS/concurrency/controlled-clock tests, relevant regressions, migration/object readback, staged secret scan, no-green audit, desktop and 390px browser checks. Record Auth throttling and unrelated controlled-document fixture failures separately; do not call a partial suite a full pass.

## Separate engineering follow-up: Auth test-session reuse

06C's focused checks passed, but its broader suite was incomplete because of repeated Supabase Auth throttling and an existing controlled-document fixture problem. Propose a **small separate engineering task** to measure sign-in calls by test file/persona, reuse short-lived authenticated synthetic test sessions within a safe isolated test run where feasible, refresh only when needed, and pace truly independent logins. Keep tokens in process memory only, never in fixtures, source, logs or shared persistent cache. Preserve per-test role/record isolation and action-time role expiry checks; do not weaken Supabase Auth rate limits or production settings. Compare sign-in count and full-suite completion before/after. Diagnose the controlled-document fixture independently; do not hide it with retries or mutate accepted history. This engineering task is **not** part of 07A's availability business logic.

## Later seam and exclusions

07B may compose the same exact declarations, requirement intervals and allocation states into a weekly Workforce Schedule/Rota view. 07A adds no stored rota, recurring template, shift invitation, declared preference, travel/rest verdict or scheduling policy. A later explicit personnel-admin task can consider manager-entered unavailability if KSS identifies a real use case and privacy rule. Training integration and live SIA/qualification policy remain unresolved. No real-personnel or production claim follows from 07A.

**Implementation boundary:** Development only. Do not alter staging, deploy, or begin 07B on the strength of this task.
