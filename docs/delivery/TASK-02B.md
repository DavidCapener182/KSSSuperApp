# TASK-02B proposal — personnel evidence review and replacement

**Status:** approved by David and implemented in the dedicated development project on 23 September 2026. TASK-02A at `0f33583` is the accepted Phase 02 document foundation. See `TASK-02B-REPORT.md` for executed checks and remaining gates.

## 1. Outcome and boundary

Prove one synthetic journey: Staff A's submitted Version 1 is reviewed by its authorised Office requester, rejected with actionable feedback, and retained; Staff A submits Version 2 using a fresh immutable object; Office reviews that exact version and accepts it **as evidence**. The Staff and Office views show the decision and the relevant version. Staff B and Operations still cannot discover the request, decision, metadata or bytes.

The language and data model must preserve:

> Evidence accepted ≠ requirement verified ≠ employee compliant ≠ eligible for deployment.

No `APPROVED`, `VERIFIED`, `COMPLIANT`, `SAFE` or deployment-ready state is introduced. Evidence review does not change `scan_state=NOT_SCANNED`. The UI must keep that warning visible beside downloaded/submitted files. Review is based on the existing protected attachment download; no inline preview.

This task remains synthetic-only. No real personnel evidence, SharePoint, Entra, notifications engine, email/SMS/push, onboarding/eligibility calculation, live pilot or production deployment. Do not rewrite or squash the five accepted 02A migrations. Migration consolidation is a later pre-production decision.

## 2. Existing facts that constrain the design

- `document_requests.status` currently records `REQUESTED` or `SUBMITTED` and its `submitted_at` records the first submission. `document_versions.upload_state` records `PENDING_UPLOAD` or `SUBMITTED`; version metadata, hash, key and submitted rows are guarded against mutation. There is one logical `documents` row per request.
- Current upload RPCs intentionally create only Version 1 while the request is `REQUESTED`. Current display/download logic selects a submitted version and has no review record. These are the narrow points an additive 02B migration and routes must extend.
- The 02A record audience is the target Person, original requester while their Office role is active, and Super Admin. Site is optional creation context, never a document audience. Storage RLS permits direct authenticated download only for the same authorised submitted version; server download checks remain required.
- `audit_events` is an attributable security/change ledger. It is not a suitable sole source for the current business decision because JSON audit rows do not by themselves enforce one terminal decision per version or typed reason/version relationships.

## 3. Proposed business model and exact states

Add one typed `document_reviews` business table. Each row is a terminal, immutable decision about **one submitted `document_versions.id`**:

| Field | Rule |
|---|---|
| `id` | Database-generated UUID; stable decision ID. |
| `request_id`, `document_id`, `version_id` | Foreign keys with a database guard that proves this version belongs to this document and request. `version_id` unique: at most one terminal decision per version. |
| `reviewer_person_id` | Stable `people.id`, resolved from current AuthIdentity; never the Supabase Auth user ID or a browser-supplied reviewer. |
| `decision` | Controlled `ACCEPTED_AS_EVIDENCE` or `REJECTED`. These are evidence decisions only. |
| `reason_code`, `reviewer_comment` | Required for rejection as below; null reason for acceptance. Comment is bounded, stripped of controls, and shown to the affected Staff Person. |
| `decided_at` | Database timestamp. No client-set or editable decision time. |

Initial controlled rejection reasons proposed: `UNREADABLE`, `WRONG_DOCUMENT`, `INCOMPLETE`, `EXPIRED_OR_OUTDATED`, `DETAILS_DO_NOT_MATCH`, `OTHER`. **Every rejection requires a short 10–500-character actionable comment**; `OTHER` still has its structured code. Office must avoid unnecessary personal detail in feedback. Acceptance needs no reason and may have no comment in this slice. Do not treat the reason code as a compliance finding.

Keep the existing persisted request state narrow:

| Layer | Proposed meaning |
|---|---|
| `document_requests.status` | `REQUESTED` until first successful submission, then `SUBMITTED` as “this request has submission history.” Its existing `submitted_at` remains the first-submission timestamp. Do not reuse it as current review status or reset it on rejection. |
| `document_versions.upload_state` | Per-version `PENDING_UPLOAD` → `SUBMITTED`. `scan_state` remains `NOT_SCANNED`. A replacement gets a new row, next version number, new random object key and its own submitted time. |
| `document_reviews.decision` | The immutable terminal result for that exact submitted version. No review row means awaiting review. |
| Display/current workflow state | Derived from the highest version number and its decision: no version = **Requested**; pending upload = **Upload pending** internally, with the prior submitted decision still visible; latest submitted/no review = **Submitted — awaiting review**; latest rejected = **Rejected — action required**; latest accepted = **Evidence accepted**. Never derive an employee-compliance result. |

The current evidence version is the highest submitted version. History includes every submitted version and its decision; a pending replacement is separately identified and never displayed as submitted. A rejected Version 1 remains rejected even after Version 2 arrives. An acceptance on any prior version never transfers to a replacement. Once the latest version is `ACCEPTED_AS_EVIDENCE`, 02B offers no further upload; a future reopening/replacement policy needs another task.

## 4. Authority and transaction rules

**Office Admin** may list the review queue, download, and decide only requests where `requester_person_id` is their current stable Person ID and their `OFFICE_ADMIN` role remains active. Office B cannot gain review rights from its role alone, a SiteAssignment, a guessed ID or an altered request payload. Changing a SiteAssignment after request creation does not silently change the request audience. The reviewer cannot be the target/uploader Person, even if that Person also has an Office/Super role.

**Super Admin** may review any synthetic request subject to the same self-review prohibition. The server and database record the actual reviewer Person and append a minimal `audit_events` row. This privileged authority does not grant ordinary browser clients table writes or a Storage bypass.

**Security Staff** may read their own decision/history and the feedback intended for them. They cannot decide, change a reviewer, edit/delete a decision, write `audit_events`, or erase rejected evidence. After their latest submitted version is rejected, they may submit exactly one next version through the same bounded, proof-guarded, user-scoped upload path. Their role must be active on each action.

**Operations, anonymous, unmapped and expired-role identities** have no review capability. A second role grants only its own precisely defined action. Navigation remains Office/Staff/Super Admin Documents only.

Propose one transactional `review_document_version` RPC or equivalent guarded database operation, called only after a server route resolves the principal and checks `DOCUMENT_EVIDENCE_REVIEW`. The database independently rechecks the active reviewer role, exact request audience, non-self-review, version/request/document relationship, `SUBMITTED` upload state, latest-version rule and absence of a prior decision under a request/version lock. It inserts `document_reviews` and a minimal `audit_events` entry atomically. Duplicate review attempts return an explicit conflict (HTTP 409); no silent change from accepted to rejected or the reverse. Never update/delete a decision row. The comment/reason must be validated on server and in database constraints.

For resubmission, modify the existing guarded begin/finalise logic additively so it can create Version `n+1` only when latest submitted Version `n` has a `REJECTED` decision. Lock the request before allocating the next number. Repeated same-file retry of the single pending attempt returns its existing ID/key and checks exact bytes/hash; an altered attempt conflicts. A successful new finalisation does not mutate Version 1, its review, hash, key or Storage object. The request's `SUBMITTED` history flag need not change. Update the 02A stale-pending cleanup only as needed to recognise synthetic replacement attempts without touching any submitted/rejected object or audit record.

## 5. Database, RLS, Storage and audit proposal

Prepare **one additive 02B migration only after approval**. Expected objects: `document_reviews`, primary/foreign/unique/check constraints, a request/version lookup index, review immutability guard, record-scoped read policy, an explicit authenticated SELECT grant, guarded review and replacement functions, minimal `audit_events` entity/check extension for review IDs, and the smallest necessary change to 02A upload guards/functions. Ordinary authenticated roles get **no direct INSERT/UPDATE/DELETE** on `document_reviews` or `audit_events`. SECURITY DEFINER entry points use a fixed search path and narrow grants; direct RPC calls must perform the same authoritative checks as the application route. Record-read RLS should reuse the request audience predicate, with classification as an additional restrictive gate.

Storage bucket remains private with the same 5 MiB and PDF/PNG/JPEG allowlist. Existing submitted-version download authorization must continue to cover historical Version 1 for its legitimate audience, including after rejection. Pending Version 2 remains unavailable as a submitted download. The upload/cleanup policies should recognise only the authorised pending Version 2 key and must not introduce bucket listing, public URLs or a broad SELECT. Direct authorised Storage retrieval remains technically possible under RLS, so application-route download audit is not exhaustive. No service-role/browser secret.

Use `document_reviews` for typed business decisions and `audit_events` for attribution of review insertion and any privileged mutation. Audit only IDs, decision code, actor and timestamp; avoid bytes, hash, object path, token and unnecessary filenames/comments in audit JSON. Review feedback is in the protected business row, not an audit payload. Keep existing 02A creation/submission/read/cleanup history intact.

## 6. API and usable UI proposal

Within `/documents` and `/documents/[requestId]`, add an Office/Super Admin **review queue** with scoped Person display name, request title, submitted date, derived current state and a clear link to the exact version. The current schema has a request title but no controlled document-kind field; do not invent a kind taxonomy in the UI. If a kind becomes necessary for the review queue, propose its smallest controlled values for a separate explicit decision before migration. Offer protected attachment download, **Accept as evidence** and **Reject evidence** actions only for the latest submitted, undecided version. Rejection opens a reason selector and required comment field; the confirmation names the version and outcome. Show review history with version number, decision, reviewer and date. The queue must not become a broad People search or document explorer.

The Staff view shows Requested, Submitted — awaiting review, Rejected — action required with permitted reason/comment, or Evidence accepted. After rejection it offers replacement upload and shows that Version 1 remains historical. A new upload displays pending/failure/retry states honestly. Each version has a protected attachment download if the person remains authorised. No UI text implies scanning, validity, compliance or deployment eligibility.

Build the smallest reusable Phase 02 primitives **inside the existing shell**: record/page header, status badge with text, labelled field/error/feedback pattern, primary/secondary/caution action hierarchy, confirmation dialog, responsive queue/list and mobile card, and empty state. Reuse them across Office and Staff Documents. Keep keyboard focus visible, labels/field errors programmatic, dialogs focus-managed, status announcements accessible and the 390px view free of page-wide overflow. Do not redesign Sites or add future module navigation.

The current state appears on next page/request load. No new notification table, inbox, email, SMS or push.

## 7. Acceptance and negative-access plan

The approved implementation should execute a full synthetic journey in the browser:

1. Office A creates a request; Staff A submits Version 1; Office A downloads Version 1 and the bytes/hash match.
2. Office A rejects Version 1 with a controlled reason and comment; Staff A sees the rejection and action required.
3. Staff A submits Version 2; Version 1's object/hash, decision, reviewer and audit remain intact. Version 2 has a different ID, key and next version number.
4. Office A downloads/reviews Version 2 and accepts **that version** as evidence. Staff A sees Evidence accepted and a visible not-scanned/non-compliance boundary.
5. Staff B and Operations cannot discover metadata, review history or bytes. Test Office/Staff desktop and 390px views, keyboard/labels, errors and empty states.

Automated tests must also prove:

- Staff cannot accept/reject their own evidence or forge reviewer/decision fields; Staff B cannot read Staff A's decision, filename, hash, object or bytes.
- Office B cannot review Office A's request by changing request/document/version IDs. SiteAssignment alone never grants review or document access. Operations, anonymous and unmapped identities cannot review/retrieve.
- A decision cannot target a version from another request, a pending version, or an older version once a newer version is current. Self-review is denied for every role.
- Decisions are immutable; accepted cannot become rejected, rejected cannot become accepted, and a Version 1 decision does not follow Version 2. Duplicate review requests conflict predictably.
- Expiring the reviewer role removes queue, route, RPC and RLS authority on the next request. Direct authenticated database/RPC and Storage calls obey the same boundary. Ordinary browser clients cannot write `document_reviews` or `audit_events` directly.
- Wrong replacement key, forged proof, repeated/concurrent attempts and Storage-success/database-failure retry do not overwrite or create duplicate submitted versions. Failed/pending replacement does not appear accepted or submitted.

Run clean install, lint, webpack build, smoke, all Phase 01 and 02A regressions, new business/RLS/Storage tests, source-controlled migration and bucket/policy readback, staged secret scan, browser demonstration and a bounded independent GPT-6 Sol security review. Record tests actually run and any interruption separately.

## 8. Gates, routing and stopping point

Routine implementation should use the economical available lead model under the approved routing policy, with one bounded Sol review of private review authority. No GPT-6 Astra without David's explicit approval. The existing transient development Supabase Auth fetch interruption stays a monitoring item.

**No real personnel documents yet.** Before any live evidence, separately decide and test malware scanning, retention/deletion, production secret/key management, backup/recovery, pilot environment, privacy/data-protection controls and operational ownership/support. No Office or Staff hard-delete control in 02B. Retain submitted and rejected synthetic files during this proof.

**Implementation boundary:** this approval covered synthetic review and replacement only. TASK-02C, live evidence, integrations and deployment remain outside this task.
