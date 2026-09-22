# PHASE 04 — Employee portal, questions, expenses and lifecycle

**Requirements:** R05, R07, R08, R21  
**Prerequisites:** Phases 01–03 verified; staff-visible fields and approval owners agreed.  
**Suggested models:** Terra Medium lead/implementation; Luna for bounded UI/fixture work; Sol for claim approval, private notes and leaver security review.

## Outcome to demonstrate

A test employee finds documents/training, asks a pay question, submits an expense and tracks the response without seeing internal notes or approving their own claim.

## This phase includes

- Complete a usable mobile My Profile/My Work experience around real existing records; prioritise documents, training, questions and expenses.
- Add a small service-desk Request/Conversation workflow with assigned office teams, internal notes and employee-visible replies.
- Implement expense capture, evidence, submission and independent approval. Display approved, exported and paid separately; payment itself remains outside this phase.
- Implement reviewed sensitive profile changes and minimum leave/absence and leaver handling. Leave requests that affect booked work generate conflicts; offboarding revokes access while preserving authorised historical records.

## Suggested bounded task sequence

- **TASK-04A:** Complete employee portal navigation using actual records and permissions.
- **TASK-04B:** Implement ask-question → office reply → resolution with private-note tests.
- **TASK-04C:** Implement receipt-backed claim → query → approval with no self-approval.
- **TASK-04D:** Implement essential lifecycle changes, absence conflict and account revocation.
- **TASK-04E:** Run first useful internal-product demonstration; assess a limited pilot against the Phase 11 gate before any live release.

## Outside this phase

No banking/payment execution, broad HR case-management suite or automatically approved leave.

## Acceptance evidence required for the phase

- Employee cannot read Finance’s private reply notes through API or notification.
- Claimant cannot approve their own expense, including a manager with several roles.
- Paid status is not inferred from manager approval.
- Leaver access ends; authorised historic hours/evidence remain intact.
- Mobile pages have no unintended page-wide horizontal overflow.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
