# PHASE 11 — Pilot and production readiness — reusable release gate

**Requirements:** R18, R29, R30; C7–C10 and QA01–QA24  
**Prerequisites:** The selected release scope is implemented and verified. This gate applies to an early Phase 04 pilot as well as later full releases.  
**Suggested models:** Terra coordinates evidence; Sol performs targeted independent high-risk review; Astra only for an approved difficult issue, not a routine final ritual.

## Outcome to demonstrate

An accountable owner can approve a defined release using executed test evidence, migration/restore results, monitoring, support and rollback instructions.

## This phase includes

- Define exactly which features, users/sites and data are in this release; future modules do not need to be built to pilot the selected scope.
- Run security, end-to-end, mobile/accessibility, data migration and backup/restore checks for included journeys; review gaps with accountable people.
- Set staging/production separation, secrets, monitoring, support escalation, data retention responsibilities, rollback and release evidence.
- Record an explicit go/no-go decision. Production deployment, live staff-data import and live external notifications require separate authorisation.

## Suggested bounded task sequence

- **TASK-11A:** Define release scope, pilot participants and acceptance evidence checklist.
- **TASK-11B:** Execute restore/migration and realistic user-journey tests.
- **TASK-11C:** Review security/support/rollback and unresolved operational risks.
- **TASK-11D:** Present go/no-go evidence and stop before production action unless explicitly authorised.

## Outside this phase

No automatic production deployment, live payroll or external email by interpreting passed local tests as permission. SOS remains a separate safety-gated project.

## Acceptance evidence required for the phase

- Evidence distinguishes tests executed, passed, failed and not run.
- Restore recovers correct document versions, IDs and permissions.
- Human pilot users verify the intended office/frontline/client journeys.
- Release scope, accountable owner, support and rollback are documented.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
