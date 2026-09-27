# TASK-20E — Training Completion & Certificates

**HISTORICAL IMPLEMENTATION BRIEF — SUPERSEDED BY ACCEPTED TASK-20E DELIVERY.** This proposal was prepared from canonical `main` at `25dfb02dd5e1da087b0cc8034b2260d8c129122c`, before implementation. Its pending decisions and stop gate below record the position *at that time*; they are not current instructions. David accepted the completed 20E slice in synthetic Development on 25 September 2026. [TASK-20E-REPORT.md](TASK-20E-REPORT.md) is the delivery authority. No staging, production, real learner data or deployment followed.

## Historical proposal reconciled to accepted delivery

| Historical proposal | Final accepted 20E decision | Current evidence |
|---|---|---|
| Exact Assignment, CourseVersion and PASSED Attempt should feed a separately evaluated Completion rule. | An immutable published CompletionRuleVersion pins the exact evidence; Staff self or a named Completion Manager explicitly evaluates. Page marks or a PASSED Attempt alone create no Completion. A reasoned manager void retains the fact and history. | [20E report](TASK-20E-REPORT.md), Completion Foundation; `20260925000018_training_completion_20e.sql`; `/api/training-completions`. |
| Certificate identity, template, PDF, expiry, revocation and reissue needed decisions; issue might have followed evaluation. | CertificateIssue is a separate explicit manager action. An issued private PDF has a recorded hash; authorised Staff may download their own current issue. Revocation and linked reissue retain attributable history. Completion void invalidates current download. | [20E report](TASK-20E-REPORT.md), Certificate and PDF; `20260925104455_training_certificates_20e.sql`; `/api/training-certificates` and its file route. |
| The migration filename and remote ledger version were to be recorded after approval. | Completion SQL and the safe evidence read were applied to synthetic Development; the first unsafe evidence projection was rejected and never applied. Certificate SQL was approved and applied separately. | [20E report](TASK-20E-REPORT.md), approval and hashes; [INT-04 reconciliation](INT-04-FROZEN-RECONCILIATION.md), local/remote timestamp mappings and accepted source hashes. INT-04 did not independently attest remote SQL bytes. |
| Training could later inform requirements and Credentials, but this brief excluded a matrix and eligibility. | Assignment ≠ Attempt ≠ Completion ≠ Certificate ≠ Credential verification ≠ deployment eligibility. Completion neither verifies a Credential nor decides deployability; issuing a certificate does neither. | [20E close-out](TASK-20E-REPORT.md); [16B boundary](TASK-16B.md); targeted [INT-02 distinction](INT-02-VALIDATION-REPAIR-REPORT.md). |

**Separate next policy capability:** David approved TASK-20F-A Training Requirement Foundation & Matrix Pilot as a later bounded direction. It consumes 20E Completion and CertificateIssue facts as evidence under a published requirement; it does not decide deployability. Its proposal is `docs/product-review/PRODUCT-03-20F-PROPOSAL.md` on `product-03-training-review` (`64b9251`), outside this integrated snapshot. This reconciliation does not start 20F-A.

## Purpose and accepted source contracts

Complete the native Training evidence chain, without converting Training into a credential or deployment decision: `Person → exact active TrainingAssignment → published CourseVersion → published AssessmentVersion → immutable submitted PASSED Attempt(s) → explicit Course Completion decision → certificate issue/history`.

TASK-20B owns sealed CourseVersion content and hash. TASK-20C owns exact Person and CourseVersion assignment, its `ACTIVE | CANCELLED | SUPERSEDED` state and factual page marks. TASK-20D owns AssessmentVersion, immutable submitted answers/result and the 80% pass rule. A passed Attempt currently creates no Completion. TASK-20A approves distinct Completion and certificate identities as architecture only. The external TASK-11A Training shortcut and Core KSS induction `NOT_CONNECTED` remain separate.

Completion is a factual, version-bound Training decision. It does not verify a credential, fulfil onboarding, prove SOP acknowledgement, grant a role, establish allocation eligibility, change attendance or worked time, or trigger pay.

## Bounded first slice and identities

- One Completion case per exact Assignment and completion-rule version, with a stable UUID. Pin `person_id`, `assignment_id`, `course_id`, `course_version_id`, rule/version ID, qualifying AssessmentVersion IDs and exact PASSED Attempt IDs. The server verifies every FK and Person/version equality rather than trusting caller-supplied IDs.
- Define an immutable published **completion rule version** for an exact CourseVersion. Its first-slice inputs should be explicit: whether all published page markers are required; which exact AssessmentVersion(s) count; whether one PASSED submitted Attempt per required assessment is sufficient; effective-from and optional end. No implicit completion rule follows from merely publishing a course or assessment.
- A Staff member may request evaluation of their own active Assignment; an authorised Training administrator may evaluate an exact Assignment for correction/review. Neither page view nor pass triggers automatic Completion. Evaluation records the exact evidence set and a deterministic outcome/reason; success creates one immutable Completion fact in the same guarded transaction. An unmet rule produces a factual unmet projection, not a false Completion row.
- A cancelled/superseded Assignment or retired CourseVersion/required AssessmentVersion blocks **new** completion decisions. A historical submitted pass or issued Completion is not deleted. A subsequent rule or assessment version does not reinterpret an earlier Completion; a new Assignment/rule decision is required under an explicit later policy.
- Completion and Certificate are separate identities. One initial certificate issue references one exact Completion and one immutable certificate-template/version. Store stable certificate UUID and unique opaque reference, issue timestamp/Europe-London issue date, issuer actor, exact validity basis, optional expiry, document hash/storage pointer if a PDF is approved, and immutable issued snapshot. No expiry can be invented when the CourseVersion/rule defines none.
- Reissue creates a new certificate issue linked to the prior issue and reason; revoke appends an attributable revocation event and changes the current projection while preserving the issued artifact and history. Never edit a prior certificate's number, issue date or PDF bytes in place. Do not let revocation erase Completion or a passed Attempt.

## Authority and security

Propose a separate finite `TRAINING_COMPLETION_MANAGER` capability for an active Office Admin Person, granted/revoked by Super Admin with history. It authorises explicit evaluation, issue, revoke and reissue only after source validation. Existing Training Author, Publisher, Assigner, Assessment Author/Publisher and Super Admin role alone do not silently confer certificate issue authority; Super Admin retains grant administration and oversight. David must confirm this grant model.

Staff see only their own Completion/certificate current and historical projection and may download their own currently authorised artifact. Office manager views require the named capability and exact Assignment scope. Operations gets no learner/certificate history in this slice. Resolve the actor through AuthIdentity → active Person for every RPC, route, list, count, search and file request. RLS is enabled; deny direct `anon`/`authenticated` base-table read/write on decision and history tables. Guarded security-definer RPCs use fixed search paths, actor-derived identity, exact FKs, expected revision where mutable state exists, and a reason/request key for consequential actions. Certificate bytes, if implemented, use private Storage and a server reauthorisation on every download; no public bucket or guessable object path.

## Concurrency, audit and corrections

Lock the Assignment and relevant rule/evidence rows during evaluation. A unique database constraint prevents two live Completion facts for the same Assignment and rule version. Identical request-key replay returns the original result; changed-payload replay fails. Concurrent identical evaluations converge on one Completion ID. Certificate issue uses the same pattern and a unique reference generator in the database. Record append-only Completion, certificate and privileged-access events with actor, server time, exact IDs, reason, old/new state and request identity. Do not copy assessment answer keys or private learner answers into general history. An erroneous Completion needs a separate reasoned void/correction decision and preserved original fact; decide whether that is needed in this first slice before implementation.

## UX

Staff **My Learning** shows the exact assigned CourseVersion, factual page/Attempt state, a clear **Request completion check** action, unmet requirements, and then a separate certificate card/history when issued. Show expiry only if defined, and clearly label revoked or superseded issues. Office Training administration shows the pinned evidence and explicit evaluation/issue/revoke confirmations. At 390px use one-column cards, 44px controls, keyboard labels/focus, non-colour-only state, no horizontal overflow and the existing blue/graphite/neutral palette; no green. Never display a `compliant`, `qualified` or `deployable` badge.

## Acceptance proof after separate approval

Use only `dnfhkmmnlbiabqypclqg` and synthetic fixtures. Prove exact assignment/version/Attempt binding; a PASSED Attempt alone creates nothing; explicit evaluation creates one immutable Completion; page/assessment gaps produce truthful unmet reasons; certificate issue, retry, reissue, revocation and historical readback; expiry rules using London dates; concurrent single-winner issue; Staff self scope and peer/Operations/revoked-manager denial; direct-table and guessed-ID denial; private artifact reauthorisation; no answer-key leakage; no onboarding/credential/eligibility/allocation/pay changes. Run focused 20B/20C/20D and external Training shortcut regressions, build, and authenticated Staff/Office desktop plus 390px checks. Record **canonical local migration filename, actual remote ledger version and literal target project ref** in the delivery report before acceptance.

## David's decisions before implementation

1. Confirm the first completion rule: are all page marks required, and is one PASSED Attempt for the current published AssessmentVersion sufficient? Decide treatment of a pass pinned to an older, still published AssessmentVersion.
2. Confirm whether Staff may request evaluation, whether issue follows a successful evaluation automatically in the same action or needs a separate manager decision, and the finite manager grant model.
3. Define certificate content/template owner, whether a PDF is required in the first slice, reference format, validity/expiry source and whether issued PDFs may contain the learner's name.
4. Define revocation and correction reasons/authority, whether Completion itself can be voided, and what Staff may see after revocation.
5. Define retention/privacy and verification of certificates by third parties before any real use. No public verification endpoint is included now.

## Explicit exclusions and gate

No Training matrix, onboarding fulfilment, credential verification, operational eligibility, bulk/automatic course assignment, external LMS import or replacement, reminders, email/SMS, QR verification, public certificate lookup, payroll, real data or deployment. A later 16C may present this exact certificate as evidence to Credentials; Credentials must independently verify it. **STOP. David must approve a bounded implementation with the decisions above before TASK-20E migrations or code begin.**
