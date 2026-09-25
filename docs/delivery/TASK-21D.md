# TASK-21D — Service Delivery Commitments & Change Control

**Status: ACCEPTED — SYNTHETIC DEV by David on 25 September 2026.** This is the original implementation brief, prepared from canonical `main` at `25dfb02dd5e1da087b0cc8034b2260d8c129122c`. Its draft alternatives and pre-implementation gate below are superseded by the accepted first-slice contract in this section and the [delivery report](TASK-21D-REPORT.md). Acceptance does not authorise staging, production, real Client data, TASK-21E or TASK-21F.

## Accepted first-slice contract and close-out

David accepted TASK-21D in synthetic Development on 25 September 2026. Commitments are management records only: `PROPOSED_UNVERIFIED`, `ENDED` or `WITHDRAWN`, with “Proposed / source not contractually verified” wording. TASK-21D has no contractual confirmation authority and cannot present a Commitment as a contract, PO, SLA, billing entitlement, contractual obligation or readiness decision. `CONFIRMED_SOURCE_BOUND` requires a separately approved authoritative source.

Changes target **Site Service only**. Event and Operational Document targets remain disabled, including if TASK-19A is later accepted. Proposal, review, decision, and `APPLIED | NOT_APPLIED` outcomes retain separate history. Approval is a management decision and does not mutate a source. `APPLIED` requires an independently successful guarded 08A action and exact resulting Site Service event/revision. An approved change without that evidence remains “Awaiting source application”; later source drift preserves the original link and displays “Source changed since this application”.

Super Admin administers finite `SERVICE_CHANGE_PROPOSER`, `SERVICE_CHANGE_APPROVER` and `SERVICE_CHANGE_RECORDER` grants to named active Office Admin People under the exact Service Delivery. Super Admin role alone grants no proposal or approval action. A proposer cannot self-approve, even with both grants. Recorder authority grants no 08A source authority. Operations, Staff and Clients have no 21D management authority. Service Delivery does not directly mutate source modules or finance.

The [delivery report](TASK-21D-REPORT.md) records the accepted verification, exact local-to-remote migration pairings and SHA-256 values. Preserve both migrations in their applied order during canonical integration; the forward correction must not be folded into the first applied migration. The 08A first-page assertion failure remains shared synthetic-fixture/test-maintenance debt, not a passing regression. Advisor findings remain informational; no speculative indexes were added. TASK-21D is closed after the acceptance commit. **STOP: do not begin TASK-21E or TASK-21F automatically.**

## Purpose and accepted source contracts

Add explicit, attributable management of **what a Service Delivery team believes it must do** and **what change was proposed, decided and actually applied**. TASK-21B already supplies the stable `service_deliveries.id`, exact Site Service and historical Site Client Link binding, owner, state, review periods, meetings, actions/blockers, guarded Office/Super RPCs and paginated history. TASK-21C supplies read-only staffing/attendance source cards. CRM, Mobilisation, Site Service, Event, staffing, Documents/SOP, Assets and Contacts retain their own identities and guarded authority.

An Opportunity `WON`, a Mobilisation action, meeting note or Service Delivery action does not itself establish contractual authority. Commitment and change records are management facts, not a substitute for an approved contract/PO, Site Service revision, Event requirement, SOP publication or billing decision.

## Stable records and bounded lifecycle

- **Commitment**: stable UUID under one exact Service Delivery. Store concise description, controlled category, accountable Person, start/end applicability, provenance type and exact source ID/version where an approved source exists, created actor/time, current revision and append-only history. Separate `PROPOSED_UNVERIFIED`, `CONFIRMED_SOURCE_BOUND`, `ENDED` and `WITHDRAWN` projections. A proposed unverified item must be labelled as such and cannot be presented as a contractual promise. Confirmation requires a source type/version whose authority is approved for this slice; absent an approved contract source, keep the first slice explicitly management-only or limit confirmation to an approved Service Plan version if one exists.
- **Change request**: stable UUID under one exact Service Delivery, with target domain/type, exact current source identity and baseline revision/version, requested change summary, proposer, owner, requested effective date/time, reason, and optional linked Commitment. Use explicit states `PROPOSED → UNDER_REVIEW → APPROVED | REJECTED | WITHDRAWN`; `APPROVED → APPLIED | NOT_APPLIED` records the subsequent outcome. Do not infer approval from a Client email or meeting note. A rejected/withdrawn request remains immutable history.
- **Decision**: append-only actor/time/reason, decision authority, scope, exact proposal revision and effective date. Approval means a management decision only. It does not mutate any source. Record a later **application link** to the exact authoritative source record and resulting revision/event/version after that module's separately guarded action succeeds. Verify same Client/Site/Service context and source provenance when linking. A failed, unperformed or stale source action stays `APPROVED_NOT_APPLIED`; do not silently mark `APPLIED`.
- **Supersession/correction**: revise a proposed change with optimistic revision and typed history. Once decided, corrections are new attributed entries or a replacement change linked to the original. Do not rewrite old proposal or decision payloads. Ending a Commitment preserves historical periods and source versions.

Examples: an additional night guard request links to an actual Site Service/template/demand revision only after the Site Service module makes that change; a reporting-point change links to its source revision; a new SOP links to an exact published operational DocumentVersion and assignment decision, but does not publish it from Service Delivery. A recurring review meeting is a 21B fact, not a commitment by itself.

## Authority and privacy

Initial administration stays with active Office Admin and Super Admin under 21B's exact Service Delivery scope; David must decide whether proposal, approval and application-link recording require distinct finite named grants and whether the same Person may perform all three. Operations has no new management access from its Site/Control Room scope. Staff and Clients have none. Named owner is accountability, not an automatic access grant. Every list, detail, count, search, history, source preview and mutation checks current actor role/action and exact Service Delivery → historical Site Client Link → Site Service context on server and in guarded RPCs.

RLS is enabled on new tables, with direct `anon`/`authenticated` writes and sensitive reads denied. Use fixed-search-path security-definer functions with narrow EXECUTE grants, actor-derived Person, exact source FK/typed identity where possible, and no caller-selected Client/Person authority. A link to a private contract, SOP or Contact route does not expose its contents: the target module independently authorises any view/download. Keep private agreement text, contact details, prices, penalties and personal notes out of generic history, list cards and logs.

## Concurrency and idempotency

Require expected revision and request UUID on creation, amendment, decision and application-link actions. Store payload hash and result for replay; identical retry reuses the same record, changed payload fails. Lock the exact Service Delivery/change record and validate current source membership/version on each transition. Two conflicting decisions cannot both win. The application link needs a uniqueness rule for exact `(change ID, target source event/version)` and a transactionally checked current source revision; if a source changes again, preserve the applied link as history and show a factual **source changed since application** indicator rather than rewriting it. Do not create a distributed transaction that bypasses source-module guards.

## UX

Office/Super Service Delivery detail gains separate **Commitments** and **Changes** sections after the accepted 21B review/actions and 21C read-only source cards. Each card prominently shows exact Client → Site → Service, provenance label, accountable owner, effective date, current factual state and a source deep link only if independently authorised. An approved change displays **Awaiting source application** until an exact resulting source revision is linked. A missing primary source is a gap, not an invented agreement. At 390px use one-column cards, clear decision/apply confirmations, 44px targets, visible focus, accessible errors and no horizontal overflow. Blue/graphite/neutral palette; no green or readiness/compliance score.

## Acceptance proof after separate approval

In literal synthetic Dev `dnfhkmmnlbiabqypclqg`, prove exact Service Delivery/Site Client Link/Site Service binding; proposed versus source-confirmed Commitment wording; proposal, decision, rejection, withdrawal and approved-but-not-applied states; a real guarded source-module action followed by exact revision link; no source action from approval alone; failed/stale source application remains pending; concurrent decision single winner; replay idempotency; append-only history; Office/Super access and Operations/Staff/peer/direct-table denial; cross-Client/source UUID substitution denial; private document audience unchanged; no Service Delivery state as Event/static status substitute. Run focused 21B/21C, 08A, 18A and controlled-document regression only for touched seams, plus build and authenticated desktop/390px browser checks. Record **canonical local migration filename, actual remote ledger version and literal target project ref** in the delivery report before acceptance.

## David's decisions before implementation

1. Which source type can make a Commitment `CONFIRMED_SOURCE_BOUND` in the first slice? If no approved agreement/service-plan version exists, should all initial Commitments remain clearly `PROPOSED_UNVERIFIED` management records?
2. Which exact target modules may a first-slice Change reference: Site Service only, or Site Service plus Event and operational DocumentVersion? Confirm whether cross-module application links are read-only after independently guarded source changes.
3. Decide proposal/approval/application-link authority, separation of duties, owner reassignment and whether Super Admin needs a finite grant for direct decisions.
4. Decide whether a change may have multiple source revisions/events, and how partial application across several target modules is labelled.
5. Set effective-date, retrospective correction, retention, Client-visibility and contract/PO provenance policy before real records.

## Explicit exclusions and gate

No automatic Site Service/Event/SOP mutation, contract/PO interpretation, SLA, pricing, penalty, finance authority, invoice, staffing eligibility, notifications, Client portal, Operations edit scope, source snapshots masquerading as truth, performance score, live data or deployment. TASK-21E measures and TASK-21F contractual authority remain separate. **STOP. David must approve a bounded implementation and resolve the first-slice authority/source decisions before TASK-21D migrations or code begin.**
