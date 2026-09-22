# PHASE 10 — Broader automation and permission-aware AI

**Requirements:** R26–R29  
**Prerequisites:** Relevant module workflows proven; permission tests and data freshness validated. Basic approvals/integrations already exist from earlier phases.  
**Suggested models:** Sol for AI/tool security design/review; Terra bounded implementation; Luna for routine tests/formatting. Runtime product AI model choice is a separate decision.

## Outcome to demonstrate

A user gets a cited explanation of a missing requirement or uninvoiced work and can explicitly approve a permitted suggested action.

## This phase includes

- Extend existing typed approvals and triggers into versioned reusable workflows with retries, audit, reasons and failure ownership.
- Complete useful confirmed connectors alongside their business process. Do not postpone every integration until this phase or introduce uncontrolled two-way sync.
- Pilot narrow retrieval/summarisation or draft-generation over authorised data with exact sources and freshness. Enforce permission before retrieval and before any action.
- Add malicious-document, confidential-data, stale-answer and confirmation tests. Keep consequential actions explicit and record model/runtime usage separately from Codex build costs.

## Suggested bounded task sequence

- **TASK-10A:** Extend one proven workflow with duplicate/retry/failure handling.
- **TASK-10B:** Implement one narrow cited AI question on authorised data.
- **TASK-10C:** Implement one preview-and-confirm low-risk action with audit.
- **TASK-10D:** Run adversarial disclosure and untrusted-content tests.

## Outside this phase

No autonomous payroll, disciplinary decisions, fabricated incident reports, waived mandatory requirements or unbounded always-running agent system.

## Acceptance evidence required for the phase

- Untrusted source text cannot override system permissions or trigger an unauthorised tool call.
- An unsupported answer states the evidence gap.
- Material amendments invalidate relevant old approvals.
- A replay creates no duplicate task or financial action.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
