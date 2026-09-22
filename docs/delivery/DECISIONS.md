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
