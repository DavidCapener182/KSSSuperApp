# PHASE 01 — Secure foundation and shared records

**Requirements:** R01–R03, R26, R30; C2–C3, C6  
**Prerequisites:** Phase 00 approved; identity and minimal storage decisions agreed.  
**Suggested models:** Terra Medium for implementation; Sol High for permission/security review; Luna for isolated fixtures, copy and routine layout work.

## Outcome to demonstrate

An office user and a test employee sign in, see different permitted workspaces and access the same underlying records only within their scopes.

## This phase includes

- Create or extend the application shell, reproducible local setup, error handling and test harness using the chosen stack. Work in development with synthetic fixtures.
- Implement verified sign-in, session handling, server-side authorisation and dated role/scope assignments; a person is distinct from their login. Do not invent a production identity provider.
- Add the minimum real Person, Client, Contact and Site records, stable IDs and meaningful activity/audit events. Defer sophisticated CRM and all-module screens.
- Provide permission-aware navigation and authorised launch points for existing apps, with unknown URLs/configuration marked rather than fabricated.

## Suggested bounded task sequence

- **TASK-01A:** Set up the runnable shell and baseline smoke test without changing existing conventions unnecessarily.
- **TASK-01B:** Implement identity, scope policy and cross-user/cross-site denial tests.
- **TASK-01C:** Implement one shared-record journey and audit trail.
- **TASK-01D:** Connect role-specific navigation and app-link settings; review the complete foundation.

## Outside this phase

No payroll, full rostering, full HR import, AI assistant, public release or decorative mock dashboards presented as working modules.

## Acceptance evidence required for the phase

- Anonymous and unauthorised API requests fail, including altered record IDs.
- Employee self-access cannot expose another person, pay field or unrelated site.
- The same client/person identifiers are reused across views.
- Local setup and the smallest real journey pass documented tests.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
