# PHASE 02 — Controlled documents, tasks and basic approvals

**Requirements:** R04, R15, R25, R27; C4  
**Prerequisites:** Phase 01 verified; document storage/access boundary agreed.  
**Suggested models:** Terra Medium implementation; Sol review of document permissions and approval/version semantics; Luna for narrow UI and test fixtures.

## Outcome to demonstrate

The office publishes a site instruction, the right employee acknowledges that exact version, and an assigned task is tracked to completion.

## This phase includes

- Implement Document and DocumentVersion metadata, secure upload/download, validation and scoped record links against the selected storage provider. Keep credentials server-side.
- Add draft/review/published/superseded states and exact-version acknowledgements. Private files do not gain a wider audience merely because another record links them.
- Build a narrow Task model and board/list/My Work views sharing the same task IDs. Implement assignment, due date, comments and simple task dependencies as needed for the journey.
- Introduce typed approval records sufficient for document review; do not build a universal visual workflow designer. Knowledge links reference approved instructions rather than copied text.

## Suggested bounded task sequence

- **TASK-02A:** Implement private document upload and authorised retrieval with denial tests.
- **TASK-02B:** Implement versioned publication and employee acknowledgement.
- **TASK-02C:** Implement one assigned-task journey and document review hand-off.
- **TASK-02D:** Test version replacement, restricted linking and the complete mobile journey.

## Outside this phase

No mass SharePoint migration, all-purpose automation engine, offline private-file cache or AI search.

## Acceptance evidence required for the phase

- An HR file linked to a site remains private.
- Version 2 becomes current without rewriting the employee’s version 1 acknowledgement.
- A known object URL does not bypass authorisation.
- One task edited from My Work changes the same task shown on its board.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
