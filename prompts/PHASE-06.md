# PHASE 06 — Events, staffing, attendance and approved hours

**Requirements:** R12–R14, R15  
**Prerequisites:** Shared records and eligibility from Phases 01–03; operational requirements and rostering ownership confirmed.  
**Suggested models:** Terra Medium implementation; Sol High for temporal/rule and hours-review work; Luna for well-defined UI and test fixtures.

## Outcome to demonstrate

Create one event or recurring site shift, allocate an eligible test worker, record attendance and separately approve payable and billable hours.

## This phase includes

- Add event/deployment and role/post requirements, briefings and explicit accreditation-readiness references where needed; reuse existing clients/sites.
- Integrate existing rostering where justified and supported. Define one source of truth for shifts and staff IDs before write-back.
- Check availability, overlaps and requirements across the actual shift period; explain eligibility without disclosing private source documents.
- Record scheduled, observed, submitted and approved payable/billable hours separately, with attributable changes. Relative deadlines respect the real event lifecycle.

## Suggested bounded task sequence

- **TASK-06A:** Create one event/recurring shift template and role/post requirement.
- **TASK-06B:** Implement allocation/confirmation with eligibility and overlap tests.
- **TASK-06C:** Capture attendance and controlled hour approvals, including an overnight case.
- **TASK-06D:** Reconcile the pilot rostering source or demonstrate a labelled development adapter.

## Outside this phase

No autonomous staff allocation, invented employment-law thresholds, public ticketing, payroll calculation or silently replacing existing rostering.

## Acceptance evidence required for the phase

- Worker qualification validity covers the required assignment period under the agreed policy.
- A template never imports old attendance, issued passes or confirmations.
- Overlapping allocations are flagged.
- Observed attendance is not automatically an approved pay or charge amount.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
