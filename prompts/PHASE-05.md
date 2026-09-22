# PHASE 05 — CRM, client requests and mobilisation

**Requirements:** R09–R11, R15  
**Prerequisites:** Phases 01–02 verified; client ownership, contract and approval process agreed. Phase 04 request service is reused where available.  
**Suggested models:** Terra Medium for delivery; Sol review of commercial approval/state changes; Luna for scoped record forms and fixture work.

## Outcome to demonstrate

A prospect becomes a client without duplicate records, launches a site mobilisation and records an authorised request for additional cover.

## This phase includes

- Extend existing organisations/contacts with opportunities, relationship labels, activity and next actions; use reviewed duplicate handling.
- Convert won work into a linked contract/site/mobilisation, retaining quote history and contacts.
- Add relative-date mobilisation templates with real owner roles, dependency rules and explicit readiness decisions.
- Track client requests and effective-dated commercial variations with operational acceptance and required client/PO approval. Internal pay/cost information stays private.

## Suggested bounded task sequence

- **TASK-05A:** Implement opportunity → won client conversion and record associations.
- **TASK-05B:** Implement one static-site mobilisation template and date-change behaviour.
- **TASK-05C:** Implement extra-cover request → authorised variation, preserving original terms.
- **TASK-05D:** Validate commercial confidentiality and mobilisation readiness evidence.

## Outside this phase

No marketing platform, public tender scraping, bulk mailbox ingestion or unapproved live-client publication.

## Acceptance evidence required for the phase

- Conversion does not create a second client or contact.
- Changed go-live dates update eligible outstanding tasks, not completed history.
- Requested additional cover is not treated as accepted/chargeable before its required approval.
- Published/client-visible data omits internal cost and individual pay.

## Execution contract for this run

Read the project instructions, this phase brief, current `docs/delivery/STATUS.md`, decisions, model routing and the relevant master sections. Inspect current code and tests before changing them. Preserve existing architecture and uncommitted user work.

First identify the next ready **single bounded task** in this phase. Write its short task packet using `templates/TASK_PACKET.md`, then implement that piece only if its prerequisites and sensitive decisions are settled. Do not interpret the whole phase scope as permission to do all tasks at once. Do not enter a later phase automatically. For Phase 00, produce planning/configuration proposals only, not product code.

Choose the least expensive verified model suitable for the task. Use the lead/agent policy, at most two concurrent subagents plus the lead, exclusive write ownership and no nested agents. Delegate only where useful; a small serial task can use one agent. Set model/effort explicitly where supported and distinguish requested from observed settings. Do not pretend unsupported delegation works. Astra needs explicit approval.

Implement the complete narrow journey, including persistence, server-side permissions, error handling and tests. Keep adapters honest: synthetic/local versus sandbox-verified versus live are different states. No legal/financial policy invention, live data import, live external messages, paid-service creation or deployment.

Run applicable tests, record actual evidence, resolve at most two focused repair cycles before reassessing/escalating, and obtain an independent targeted review for high-risk code. Lead integrates the changes and verifies the full affected journey. Return a task completion report; update factual status and proposed next task. Stop. A passed local task is not phase acceptance or production approval.
