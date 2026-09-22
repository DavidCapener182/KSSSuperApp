# PHASE 03 — Onboarding, verification and training status

**Requirements:** R05, R06, R13, R20; C1  
**Prerequisites:** Phases 01–02 verified; pilot role requirements and review responsibilities agreed.  
**Suggested models:** Terra Medium for the workflow; Sol for verification/eligibility review; Luna for small form components and test data, not eligibility decisions.

## Outcome to demonstrate

Office creates one new starter; the employee uploads evidence; an authorised reviewer verifies it; training evidence produces an explained eligibility result.

## This phase includes

- Create versioned onboarding requirements for one initial role and site. Distinguish requested, supplied, under review, rejected, verified and expired.
- Build employee upload and office review using the existing document service, with accountable reviewers, reasons and audit events.
- Connect the actual LMS through a confirmed interface or use a clearly labelled manual/imported status path with provenance. Unknown LMS capability is a tracked dependency, not an invented completed integration.
- Calculate eligibility for a defined assignment period with clear blockers. Do not make employment decisions or allow a note to waive a non-overridable requirement.

## Suggested bounded task sequence

- **TASK-03A:** Build create-starter plus versioned checklist for one role, using the existing Person record.
- **TASK-03B:** Complete upload → review → reject/resubmit → verify for one document requirement.
- **TASK-03C:** Add one training assignment/result path with source and freshness.
- **TASK-03D:** Combine evidence into eligibility and test expired/missing/conflicting cases.

## Outside this phase

No LMS authoring engine, whole-workforce import, automated vetting judgement, legal-policy invention or full recruitment marketing system.

## Acceptance evidence required for the phase

- All uploads supplied does not equal all checks verified.
- Reviewer actions require permission and retain submitted evidence/history.
- Training result replay does not create duplicate completions.
- A requirement invalid during the relevant shift is evaluated under the agreed rule and explains its blocker.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
