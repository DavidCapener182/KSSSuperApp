# TASK-03B proposal — Staff Personal Details and synthetic SIA fulfilment

**Status:** approved by David and implemented in synthetic development on 23 September 2026; see `TASK-03B-REPORT.md` for the executed scope and verification. TASK-03A was accepted at `fddc8e5`. This document preserves the pre-approval proposal; David's detailed TASK-03B approval controls where it refined these recommendations.

## 1. Outcome and limits

Extend the visible Staff and Office onboarding journey by making **Personal details** and **SIA licence** functional for one synthetic `SECURITY_STAFF` pilot. Reuse stable `people.id`, the existing case/checklist, private Documents, immutable evidence review, `DOCUMENT_REVIEW` Tasks and audit. The only SIA decision recorded is that an authorised Office user made a **synthetic development verification decision** on a submitted SIA record and an exact accepted evidence version. Do not claim an SIA licence is genuine or that Staff is deployable.

The six requirements remain distinct. In this task, Personal details may be **Complete — self-submitted**, Right to Work and SIA may be **Verified** through their separate decision paths, Identity evidence remains **Not configured**, Contract/terms **Not available**, and Core KSS induction **Not connected**. The progress label should become **“N of 6 requirements complete”**, with the type of completion shown on each row. Only a current, valid, requirement-specific fulfilment counts. No overall case `COMPLETE`, compliance score or eligibility result is introduced.

This task must be a useful Staff `/profile` and My Onboarding experience, plus a scoped Office starter experience, rather than merely new tables. Continue synthetic identities and data only. No real staff, address, phone, licence number or SIA evidence is permitted in the development proof.

## 2. Version boundary that needs explicit approval

Published 03A Template V1 marks Personal details and SIA `NOT_CONFIGURED`. Its definitions and each existing V1 case are immutable. **03B must not silently toggle those V1 requirements or rewrite an existing case's template version.**

**Recommended pilot:** publish `SECURITY_STAFF_BASE` **Template V2** with the same six positions/codes, changing only Personal details and SIA to available fulfilment mechanisms and defining the synthetic SIA category expected for this pilot. Start a **new Staff A V2 case**. Run the already implemented RTW workflow in that V2 case and verify its exact evidence there; then complete Personal details and SIA to show **3 of 6**. Staff A's V1 case, RTW decision and evidence remain historical and unchanged. The V2 demonstration proves RTW continues to work from 03A, but does **not** carry a V1 decision into V2 by implication.

If KSS instead requires the **same V1 case** to reach 3 of 6 while retaining its earlier RTW decision, 03B would need an explicitly approved, audited case-template transition and exact verification carry-forward rule. That is materially wider than this recommended task and should be separately designed before implementation. The UI must identify the case/version so two Staff A cases cannot be mistaken for one.

## 3. Personal Details: minimum data and authority

Keep `people.id` as the stable Person key and `auth_identities` as separate login mappings. Keep `people.display_name` as a shell/display label; it is **not** proof of a complete profile. Propose one restricted `person_profiles` current record per Person, with:

| Field | 03B rule | Why |
|---|---|---|
| Legal first name, surname | Required for synthetic profile submission | Basic named starter record; no identity conclusion. |
| Preferred name | Optional | Staff-facing form of address; does not replace legal name. |
| Contact email | Required, separately labelled from Supabase Auth sign-in email | Staff communication detail; changing it does not change login identity. |
| Mobile number | Required | Basic contact route; validate plausible input, not ownership. |
| Home address line 1, town/city, postcode | Required | Minimum useful address, syntactic checks only. Address line 2 optional. |

**Do not add in 03B:** DOB, National Insurance number, bank details, medical or special-category data, emergency contact, immigration status, identity document numbers or general HR attributes. Emergency contact should wait for an agreed business need and privacy/retention rules. The mandatory list above is a proposal for David/KSS to confirm before implementation.

The canonical values live on `person_profiles`, keyed by `people.id`, and appear in `/profile` and the authorised onboarding view. Do not store another editable copy on each case. Staff may edit their own listed fields. Office can read the submitted details only for cases it currently owns; no broad people directory or Office editing of Staff data is proposed. Super Admin has bounded audited oversight. Operations keeps its existing narrow `/profile` self view and gains no contact/address fields for other people.

`people.display_name` may remain the existing synthetic shell label during 03B; a preferred-name change should be shown in the profile/onboarding UI from the profile record. Any future rule to synchronise the shell label must be an explicit server action with audit, not an incidental profile write. Contact email is not automatically written into Supabase Auth or an authentication provider.

### Submission and completion

Staff can **Save draft** and later **Submit Personal details**. Saving validates field length/type and stores the current profile but gives no checklist credit. Submission validates the proposed required fields, records an immutable, case-bound `PERSONAL_DETAILS_SUBMITTED` business event pointing to the exact profile revision, and then derives **Complete — self-submitted**. No Office “verified” click is proposed: Office is receiving a complete contact/profile submission, not making a defensible identity decision. The UI must distinguish “supplied”, “format checked” and “identity verified” (the last is **not performed**).

Propose a restricted immutable `person_profile_revisions` history containing the values necessary to reconstruct the submitted profile, actor, database timestamp and changed field names; a case submission references the exact revision and Person. This is a historical snapshot/reference, not a second editable profile. A later edit to a required field does not mutate that submission. **Recommended current-state rule:** the old submission remains visible as history, while the requirement shows **Update needs submission** and stops counting until Staff submits the new profile revision. Optional preferred-name edits alone need not invalidate it. An Office view should label current values versus the submitted revision when they differ.

Generic `audit_events` should carry Person, actor, revision/submission IDs, action, timestamp and changed field names only. Full home address, mobile, contact email and old/new values belong in the restricted revision history with tighter RLS, retention and read audit, not generic audit JSON or logs. All reads and writes must use server checks plus RLS; ordinary clients cannot insert revision, submission or audit rows directly. A sensitive-value retention/deletion decision remains a pre-live gate.

## 4. Synthetic SIA requirement

Use a controlled licence category code, initially `DOOR_SUPERVISION`, `SECURITY_GUARDING`, and `PUBLIC_SPACE_SURVEILLANCE_CCTV`, with clear Staff labels. These categories reflect current [Security Industry Authority guidance](https://www.gov.uk/guidance/find-out-if-you-need-an-sia-licence); the **KSS role-to-licence policy remains unapproved**. For this generic static-security **synthetic** pilot, propose Template V2 expects `SECURITY_GUARDING`. Do not infer that every real Security Staff assignment needs this exact category, or that a different category is interchangeable. Client/Site-specific licensing rules and the official register check require later policy and integration approval.

Staff enters a clearly synthetic reference such as `SYN-SIA-03B-A`, category from the controlled list, and a synthetic expiry date. This reference deliberately does not resemble or validate a real licence number. No SIA register call, scraping, format-based authenticity claim or live licence import occurs. The reference/category/expiry are a Person credential record with immutable submitted revisions; renewal can add a new revision without overwriting history. A case requirement links to the exact submitted revision, targeted DocumentRequest and later verification. Avoid a parallel upload system.

**Proposed sequence:**

1. Staff enters synthetic SIA details and submits a revision for their V2 case.
2. The authorised Office case owner issues or links a protected SIA DocumentRequest for the same Person and requirement. The Staff flow clearly opens that request in the existing Document UI. Decide whether Office or Staff initiates the request as part of implementation design; the existing service currently makes Office the requester.
3. Staff uploads synthetic evidence as an immutable DocumentVersion. The existing `DOCUMENT_REVIEW` Task appears for its authorised Office requester.
4. Office reviews the exact version. `ACCEPTED_AS_EVIDENCE` resolves the document Task but **does not** verify SIA.
5. Original active Office case owner, or audited Super Admin, separately verifies the exact SIA requirement, case, Person, submitted licence revision and latest accepted DocumentVersion. The decision is an immutable requirement-verification business row, separate from `audit_events`, and records verifier Person and database timestamp.
6. The SIA requirement becomes `VERIFIED` only while that exact submitted licence revision and evidence decision remain current and its synthetic expiry date is valid. Rejection or replacement returns the appropriate Staff/Office next action. No extra verification Task type is added in 03B.

Reuse the 03A `onboarding_requirement_verifications` pattern through a narrow typed extension or an equivalent typed business record. Do not create an unrelated generic “approved” flag. The database guard and server route must both require the exact source joins and prevent a verified row for another case, Person, category, submission, request or version. Staff, including a Staff user who also holds an Office role, cannot verify their own requirement. Office B cannot verify Office A's case via a guessed ID or common Site relationship. SiteAssignment remains context, not profile or evidence authority.

### Expiry rule for approval

Store SIA expiry as a **date**, not a guessed legal timestamp. For this synthetic proof, propose it is current through the displayed expiry calendar day in `Europe/London`; derive `EXPIRED` from the next day. Neither the submitted date nor a syntactically valid reference establishes authenticity. Once expired, the requirement no longer counts, while the immutable submission, exact evidence and Office decision remain visible to authorised users. A new revision/evidence/decision is needed to restore current status. Tests should use a controlled clock or transaction-safe as-of date, not falsify a live decision timestamp.

## 5. User experience

**Staff `/profile`:** show their current Personal Details in an editable, mobile-first form with Save draft, Submit, per-field validation, last saved/submitted status and a clear distinction between contact email and sign-in email. Show only their own SIA section and controlled category selection, synthetic reference and expiry. Link to My Onboarding and the existing private evidence request. No genuine licence or identity badge is shown from formatting alone.

**Staff My Onboarding:** Personal details shows missing fields, draft/submission state and its current completion basis; SIA shows entered detail state, evidence state, Office review state, separate verification state and expiry. Give one clear next action. Preserve RTW state and the honest Identity/Contract/Induction blockers. At 3 of 6, show which three count and why; do not imply readiness to work.

**Office scoped starter:** show submitted Personal Details needed for the owned case, with the submitted-revision timestamp and any current-value divergence. Show SIA category/reference/expiry, protected evidence status, exact version and a separate, explicit synthetic verification action. Reuse Phase 02/03A UI primitives, confirmation and feedback patterns. Office cannot edit Staff data just because it owns a case. Operations receives no private Staff profile/SIA menu, API or file path. Super Admin oversight remains audited.

Desktop and 390px browser demonstrations should show real form/error/save/submit states and both actor journeys. Avoid a profile form that only works through direct API calls.

## 6. Minimum additive implementation shape, if approved

- Source-controlled Template V2 and a guarded new Staff A V2 case. Preserve V1 and all historical requirement/verification rows. Do not in-place edit published definitions.
- One current `person_profiles` record per Person and restricted immutable profile revisions, plus a typed case requirement submission that references the revision. No general HR record or unrelated fields.
- Minimal Person SIA credential and immutable submitted-revision records, with case/requirement binding and existing private DocumentRequest link. Extend exact-version verification and derive state/expiry. If a materially wider schema is needed, return for approval before migration.
- Narrow server routes/actions and RLS for self edits, owned-case Office reads, Super oversight and guarded decisions. No direct client writes to verification, history, source links or audit. Existing protected bytes keep independent Document/Storage checks.
- Existing `DOCUMENT_REVIEW` Tasks only. Evidence review and requirement verification remain independent business events. No team queue or reassignment system in this task.

## 7. Acceptance evidence for implementation

**Positive proof:** Staff A opens `/profile` and My Onboarding for the new V2 case; saves draft, sees validation, submits all approved required synthetic details and gains Personal details **Complete — self-submitted**. Staff enters a synthetic `SECURITY_GUARDING` credential, submits synthetic SIA evidence through the existing document request, and Office sees the existing review Task. Evidence acceptance completes that Task while SIA remains unverified. Office separately verifies the exact licence revision and accepted version. The V2 case's RTW is separately verified through the existing 03A path, producing **3 of 6 complete**. Identity remains outstanding, Contract not available, Induction not connected, and case stays `IN_PROGRESS` without any deployability result. Demonstrate synthetic SIA expiry reducing the count without deleting history. Show Staff and Office desktop and 390px.

**Negative proof:** Staff cannot read/edit another Person; Office B cannot guess another case/profile; Operations cannot obtain Staff contact/address, SIA details or bytes; SiteAssignment alone widens nothing; a second Staff-held Office role cannot self-verify; profile save/format checks cannot imply identity verification; changes cannot silently alter a submitted historical snapshot; stale required-field edits remove current completion until resubmitted; SIA evidence acceptance and document Task Done cannot set SIA Verified; pending/rejected/wrong Person/request/case/revision/version evidence cannot verify; expired SIA loses current credit without deleting decisions; unavailable requirements cannot complete; ordinary clients cannot directly write verification/revision/link/audit state. Include anonymous access denial, role-expiry effects and cancellation behaviour.

**Checks:** clean install, lint, webpack build, smoke, all accepted Phase 01/02/03A regressions, new profile and SIA server/RLS/business tests, exact Storage denial, template V2/V1 immutability, expiry, audit/readback, staged secret scan, and targeted Staff/Office browser demonstration. A bounded Sol review is appropriate for private profile data, SIA verification and expiry. Continue economical routing; no GPT-6 Astra without David's explicit approval.

## 8. Deferred Phase 03 administration work

**Required later:** onboarding team queues, delegated ownership, cover/reassignment and cancelled-work presentation. Original Office ownership is temporary and cannot be the production operating model. This need remains open and must be planned after more visible onboarding fulfilment, without widening every Office user's access in 03B.

## 9. Decisions requested before implementation

1. Approve the recommended **new Staff A Template V2 case** demonstration, preserving V1 unchanged; or request a separately designed audited upgrade of the existing V1 case.
2. Confirm the exact mandatory Personal Details list, especially contact email, mobile and full address; confirm emergency contact remains deferred. Confirm whether Office needs any review decision beyond seeing the submission; the proposal recommends **no Office verification** for basic syntactic completeness.
3. Confirm `SECURITY_GUARDING` as the **synthetic pilot** SIA category expected by V2, with Door Supervision and Public Space Surveillance (CCTV) selectable controlled categories but no assumed real role equivalence.
4. Confirm SIA evidence is mandatory for this pilot and Office makes a separate synthetic verification decision; approve the date-only, `Europe/London` end-of-day expiry interpretation for the synthetic proof.
5. Confirm the proposed invalidation rule for edits to required profile fields after submission. Decide whether an Office owner should initiate the SIA evidence request as in 03A or whether Staff initiation needs a separately specified controlled action.

The Phase 02 pre-live gates remain open: malware scanning, retention/deletion, production secrets, backup/recovery, privacy/data protection, pilot environment and operational owner. Live SIA verification and KSS legal/operational role matching need separate policy and integration decisions. **Stop for approval. Do not implement TASK-03B yet.**
