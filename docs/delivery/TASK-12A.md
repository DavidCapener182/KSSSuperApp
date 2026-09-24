# TASK-12A proposal — Incident / Occurrence Reporting Foundation

**Status:** David approved a bounded synthetic-Dev implementation on 24 September 2026, including the Incident Reviewer grant rule below. No staging change, deployment or real-data import is authorized. The status entry naming TASK-07B predates this separate TASK-12A approval. TASK-09A close-out remains with its owner.

**Purpose:** Propose a small native KSS record for a factual operational incident or occurrence, with exact optional context links, an attributable report and a narrow follow-up lifecycle. The first slice is not a general case-management, HR, disciplinary, safeguarding, medical or police-investigation system.

Use synthetic examples only. Do not add live data, protected staging writes, external services, notifications, client access, patrol execution or inferred conclusions. No green in the UI.

## First-slice boundary

Include one stable Incident UUID, authenticated KSS reporter Person, occurrence time and separate server-recorded time, one controlled high-level category, a short factual account, optional exact operational context, optional minimally described external parties, attributable follow-up actions, append-only corrections/history, and a scoped operational queue/detail view. The user reports what they observed or were told, with the source stated; the product does not decide truth, fault or intent.

Keep the first release small. Do not add a configurable incident taxonomy, investigation workflow, case assignment engine, risk score, priority/SLA clock, discipline, misconduct, guilt, criminality, qualification or readiness inference, medical record, safeguarding case, police case, witness statement workflow, claims/insurance, attendance/payroll consequence, client portal, automated escalation or AI classification. The category is a routing/report label only.

Proposed controlled categories:

- `SAFETY_HAZARD` — an observed condition or near miss concerning immediate operational safety.
- `INJURY_OR_ILLNESS_REPORTED` — an occurrence involving a reported injury or illness; store no diagnosis or treatment detail.
- `SECURITY_OCCURRENCE` — a factual security-related occurrence without inferring intent or criminality.
- `PROPERTY_DAMAGE_OR_LOSS` — reported damage, loss or missing property.
- `SERVICE_DISRUPTION` — an operational interruption or service issue.
- `OTHER_OPERATIONAL` — a factual operational occurrence that does not fit the above.

Do not capture severity or priority in this slice: there is no approved KSS impact scale, triage owner, response target or escalation policy. If a future approved policy adds one, define observable thresholds and state clearly that it is not a finding about blame, likelihood or individual fitness.

## Stable identity and exact context links

Propose an `incidents` record with immutable UUID `id`, `reporter_person_id`, `occurred_at` (the reported instant the occurrence happened), database-derived `recorded_at` (when KSS accepted this version), a display timezone of Europe/London, controlled `category`, factual `narrative`, lifecycle projection, optimistic `revision`, and creation provenance. Resolve reporter Person from the authenticated session; never accept a caller-selected reporter identity. Keep the occurrence time distinct from server receipt time and preserve the reporter's original local date/time and timezone/offset when needed to explain ambiguous DST times. Reject invalid/nonexistent local times and require explicit choice for a repeated wall time; never silently change the reported instant.

Context links are optional and independently typed. Candidate exact columns are `event_id → operational_events.id`, `site_id → sites.id`, `site_service_id → site_services.id`, `event_allocation_id → event_staff_allocations.id`, and `site_shift_allocation_id → site_shift_allocations.id`. Validate names against delivered schema before any implementation. Do not use an unconstrained `source_type + source_id` pair.

Validation must prove that every supplied link exists, the caller can access that exact record for the requested action, and links agree:

- Event allocation resolves through its requirement to the same Event and Site when those context IDs are also supplied.
- Site-shift allocation resolves through its exact `demand_id` to the same `site_services.id` and Site when supplied.
- A Site Service resolves to its immutable `site_id`; do not copy Client or organisation scope as a second authority.
- An allocation can be linked only through its exact typed FK. Do not infer an allocation from a Person, date, Event name, demand label or Site.
- If both allocation columns are populated, reject the record. One occurrence may cite an Event context or Site Service context, but a future cross-context report needs an explicit approved relationship rather than caller-supplied IDs.
- Do not let an optional broad Site/Event link grant access to a linked private report. Recheck every linked source and Incident permission on each read/action.

Context-free Staff reports are permitted. Requiring an Event, Site Service or allocation would block legitimate reporting. Where context is known, Staff may select it from an exact authorized selector; they may not enumerate or discover records outside their own permitted context. The Operations queue must still apply a separately approved Incident scope to context-free reports.

## People and factual narrative

Reporter is one exact KSS `people.id` resolved by the server. External people involved must not be created or linked as KSS People. Use a small `incident_external_parties` child with stable UUID, incident FK, controlled relationship label (`MEMBER_OF_PUBLIC`, `CLIENT_REPRESENTATIVE`, `CONTRACTOR`, `WITNESS`, `OTHER`), and a short neutral descriptor when needed (for example, “male wearing blue jacket”). Never collect phone, email, address, DOB, identity data, contact details or a KSS Person match. Do not store a witness statement or sensitive narrative about an external person here.

Use plain guidance beside the narrative: record what was seen/heard, distinguish direct observation from information reported by someone else, include relevant time/place, and avoid speculation or unnecessary personal data. Do not ask for blame, motive, diagnosis, protected characteristics, immigration/SIA details or criminality. Do not write medical details into generic incident or `audit_events` records. A short factual report is not proof or a finding.

Show this emergency guidance before report entry: “KSS Enterprise incident reporting is not an emergency service. If there is an immediate risk to life or safety, follow the site’s emergency procedure and contact the appropriate emergency service before completing this report.” Do not invent or display a KSS safeguarding referral route until its actual process is established. This report must not collect safeguarding case facts or detailed medical information.

## Follow-up lifecycle and immutable corrections

Propose a narrow derived lifecycle with typed, append-only business events:

| State | Meaning |
|---|---|
| `OPEN` | Submitted and awaiting an authorised operational review. This does not mean the report is verified. |
| `ACKNOWLEDGED` | An authorised reviewer has recorded receipt. It is not a finding or risk rating. |
| `ACTION_RECORDED` | A reviewer recorded an operational action or referral in the approved minimal action vocabulary. |
| `CLOSED` | An authorised reviewer closed this operational follow-up. Closure does not mean the narrative was proven or all external work concluded. |
| `REOPENED` | An authorised reviewer reopened a closed report with a mandatory reason. History preserves both the prior closure and the reopen. |

Every transition records event UUID, Incident UUID, prior/new revision, controlled event kind, actor Person, database `recorded_at`, and reason where the transition requires one. The lifecycle is `OPEN → ACKNOWLEDGED → ACTION_RECORDED → CLOSED`, with `CLOSED → REOPENED` requiring a reason. No edits or deletes to submitted report versions/events. Corrections append a typed event referencing the exact prior report revision, the corrected field(s), reason and author. The original remains readable to authorized users, with a clear superseded/corrected marker; correction never erases source text. Do not send a notification or create a Task in this slice.

The controlled action vocabulary should stay operational and non-punitive, for example `AREA_MADE_SAFE`, `DUTY_MANAGER_CONTACTED`, `SERVICE_CONTINUED_WITH_CONTROL`, `SERVICE_PAUSED`, `EXTERNAL_PROCESS_REFERRED`, `FOLLOW_UP_REQUIRED`, `OTHER_OPERATIONAL_ACTION`. A brief factual action note may be allowed only after privacy review. Do not record discipline, a person's blame, diagnosis, police outcome or case decision as an action state. If an immediate action is described, capture actor/time and whether it is reported or directly observed; do not imply KSS verified it.

## Record/action scope by role

All access is server-enforced per action and exact record, with RLS/guarded database operations as defence in depth. Role name alone is insufficient. Identity, active role, operational scope and source-link consistency are rechecked at submit, list, detail, history, correction, follow-up and export/report time.

- **Security Staff:** may create a report as self and read their own original submitted report, its applicable correction history and current lifecycle status. They do not see restricted management follow-up notes, peer reports, external-party descriptors or an operational queue. Staff cannot change or close a submitted report.
- **Operations:** owns ordinary operational review for the first slice. Incident access requires both an active `OPERATIONS` role and a separate active `INCIDENT_REVIEWER` grant. The first synthetic-Dev grant is organisation-wide for operational incidents so context-free reports enter the same queue. An ordinary Operations role, SiteAssignment, Event ownership, Site creator ownership, Workforce visibility or work-role label grants nothing by itself. Check both conditions again on every queue, detail and action request; role expiry/revocation or grant expiry/revocation removes access immediately. The grant is tied to stable `people.id`, time-bounded, attributable, reasoned and revocable only through a guarded Super Admin operation. Do not build a general permission engine or site/region/team scopes.
- **Office Admin:** receives no blanket Incident detail access. Office role, Site creation/ownership and CRM access do not grant incident authority.
- **Super Admin:** has attributable synthetic-Dev oversight and manages Incident Reviewer grants through guarded, immutable/audited operations. Detail reads and actions must be attributable; do not create an unaudited universal bypass. This does not authorize staging/live access.
- **Anonymous, expired, unmapped or out-of-scope identity:** deny detail, counts, search, filters, export, history and mutation. Use generic denial responses that do not confirm guessed UUID existence.

Do not put report narrative, names or sensitive content into URLs, client logs, analytics, error strings, search indexes, generic audit JSON or notification payloads. Record privileged read/action metadata (actor, record ID, action, purpose, timestamp) only where approved; do not duplicate sensitive text in audit history.

## Attachments and evidence boundary

No attachment upload, file link or viewer is part of the first slice. Photos, CCTV, medical information and statements require a separately designed evidence/privacy system. Do not accept public URLs or file contents in the narrative.

## Retention and privacy gates

The lawful purpose, final retention period, deletion/legal-hold process, controller/processor roles, subject-rights handling, special-category data policy and safeguarding referral workflow remain pre-live gates. Synthetic Dev does not require inventing a KSS legal retention duration. Do not load real Incident data until the policy is approved; do not claim the synthetic implementation resolves that gate.

## Safe reports and aggregates

No analytics, dashboards, aggregate reporting, export or incident counts beyond the authorized operational queue/detail are in the first slice. Reporting design is deferred to a separate task and privacy decision.

## Mobile-first report flow and recoverable errors

At 390px, a focused report flow should use one readable column and a clear step order: (1) emergency guidance, (2) occurrence date/time, (3) category, (4) optional exact context selector or no context, (5) factual narrative and privacy reminder, (6) optional external-party relationship/neutral descriptor, (7) review and submit. Keep labels, help and validation visible without horizontal scrolling; use keyboard/screen-reader labels, visible focus, accessible error summaries, touch-sized controls, touch-sized actions, non-colour status text and a persistent submit state. Operations queue/detail must work on desktop and 390px. Use the established iOS-inspired shadcn/ui semantic blue, graphite and neutral palette; absolutely no green.

Reports are submitted online only. Do not persist sensitive unsent narratives in browser local storage, service-worker cache or an offline queue. If connectivity drops before confirmation, state clearly that KSS has not confirmed receipt and provide a safe retry. Use a client-generated idempotency UUID bound server-side to reporter and canonical request hash: retry of the same payload returns the original Incident; reuse with a different payload is rejected. After an ambiguous timeout, re-read only the reporter's own idempotency result. Do not suggest an unsaved draft has been filed. If the page reloads, explain that an unsubmitted report may be lost; avoid browser unload prompts that expose the text. Submission and correction use optimistic revision checks, stale-write conflicts with a fresh read, and transactionally append the business event plus generic audit metadata. Concurrent duplicate submissions cannot create duplicate records; conflicting edits never overwrite history.

## Audit, negative tests and acceptance evidence

Before a future implementation can be accepted, synthetic tests must establish at minimum:

- Correct reporter Person is derived from Auth; spoofed actor/Person IDs, expired role, anonymous access and role-only authority are denied.
- Event, Site, Service, Event allocation and Site-shift allocation links validate exact identities and parent consistency; cross-source IDs, wrong parent IDs, deleted/unknown IDs and out-of-scope links are denied without existence leaks.
- Staff cannot enumerate or retrieve peer incidents through direct IDs, list totals, search, facets, pagination, export, history or alternate routes; manager scope cannot be widened by linked context or a private file.
- Office, Operations and Super Admin actions each enforce explicit record/action/purpose scope. No role silently grants broad incident or special-category access.
- Direct table writes and history mutation/deletion are denied; all accepted edits are append-only corrections with actor, reason, exact prior revision and stable Incident ID.
- Simultaneous submissions, duplicate idempotency retries, altered-payload key reuse, concurrent correction/status changes and stale revisions do not duplicate, lose or rewrite records.
- `occurred_at` remains distinct from server `recorded_at`; DST gaps/repeated times and timezone display are deterministic and preserve the reported instant.
- Sensitive narrative/external-party content is absent from generic audit payloads, logs, URLs, search, dashboards, client payloads and error messages; no attachment link inherits Incident audience.
- The first implementation contains no analytics, dashboards, aggregate reports, export or report counts beyond the scoped operational queue.
- Emergency, safeguarding and medical boundary copy is visible and accessible; there is no offline claim, automatic escalation, notification, HR finding or implied completion.
- Desktop and 390px flows are usable with keyboard and assistive technology, clear online retry/idempotency state and no horizontal overflow; semantic colors contain no green.

An implementation report must record actual schema/grant/RLS readback, focused security and concurrency evidence, browser/mobile evidence, accessibility and no-green review, regression results and unresolved evidence gaps. Tests or synthetic Dev evidence do not establish production readiness or human acceptance. This proposal itself runs no tests and creates no report artifact beyond this document.

## Remaining implementation boundary

David approved: context-free reports; minimal external-party relationship plus neutral descriptor; Staff own-report/status/correction read; Operations ordinary review within authorized scope; attributable synthetic-Dev Super Admin oversight; no blanket Office access; the stated lifecycle including reasoned reopen; no severity, attachments, notifications, Tasks or analytics; no medical-detail, safeguarding-case, disciplinary, misconduct, police-investigation or HR workflow; the supplied emergency message; and retention as a pre-live gate. The requested vertical proof is Staff report → authorized Operations queue → acknowledge → operational action → close → Staff status → correction/reopen history.

The Operations scope rule is settled: active Operations role plus a separately granted, active, time-bounded `INCIDENT_REVIEWER` grant; in this first synthetic slice it is organisation-wide for Incident review. Do not infer this authority from any other existing assignment or product access. Implement the above proof in synthetic Dev only; no staging. Create `TASK-12A-REPORT.md`, commit TASK-12A-owned files separately and stop for David's acceptance.
