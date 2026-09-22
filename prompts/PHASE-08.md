# PHASE 08 — Finance preparation and specialist integration

**Requirements:** R14, R21, R22  
**Prerequisites:** Agreed Finance rules, approved-hours pipeline and provider sandbox. Claims/variations are reused from earlier phases.  
**Suggested models:** Sol for financial rule design/review; Terra for bounded implementation; Luna only for non-financial formatting/fixtures. Astra only after explicit escalation approval.

## Outcome to demonstrate

Approved test work produces a reproducible pay/invoice preparation batch that survives a partial export failure and reconciles without duplication.

## This phase includes

- Implement effective-dated pay/charge rules with explicit precedence and separately approved payable/billable inputs.
- Persist financial snapshots and period locks; later changes create controlled adjustments rather than rewriting posted history.
- Prepare claims, payroll and invoice batches with POs, variations and external IDs; integrate the selected Finance-approved engine through verified contracts.
- Show queued, sent, accepted, rejected, posted and reconciled states. Missing rates and partial failures go to accountable exception queues; never substitute zero silently.

## Suggested bounded task sequence

- **TASK-08A:** Agree and implement tested rate examples and financial snapshots.
- **TASK-08B:** Build exception queue and draft pay/invoice preparation from approved work.
- **TASK-08C:** Implement sandbox export/import acknowledgements with idempotency and partial-failure tests.
- **TASK-08D:** Validate closed-period adjustment and reconciliation with Finance.

## Outside this phase

No new statutory tax/payroll/banking engine, live money movement, live invoice dispatch or unauthorised pay-rate decisions.

## Acceptance evidence required for the phase

- Future rates do not rewrite a closed period.
- Missing data blocks preparation rather than creating zero-value records.
- Partial retry creates no duplicate external invoices/payroll entries.
- Submitted/sent/approved does not imply posted/reconciled/paid.
- Finance confirms expected results using agreed examples.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
