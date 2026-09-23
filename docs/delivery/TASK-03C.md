# TASK-03C proposal — Controlled document publication and Staff acknowledgement

**Status:** approved by David and implemented in the dedicated synthetic development project on 23 September 2026. Evidence and remaining gates are in `TASK-03C-REPORT.md`. TASK-03B was accepted at `2177fb1`.

## 1. Outcome and boundary

Add a reusable **controlled published document** primitive and use it for one synthetic Contract / Terms acknowledgement in Staff A's existing Template V2 onboarding case. An authorised Office publisher publishes an exact file version; the scoped Office case owner assigns that version to the Contract requirement; Staff A can access it and explicitly acknowledges it. The immutable acknowledgement, rather than an Office approval or document review, fulfils that requirement. The demonstrated case can move from **3 of 6** to **4 of 6 requirements complete** and remains `IN_PROGRESS`.

This is **not** an electronic signature, contract execution, proof of reading/comprehension, employment acceptance, compliance decision or deployment eligibility. The UI should say **Acknowledged**, never **Signed**. Use a clearly synthetic file titled **KSS Development Terms Acknowledgement v1**, with synthetic content and a visible development-only label. No real KSS contract or policy is imported.

Preserve Person ≠ AuthIdentity; private personnel evidence ≠ controlled published document; Task state ≠ business state; and evidence accepted ≠ requirement verified ≠ compliant ≠ deployable. Identity Evidence remains Not configured. Core KSS induction remains Not connected. Do not add a generic acknowledgement Task or an Office approval step.

## 2. Existing Template V2 boundary

Template V2 and its instantiated `CONTRACT_TERMS` definition currently say `CONTROLLED_ACKNOWLEDGEMENT` with provider state `NOT_AVAILABLE`. Published definitions and case requirements must not be edited to claim that feature always existed. To satisfy the requested **existing V2 case reaches 4 of 6** proof, I recommend one narrow, additive **case requirement assignment/activation** record. It names the exact V2 requirement, exact published controlled-document version, assigning Office Person and database timestamp. Before the record exists, the V2 requirement remains Not available; after valid assignment, its state derives from the assignment and acknowledgement. The original V2 definition and pre-assignment history remain reconstructable. This is an explicit 03C exception to the V2 default availability, not a silent V2 rewrite or a generic provider-state override.

Only `CONTRACT_TERMS` with `CONTROLLED_ACKNOWLEDGEMENT` may use this 03C activation. The guard must reject Identity, Training, RTW, SIA or arbitrary V2 requirements. Assignment is allowed only while the case is active and owned by the assigning Office user (or under bounded Super Admin oversight). New future starters should use a separately published Template V3 with controlled acknowledgement available by default **if KSS approves that default**; 03C need not publish V3. If KSS considers V2 `NOT_AVAILABLE` absolute for its whole lifetime, this existing-V2 4-of-6 proof cannot be implemented without a separately approved template/case transition. That choice must be resolved before migration.

The existing Staff A V2 RTW, profile and SIA records remain untouched. The assignment changes only the Contract requirement's derived availability and subsequent acknowledgement basis. It does not carry an acknowledgement from another case or version.

## 3. Proposed reusable domain model

| Record | Purpose and invariant |
|---|---|
| Controlled document | Stable document identity, category/family, synthetic title and owning publication scope. Separate from Person-specific `documents` evidence. |
| Controlled document version | Immutable numbered metadata and private Storage object identity. Draft until an authorised publish action records publisher, database timestamp, effective date, content hash, MIME type and byte size. A published version's file, title and version identity cannot change. |
| Publication/supersession event | Records exact version, actor and time. Publishing v2 makes v1 historical/superseded without deleting it or its acknowledgements. Avoid a mutable status field as the sole history. |
| Onboarding controlled-document assignment | Typed, immutable link from one case requirement and target Person to one **published** exact version, with assigning actor/time. This is the only 03C audience mechanism. Future company, Site and event audiences require separate rules. |
| Acknowledgement | Immutable business record binding Person, Staff actor Person, case, requirement, assignment, controlled document, exact version, acknowledgement type (`PRESENTED_AND_ACKNOWLEDGED`) and database timestamp. `audit_events` separately logs the action. |

Use unique constraints and foreign keys to prevent cross-Person/case/version joins and duplicate current acknowledgements. Keep the historical v1 row and object after publishing v2. No Staff-selected arbitrary document or version IDs: the acknowledge operation resolves the version from the Staff member's authorised, current assignment. A changed or revoked assignment cannot silently retarget an old acknowledgement.

For 03C, publication lifecycle is **DRAFT → PUBLISHED → SUPERSEDED**. Drafts may be edited by their authorised publisher, but each uploaded object has its own identity; a publish action seals one exact version. Publishing a correction creates a new version and never overwrites bytes. Only a published version may be assigned or acknowledged. Draft, unpublished, unassigned and arbitrary superseded versions are denied. A v1 acknowledgement made before v2 publication remains valid historical evidence; v2 publication does not create v2 acknowledgement or automatic re-acknowledgement. To avoid stranding an outstanding v1 assignment, a publisher must resolve any unacknowledged assignment before superseding v1; 03C's demonstration acknowledges v1 first and then publishes v2. Future re-acknowledgement campaigns need their own publication/assignment policy.

An acknowledgement is valid current Contract fulfilment only for the exact active case requirement and its assigned version. It records affirmative Staff action, not a server guess that the file was read. No Office or Super Admin can create the Staff acknowledgement on someone else's behalf in this task.

## 4. Publication authority and audience

The initial publisher is one explicitly scoped synthetic `OFFICE_ADMIN` (Office A), with `SUPER_ADMIN` able to grant/revoke the narrow **synthetic onboarding terms publisher** capability and exercise audited oversight. It must not make every Office user a company-wide document publisher. A suitable guard is an active, time-bounded capability assignment for document family `ONBOARDING_TERMS_SYNTHETIC`; it is separate from role and SiteAssignment. An Office user must also own Staff A's active case to assign the published version to it. Publisher capability alone does not grant onboarding case, private profile or evidence access. Case ownership alone does not grant document publication. Super Admin cannot fabricate Staff acknowledgement.

Staff A may list/access only the controlled version assigned to their own authorised case requirement and may acknowledge only that assignment while the case is active. Office A may see assignment and acknowledgement state only on cases it manages. Office B cannot gain it by guessing IDs or sharing a Site. Operations gets no private onboarding acknowledgement state or controlled onboarding file access. Future SOP, Site, event, company-policy and client audiences are **not** inferred from this first onboarding assignment model.

Enforce these boundaries in server routes **and** PostgreSQL RLS/guarded database operations. An ordinary authenticated client cannot directly insert, update or delete publication, assignment, acknowledgement or audit records. Role/capability expiry is checked at action time; cancellation blocks new assignment and acknowledgement but retains history. File access uses the same exact audience decision independently of UI link visibility.

## 5. Controlled file storage

Propose a separate **private controlled-documents bucket**, not `enterprise-personnel-evidence`. The current evidence bucket binds Staff-submitted, Person-specific `DocumentVersion` objects to evidence review; controlled publisher files have a different lifecycle and audience. The new bucket remains private with no permanent public URLs. Permit a small approved synthetic format set (initially PDF) and bounded file size, checked both before upload and at finalisation. Every uploaded version uses an opaque, unique object key, recorded with hash, byte size and MIME type. No ordinary UPDATE/DELETE of published objects. A subsequent version gets a new key; never overwrite v1. The approved viewer/download path must verify exact assignment and active audience server-side and in Storage policy, then provide a short-lived authenticated access path. Neither knowledge of an object key nor a copied URL widens access. Audit sensitive file access using IDs, not contents.

The existing real-data gates for malware scanning, retention/deletion, privacy, production secrets, backup/recovery and operational ownership remain open. For the synthetic proof, show `NOT_SCANNED` or an equally honest development-only state where applicable; do not represent the controlled file as production-safe. Do not create this bucket before 03C approval.

## 6. Staff and Office experience

**Staff My Onboarding:** replace the V2 Contract row's Not available presentation only after its exact assignment exists. Show synthetic document title, version, published/effective date, protected View/Download action, and a clear statement: **“I confirm that this exact document version was made available to me and I acknowledge it.”** The action requires a deliberate unticked confirmation and authenticated submit. A View/Download click can be recorded as access, not comprehension; the UI must not claim that every word was read. After submission show **Acknowledged** with exact version and acknowledgement time. Include a clear next action while outstanding and feedback for expired/cancelled assignment or failed download. Keep the profile, RTW and SIA states intact.

**Office scoped starter:** show the assigned published version, publication and effective dates, Staff access/acknowledgement state and exact Staff Person/version/time after acknowledgement. A narrowly scoped publication view allows authorised Office A to create a synthetic draft, upload, preview, publish and later create v2. Office A can assign v1 only to its owned active case; it cannot tick acknowledgement or edit Staff's record. Use existing headers, responsive cards, status badges, feedback and confirmation patterns. Do not redesign the full app.

Progress counts a current acknowledgement as one Contract requirement completion: 4 of 6 after Personal Details, RTW, SIA and Contract. Identity stays Not configured, induction Not connected, and case In Progress. No deployability or compliance label appears.

## 7. Bounded implementation shape if approved

Use additive source-controlled migrations for controlled-document/version/publication, narrow publisher capability, exact case assignment, immutable acknowledgement, constraints/indexes, RLS/guards, Storage bucket/policies and audit. Extend derived onboarding state and Staff/Office views, with guarded server publication/upload/access/assignment/acknowledge routes. Reuse existing stable Person, onboarding ownership, audit and UI primitives. Keep personnel evidence tables, review Tasks and requirement-verification business rows unchanged. An acknowledgement is its own business decision, not an `onboarding_requirement_verifications` row pretending Office reviewed it.

If implementation needs a broad company document library, multi-audience engine, e-signature, general notification/Tasks, external signing provider or a material redesign of accepted case versioning, stop for further approval.

## 8. Required implementation proof

**Positive journey:** confirm Template V2 Staff A is at 3 of 6; Office A with explicit publisher capability creates and publishes the synthetic Terms v1; Office A assigns exact v1 to the existing active V2 Contract requirement; Staff A sees its title/version/date and securely opens the exact file; Staff A deliberately acknowledges; an immutable exact-version business row and separate audit event exist; Contract becomes Acknowledged and case becomes 4 of 6 while In Progress. Office sees Person/version/time without an approval action. Publish v2 after v1 acknowledgement and read back unchanged v1 bytes, metadata, assignment and acknowledgement, with no automatic v2 acknowledgement. Identity and induction remain outstanding. Demonstrate Staff and Office at desktop and 390px.

**Negative tests:** Staff B cannot read or acknowledge Staff A's assignment; Staff A cannot forge document/version/Person/case IDs, acknowledge a draft/unassigned/arbitrary superseded version, or edit/delete the acknowledgement. Office cannot forge Staff action; Office B and Operations cannot read the private case/acknowledgement/file; SiteAssignment grants no access. Publisher role/capability expiry denies publish/assign; case cancellation denies new acknowledgement. Direct table/RPC/Storage writes cannot bypass authority; ordinary clients cannot write audit events. Published v1 metadata/bytes cannot be overwritten, and v2 cannot rewrite its acknowledgement. Supersession with an outstanding v1 assignment must be denied or explicitly resolved. Exact version binding, duplicate/idempotent action and concurrent publish/acknowledge races must be tested.

**Regression and checks:** clean install, lint, webpack build, smoke, all Phase 01/02/03A/03B suites, new controlled-document server/RLS/Storage/business tests, migration/object and audit readback, staged secret scan, desktop/390px Staff and Office browser demonstrations, and one bounded independent Sol review of publication, file audience and acknowledgement integrity. Continue economical routing; no GPT-6 Astra without David's explicit approval.

## 9. Deferred work and decisions for approval

Identity Evidence remains a required later Phase 03 task using the proven private evidence architecture. Training integration remains unknown/`NOT_CONNECTED`; controlled contract signing and legally meaningful e-signature are separate. Onboarding team queues, delegated ownership, cover/reassignment and cancelled-work presentation remain required later in Phase 03. Future company/Site/event controlled-document audiences, policy re-acknowledgement campaigns and Staff reminders/Tasks require their own approved rules.

Before implementing 03C, confirm **(1)** the explicit case-specific V2 Contract activation above versus a new Template V3 case, **(2)** Office A's narrow publisher-capability grant and Super Admin authority, **(3)** whether View/Download must precede acknowledgement (recommended for UX, with no reading claim), and **(4)** the synthetic document content/retention approach. These are business policy decisions, not permission to infer real contract or live document rules.

**Stop here for approval.** No tables, bucket, onboarding changes, acknowledgements, real data, integrations or deployment in this proposal task.
