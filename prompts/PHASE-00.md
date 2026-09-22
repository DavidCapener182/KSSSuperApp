# PHASE 00 — Inspect, plan and prepare the build

**Requirements:** R01, R02, R26, R30; C3, C5, C7–C10  
**Prerequisites:** None; inspect any existing repository before changing it.  
**Suggested models:** Sol Medium for the initial architecture decision; Terra for organising the work; Luna for bounded read-only inventory. Astra is not required by default.

## Outcome to demonstrate

A repository-aware build plan, verified capability/model map and first implementation task ready for David to approve. No application build is claimed.

## This phase includes

- Read the complete master once, distinguish baseline from proposed additions, inspect current code, package manifests, schema, tests, Git status and existing agent instructions. Preserve working code and uncommitted user changes.
- Recommend a maintainable stack only after inspection. Record unresolved identity, document-store, LMS, rostering and finance choices; only block work that genuinely depends on a missing decision.
- Check the actual Codex client, permitted models, reasoning settings, delegation tools and loaded configuration. Prepare project-scoped instructions and configurations without replacing user/global settings or weakening approvals.
- Create a concise architecture map, permission matrix, requirement/phase coverage map, status ledger and a small first implementation task. Review the security-critical foundation with a stronger agent.

## Suggested bounded task sequence

- **TASK-00A:** Inventory the repository, requirements and current systems; record facts separately from assumptions.
- **TASK-00B:** Draft the architecture, permission boundaries, data ownership and phase coverage map.
- **TASK-00C:** Prepare and verify agent settings; create TASK-01A and report readiness.

## Outside this phase

No product implementation, new paid services, production accounts, bulk migration, database reset or live deployment.

## Acceptance evidence required for the phase

- All original areas and R01–R30 have a phase, dependency or explicit deferred status.
- Existing repository changes are preserved; no credentials or personal records are printed.
- Selected versus observed model settings are recorded; an unavailable capability is not pretended.
- TASK-01A contains scope, allowed files, risks, test commands or justified discovery steps and a stopping point.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
