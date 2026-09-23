# TASK-03D proposal — synthetic Identity Evidence fulfilment

**Status:** approved by David and implemented in the dedicated synthetic development project on 23 September 2026. See [TASK-03D-REPORT.md](TASK-03D-REPORT.md) for the executed checks, browser proof, migration and remaining gates. TASK-03C was accepted at `0ea567c`.

## 1. Outcome and boundary

Make the existing `IDENTITY_EVIDENCE` requirement on Staff A's **existing Template V2 onboarding case** functional through the accepted private personnel-document workflow. Office A issues a case-bound request; Staff A submits a clearly synthetic file; the existing `DOCUMENT_REVIEW` Task and document-review decision handle evidence; Office then makes a **separate exact-version onboarding verification**. Only that last decision makes Identity Evidence `VERIFIED`.

The target case begins at **4 of 6** and, after valid verification, can show **5 of 6 requirements complete**. Core KSS induction remains `NOT_CONNECTED`, the case remains `IN_PROGRESS`, and neither the case nor its progress establishes legal identity, compliance or deployment eligibility. The proposal is deliberately limited to one requirement and one existing case. It does not add an identity-document service, new bucket, new review queue, new Task type or general verification framework.

## 2. Current architecture and the small required change

Template V2's published `IDENTITY_EVIDENCE` definition currently has `fulfilment_kind = NOT_CONFIGURED` and `provider_state = NOT_CONFIGURED`. Its instantiated case requirement already has a nullable, unique `document_request_id`. RTW uses that same link. The database guard currently permits linking a request only when the definition code is `RIGHT_TO_WORK`; the verification guard also admits only RTW (with a separate SIA extension). The read model consequently displays Identity Evidence as Not configured before it considers document state.

**Recommended activation:** retain the immutable V2 definition and use the existing case requirement's one-time `document_request_id` link as the narrowly typed, case-specific activation. A new guarded `issue_onboarding_identity_request(case_id)` operation creates the protected `DocumentRequest` and links it to the **exact V2 `IDENTITY_EVIDENCE` requirement in one transaction**. The request's database `created_at` and the existing attributable audit entry establish when this capability became available to that case. No general provider-state override or new activation table is needed unless implementation inspection finds that this one-time link cannot preserve the required history; a materially broader design would return for approval.

The additive migration should narrowly amend the existing requirement-link guard to accept this Identity Evidence link only when the case is active, the requirement is the exact V2 Identity instance, its published definition remains `NOT_CONFIGURED`, and the request matches the case Person, original Office owner and Site context. RTW behaviour stays as accepted. The link cannot be changed after assignment. Template V1/V2 definitions and historical requirements are not updated. This activation rule must not apply to Training, Contract, SIA, RTW or future codes by implication.

## 3. Evidence request and review

Original active `OFFICE_ADMIN` case owner Office A issues the request. It names Staff A as target and the synthetic Site only as context. The guarded operation checks case ownership and active role at action time, rejects Staff self-request, and returns the existing linked request idempotently on a repeat call. Super Admin may oversee the case but does not need a new ordinary request path in this proof. Case ownership and document-requester identity must remain consistent.

Staff A follows the existing protected Documents destination to submit a synthetic PDF or image. `DocumentVersion` is immutable; private Storage byte access stays under the existing Person/request audience checks. A submission creates the existing `DOCUMENT_REVIEW` Task for the authorised Office reviewer. Office accepts or rejects the **latest exact version** through the existing review UI. Rejection feedback and replacement use the existing flow. The Task reflects the document decision, never the onboarding verification. No Staff-initiated arbitrary request, new upload route, bucket, Storage policy, review table, Task adapter or audit mechanism is proposed.

The synthetic fixture should plainly say **“Synthetic development identity evidence — not a real identity document.”** It contains no real name, photograph or identity number and does not resemble a passport, driving licence or national ID card. `NOT_SCANNED` remains an honest file-safety state. File format and size use the existing personnel-evidence limits.

## 4. Separate requirement verification

Reuse `onboarding_requirement_verifications` as the immutable business record. Add one narrowly guarded Identity Evidence verification operation, separate from the RTW and SIA operations. It accepts the exact case, requirement and accepted `DocumentVersion`; the database records target Person, verifier Person, decision and timestamp. It must verify the requirement's linked `DocumentRequest`, target Person, original Office requester, private document, latest submitted version and exact `ACCEPTED_AS_EVIDENCE` review. Pending, rejected, stale or cross-linked versions fail.

The existing verification trigger must be extended **only** for `IDENTITY_EVIDENCE` with this valid case-level request link. Its RTW/SIA rules remain intact. Identity Evidence has **no synthetic expiry date** in 03D: reject a non-null `synthetic_valid_until` for this code. The result means only that the authorised Office verifier made a synthetic workflow decision against an exact evidence version. It does not authenticate identity, validate a real document or satisfy a legal check.

The original active Office case owner may verify. `SUPER_ADMIN` retains bounded, audited oversight. Any actor whose Person is the target is denied even if they also hold Office or Super Admin. Operations, other Office users and Staff cannot verify. The server route checks action and record scope before invoking the guarded database operation; the RPC and RLS/trigger enforce the same boundary against direct calls. `audit_events` records verification metadata but remains separate from the business decision row.

## 5. Derived state and product experience

Before the one-time request link exists, Identity Evidence stays **Not configured** with **Office needs to issue a protected request** as the next action. After activation, derive state from the linked existing document and exact verification record:

| Source state | Staff/Office requirement state | Next actor |
|---|---|---|
| Request issued, no submission | Awaiting evidence | Staff |
| Latest version submitted, undecided | Submitted — awaiting review | Office document reviewer |
| Latest version rejected | Action required, with permitted rejection feedback | Staff |
| Latest version accepted, no matching verification | Evidence accepted — Office verification needed | Office case owner |
| Matching exact latest accepted version verified | Verified — synthetic workflow decision | None |

Do not persist another editable status flag or count the file upload, acceptance or Task `DONE` as completion. A replacement after rejection is a new version with its own review; no earlier rejected state or decision carries forward. Case cancellation blocks new normal request, upload, review and verification actions while retaining history. Active-role expiry removes Office verification authority. SiteAssignment alone grants no onboarding, metadata or byte access.

**Staff My Onboarding:** reuse the requirement card, status badge, next-action text, feedback banner and protected Documents link. Show the request and rejection feedback appropriate to Staff; show accepted evidence awaiting a separate Office decision; show the final state as **Verified — synthetic workflow** without identity-authentication language. Keep the six-item progress count and blockers visible. Improve mobile spacing and empty/loading/error feedback only where this journey exposes a concrete issue.

**Office starter view:** show the request issuance action, linked document/request state, latest exact version, review outcome and a distinct verification action only when evidence is accepted and the owner is authorised. Link to the existing document-review screen/Task rather than embedding a second reviewer. Keep the hierarchy clear between **Evidence** and **Requirement**. Reuse existing cards and confirmation/feedback patterns; no general onboarding redesign.

## 6. Acceptance proof after separate implementation approval

**Positive journey:**

1. Read back the existing Staff A V2 case at 4 of 6 and confirm published V2 Identity remains `NOT_CONFIGURED`.
2. Office A issues the exact synthetic Identity Evidence request; Staff A sees it in My Onboarding and Documents.
3. Staff A submits the labelled synthetic file; the existing document-review Task opens for Office A.
4. Office A reviews the latest version as `ACCEPTED_AS_EVIDENCE`; the document Task becomes `DONE`, while Identity Evidence still says **Office verification needed**.
5. Office A separately verifies the exact Identity requirement and accepted version; the immutable verification and audit rows are read back.
6. Staff and Office see **5 of 6**. Induction remains **Training provider not connected**, the case remains **In progress**, and no view claims identity authenticated, compliance or deployability.
7. Demonstrate Staff and Office at desktop and 390px, including request, pending review, feedback and verified states where practical.

**Negative and integrity tests:** Staff/dual-role Staff cannot self-verify; Staff B cannot list, guess or retrieve Staff A request, metadata or bytes; Office B cannot access or verify Office A's case; Operations and SiteAssignment gain no identity-evidence access; upload, evidence acceptance and Task `DONE` cannot set `VERIFIED`; pending/rejected and wrong Person/case/requirement/request/version evidence cannot verify; only the latest exact accepted version qualifies; rejected-version replacement must be reviewed and separately verified; direct table/RPC/Storage writes cannot bypass scope, verifier authority or audit constraints; ordinary clients cannot write verification/audit rows; cancellation blocks further normal actions; role expiry removes verification authority. Template V2 and the four previously fulfilled requirement histories remain unchanged.

**Execution checks:** clean install, lint, webpack build, smoke, all accepted Phase 01/02/03A/03B/03C regressions, new Identity business/server/RLS tests, exact private-byte isolation, document/Task regressions, migration/object readback, staged secret scan, and desktop/390px browser evidence. A short bounded Sol review should examine the changed requirement-link and verification guards because they are authorisation boundaries. Fix findings before reporting completion. Commit 03D separately and report exact evidence; do not infer human acceptance from local checks.

## 7. Gates, deferrals and next decision

Use synthetic identities and evidence only. No real passport, driving licence, identity card, photograph, identity number or employee document. Malware scanning, retention/deletion, privacy review, production secrets, backup/recovery, pilot environment and operational ownership remain pre-live gates. Do not connect the SIA register, Entra, SharePoint, LMS or other live sources; do not deploy.

Core KSS induction remains `NOT_CONNECTED` and cannot be manually ticked or faked. After 03D, **Training integration is the preferred 03E direction only if the actual provider and usable interface are identified and separately approved**. If that remains unknown, propose the required onboarding team queue/delegation/cover/reassignment task instead, then return to Training. The original Office owner rule is temporary; do not widen all Office access to compensate.

## 8. Implementation boundary

David approved this bounded implementation. Inspection and testing confirmed that the existing one-time request link preserves an attributable, reconstructable case-specific activation. The change used one additive migration, the existing private document and Task services, and the existing verification business table. Training and deployment remain outside this task. Development verification does not constitute human acceptance or production readiness.
