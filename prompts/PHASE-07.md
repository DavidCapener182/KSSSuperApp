# PHASE 07 — Operational delivery, evidence and equipment

**Requirements:** R16–R20, R29  
**Prerequisites:** Foundations, documents/tasks and appropriate Phase 06 operational records; privacy and operational owners agreed.  
**Suggested models:** Terra Medium lead; Sol High for evidence, sensitive incidents and offline consistency review; Luna for narrow forms/fixtures.

## Outcome to demonstrate

A checkpoint observation or audit defect becomes an owned action; a supervisor can hand over an incident and track equipment without losing original evidence.

## This phase includes

- Keep MagSecure and Footasylum launch workflows working. Add confirmed data adapters and visible last-sync/failure status; do not equate a launch link with integration.
- Separate patrol requirement, checkpoint, observation and exceptions. Tags open the correct context but do not by themselves certify a completed check.
- Implement original reports linked to managed incidents, decisions and accepted handovers, with restricted safeguarding information.
- Separate reusable audit templates from fresh answers/photos; attach evidence to the exact question and link existing corrective actions.
- Add focused asset/kit issue-return with component condition and key custody. Define offline capture per action, with visible pending/server-received states.

## Suggested bounded task sequence

- **TASK-07A:** Integrate one confirmed patrol observation/status path and missed/defect follow-up.
- **TASK-07B:** Implement report → incident → action → accepted handover.
- **TASK-07C:** Implement fresh audit instance and question-specific evidence with corrective-action reuse.
- **TASK-07D:** Implement one radio/kit issue-return and maintenance exception.
- **TASK-07E:** Test the selected low-connectivity capture journey and cross-module links.

## Outside this phase

No standalone SOS/lone-worker emergency replacement, visitor suite by default, all-bodycam footage migration or copying last audit’s observations into a new one.

## Acceptance evidence required for the phase

- A duplicate source observation creates one record/action.
- An amended report retains its original and attributable correction.
- A new audit has no old photos/answers/signatures.
- A damaged kit component prevents full-available status.
- Offline save is visibly pending until accepted by the server.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
