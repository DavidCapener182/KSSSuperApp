# Decision log

| ID | Decision | Status | Owner / evidence |
|---|---|---|---|
| D001 | Master is reference; build one bounded task within one approved phase | Proposed delivery default | David’s phase/cost request; confirm at Phase 00 |
| D002 | Terra ordinary lead; Luna bounded work; Sol difficult/high-risk work; Astra explicit escalation | Proposed routing | Verify available models/runtime |
| D003 | At most two concurrent subagents; no nested delegation | Proposed project limit | Not a financial hard cap |
| D004 | First useful product covers foundation, docs/tasks, onboarding/training and staff self-service | Proposed release scope | Human acceptance and appropriate live pilot gate required |

Next.js is retained. Vercel and Supabase are the preferred future platform; services remain unprovisioned. No LMS, payroll provider, spending limit or production date has been selected.

| D005 | Retain the new Next.js/TypeScript starter for a first vertical slice; use shared relational records and server-side policy | Proposed, not accepted | Repository inspection; `ARCHITECTURE.md` |
| D006 | `TASK-01A.md` is the first product task | Accepted as locally verified | David's 01A review, 22 September 2026 |
| D007 | Identity, database/hosting and access-review owner are needed before real user/record work | Open | David/KSS owner |
| D008 | Document source, LMS, rostering and finance providers are unverified | Open by phase | Relevant KSS owners |
| D009 | Retain Next.js; prefer Vercel hosting and Supabase PostgreSQL, private Storage and Auth; keep Entra office sign-in option | Accepted direction, services not provisioned | David's TASK-01A approval, 22 September 2026 |
| D010 | Person record stays independent of authentication identity; shared client, staff, site and event records | Accepted architecture constraint | David's TASK-01A approval |
| D011 | Initial pilot role families: Super Admin, Office/Admin, Operations, Security Staff; no client users | Accepted direction for later tasks | David's TASK-01A approval |
| D012 | Super Admin initially assigns access; Operations has no automatic private HR/vetting/banking/payroll/pay-rate access; staff see own and assigned work | Accepted constraint, policy detail pending | David's TASK-01A approval |
| D013 | Use Supabase Auth for the first development identity implementation with synthetic accounts; Entra can be added later without changing Person IDs | Accepted direction for proposed 01B | David's 01A review, 22 September 2026 |
| D014 | Initial role codes are `SUPER_ADMIN`, `OFFICE_ADMIN`, `OPERATIONS`, `SECURITY_STAFF`; only `SUPER_ADMIN` initially grants/revokes roles and scopes and owns access review | Accepted direction; 01B implementation awaits approval | David's 01A review |
| D015 | Use PostgreSQL RLS as defence in depth alongside server-side application authorisation | Accepted architecture constraint; not implemented | David's 01A review |
| D016 | TASK-01B approved with explicit role codes, stable Person UUID, dated assignments, database-authoritative scopes, deny-by-default server/RLS policy and privileged-change audit | Accepted, implementation blocked on development project | David's 01B approval, 22 September 2026 |
| D017 | Service-role credentials are server-only and bypass RLS; test ordinary authenticated Supabase access separately | Accepted security constraint | David's 01B approval |
| D018 | Use only dedicated development Supabase project `dnfhkmmnlbiabqypclqg`; no `ent_` prefix | Implemented project boundary | David's project instruction, 22 September 2026 |
| D019 | Keep Person UUID separate from provider subjects; provider mappings can change without changing Person | Implemented in 01B | Migration and authenticated access tests |
| D020 | Office/Admin can see its own Person and active assigned sites in 01B; only Super Admin may administer role/site assignments | Implemented 01B proof scope | Route and RLS tests; broader Office permissions await later tasks |
| D021 | In TASK-01C, Office Admin may manage its own created Sites and finite, reasoned Security Staff SiteAssignments when the staff role covers the full period; Super Admin retains role/site override and review authority | Implemented in dedicated development project; pending David's review | Approved TASK-01C instruction, migrations and negative tests |
| D022 | Site lifecycle is DRAFT → ACTIVE → RETIRED; retirement removes staff access immediately while preserving assignment and audit history; no reactivation | Implemented in 01C; pending review | Approved TASK-01C instruction, browser and automated tests |
| D023 | Public Site preflight is an invoker boolean wrapper around narrow private authority checks; server routes also apply Office/Staff scope before RLS | Implemented in 01C; pending review | Targeted security review and Supabase advisor readback |
| D024 | 01D navigation and route gates share a server-owned capability map; Operations has Home/Profile only, while Site record access remains under 01C server policy and RLS | Implemented in 01D, pending review | David's 01D approval; shell and negative-access tests |
| D025 | App launch links remain absent until canonical HTTPS destination, owner, audience and authentication mode are verified | Deferred to a later bounded task | David's 01D approval; no Apps UI or integration added |
| D026 | TASK-02A uses a private synthetic personnel evidence bucket, explicit Person/request audience and dual server/RLS checks; Site is context, never the document audience | Implemented in development, pending review | David's 02A approval and document/RLS/Storage tests |
| D027 | Reuse `audit_events` for document creation, submission, privileged read and synthetic stale cleanup; no separate document timeline | Implemented in development, pending review | Five source-controlled 02A migrations and audit readback |
| D028 | Submitted evidence remains `NOT_SCANNED` and unverified; live personnel evidence requires a separate scanning, retention and pilot decision | Open gate | TASK-02A scope and report |
| D029 | TASK-02B records only immutable `ACCEPTED_AS_EVIDENCE` or `REJECTED` decisions on exact submitted versions; rejection requires a controlled reason and 10–500 character comment | Implemented in development; pending review | David's TASK-02B approval, migration, business tests |
| D030 | Office requester or Super Admin may review only the latest undecided version, never their own evidence; Staff may replace only after rejection and not after acceptance | Implemented in development; pending review | Server policy, guarded RPC, RLS, synthetic browser and negative tests |
| D031 | Review decisions are business rows; `audit_events` separately records attributable insertion, and evidence acceptance is not verification, compliance, deployment eligibility or malware clearance | Implemented in development; live use remains gated | David's TASK-02B approval and report |
