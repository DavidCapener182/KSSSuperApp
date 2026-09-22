# PHASE 09 — Client portal, controlled reports and analytics

**Requirements:** R23–R25  
**Prerequisites:** Reliable upstream operational data, approved publication matrix and tested access controls.  
**Suggested models:** Terra Medium implementation; Sol access/publication review; Luna for ordinary report layout and bounded transformations.

## Outcome to demonstrate

An authorised client sees an approved report for its site; its totals reconcile to permitted source work and no other client/private staff data is exposed.

## This phase includes

- Build the external workspace with explicit client/site memberships and approved publications, not a filter over unrestricted internal screens.
- Provide selected requests, reports, current documents and commercial status; preserve report periods and revisions.
- Implement a small metric dictionary with source, numerator/denominator, timing, freshness and scope; add drill-down only to authorised records.
- Add trusted knowledge/search refinements with owner/review dates and current-version references. Test titles, snippets, counts and exports for leaks.

## Suggested bounded task sequence

- **TASK-09A:** Implement publication and client-scoped document/report access.
- **TASK-09B:** Implement a client request/status journey.
- **TASK-09C:** Implement and reconcile three agreed useful measures; add freshness indicators.
- **TASK-09D:** Test cross-client links, exports, search and stale/superseded content.

## Outside this phase

No whole-database client analytics access, raw medical/HR log publication, staff-quality ranking or enterprise BI rebuild.

## Acceptance evidence required for the phase

- Altered client/report identifiers cannot disclose unrelated data.
- Every reported total traces to its defined permitted source set.
- Missing integration data displays unknown/stale, not zero or 100% compliant.
- Private titles/snippets are not discoverable.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
