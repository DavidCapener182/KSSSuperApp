# KSS — Codex Build Playbook and Cost-Controlled Agent Policy

**Version:** 1.0, 22 September 2026  
**Related master:** v2.1 (v2 requirements preserved; this delivery policy added)  
**Status:** Proposed delivery sequence and ready-to-use task instructions. No KSS code has been built, no live client configuration has been inspected, and no model settings have been activated by this pack.

## The decision

Give Codex access to the whole plan, but authorise only a small current task. Do not say “build the entire enterprise application”. Use an economical lead, specialised workers only when useful and stronger review where mistakes would be expensive.

## How to use the files without feeding everything into every task

The master is the destination and invariant reference. The phase prompt is the current work boundary. A small task packet is the actual implementation instruction. `STATUS.md` is the handover between sessions. Repository instructions state the working rules, not the entire product specification.

Place the master and research in `docs/specification/` and `docs/research/`. Keep `AGENTS.md` short, with pointers, security invariants and scope/agent policy. Do not paste the whole master into it. Codex automatically reads repository instructions and applies an instruction-size limit; this is a reason to keep operational rules concise and load specification sections deliberately. [O4]

In Phase 00 the lead reads the full master once and creates a requirement map. For later tasks, it reads the map, relevant specification sections, recorded decisions and the current code. Workers get the relevant subset and cross-cutting rules. A fresh session should use `STATUS.md` and evidence files, not rely on remembered chat. If an indexed requirement changed, reload and reconcile it rather than trusting an old summary.

### One working loop

**Choose a phase → choose one bounded task → inspect dependencies → implement → run tests → review risk → demonstrate → record evidence → stop.**

A phase is not one enormous generation. Split it into small pieces such as `03B — upload, review and verify one required document`. The phase prompt provides that split. By default execute only the first ready bounded piece, not the whole phase and never the next phase. David may authorise a specific batch of named tasks, but that does not authorise later product scope, paid providers or production.

For each piece, deliver functioning UI + server/domain handling + persistence + authorisation + relevant tests. Do not build twenty mock screens before one end-to-end journey works. Where a provider is unknown, use a clearly labelled development adapter behind a contract; distinguish a local demonstration from a verified integration. Do not invent financial, employment or operational policies to unblock production.

### Ready before implementation

The task records its user outcome, applicable requirements, dependencies, scope and exclusions, agreed sensitive rules, affected schema/files, interfaces, test cases and stopping point. A single task should have one coherent outcome and a reviewable change. Do not use arbitrary line limits to force unsafe designs. Needed upstream changes must be identified and completed/reviewed before parallel downstream writers start.

### Finished before another phase

Keep separate statuses: Planned; Ready; In Progress; Implemented; Locally Verified; Human Acceptance Pending; Accepted for Next Phase; Approved for Pilot; Production Approved. A checked Trello item or a generated test does not move software through these stages automatically.

A completion report contains actual changed files, migrations, test commands and outputs, failed/not-run checks, screenshots/demo steps where available, security/data impacts, remaining blockers, model use and the next recommended task. The lead integrates worker changes and reruns affected end-to-end tests. A reviewer returns findings with file references, not a broad "looks good".

David approves moving to the next phase after the agreed demonstrations. Routine file edits inside the authorised piece should not produce constant permission questions, but new spend, destructive migration, sensitive data use and release remain separate decisions.

### First useful release

Aim first for Phases 01–04: secure login/shared records, controlled documents/tasks, onboarding/training and the employee portal. This yields a usable office-to-employee journey with expenses and questions, before full operations and finance are rebuilt. Existing apps remain available through authorised links or verified adapters.

Apply the Phase 11 **release gate to that limited scope** before any live pilot. Phase 11 is not permission to postpone security or testing until the end, nor a requirement to finish every optional future module before releasing a safe small pilot. Later phases extend the product incrementally.

### Change control and real-world dependencies

The user has approved preparing this delivery policy, not every research suggestion or implementation. R01–R30 stay Proposed unless the decision log records acceptance. Resolve current-task essentials; defer unrelated unknowns without blocking all development. Never silently remove a difficult requirement or describe its adapter as complete when only test data exist.

Integrations are checked with the phase that first needs them. Payroll accounting and course delivery remain specialist-engine candidates; this plan is not a decision to replace PARiM, SharePoint, MagSecure, Footasylum Audits or the unnamed LMS. Data migrations, privacy/retention, hiring decisions, payroll rules and emergency processes require the appropriate KSS owner.


## Recommended build sequence

The numbers below are implementation phases, distinct from the board’s general Ideas → Design → Build → Test → Live status lists. Each phase card/task can move through those lists. Do not treat a list named Production as proof the feature is deployed.

| Phase | Deliverable | Visible proof |
|---|---|---|
| 00 | Inspect, plan and prepare the build | A repository-aware build plan, verified capability/model map and first implementation task ready for David to approve. No application build is claimed. |
| 01 | Secure foundation and shared records | An office user and a test employee sign in, see different permitted workspaces and access the same underlying records only within their scopes. |
| 02 | Controlled documents, tasks and basic approvals | The office publishes a site instruction, the right employee acknowledges that exact version, and an assigned task is tracked to completion. |
| 03 | Onboarding, verification and training status | Office creates one new starter; the employee uploads evidence; an authorised reviewer verifies it; training evidence produces an explained eligibility result. |
| 04 | Employee portal, questions, expenses and lifecycle | A test employee finds documents/training, asks a pay question, submits an expense and tracks the response without seeing internal notes or approving their own claim. |
| 05 | CRM, client requests and mobilisation | A prospect becomes a client without duplicate records, launches a site mobilisation and records an authorised request for additional cover. |
| 06 | Events, staffing, attendance and approved hours | Create one event or recurring site shift, allocate an eligible test worker, record attendance and separately approve payable and billable hours. |
| 07 | Operational delivery, evidence and equipment | A checkpoint observation or audit defect becomes an owned action; a supervisor can hand over an incident and track equipment without losing original evidence. |
| 08 | Finance preparation and specialist integration | Approved test work produces a reproducible pay/invoice preparation batch that survives a partial export failure and reconciles without duplication. |
| 09 | Client portal, controlled reports and analytics | An authorised client sees an approved report for its site; its totals reconcile to permitted source work and no other client/private staff data is exposed. |
| 10 | Broader automation and permission-aware AI | A user gets a cited explanation of a missing requirement or uninvoiced work and can explicitly approve a permitted suggested action. |
| 11 | Pilot and production readiness — reusable release gate | An accountable owner can approve a defined release using executed test evidence, migration/restore results, monitoring, support and rollback instructions. |


Each phase has its own file in `prompts/`, with scope, exclusions, suggested small tasks, model allocation and acceptance checks. There are twelve phase files (00–11). This is a sequence, not a promise of twelve single-session builds. Not every future feature must be included in the first release.

## Cost-aware lead and agent policy

This is a proposed **development workflow**, separate from the AI assistant that might later run inside the KSS product.

| Work | Proposed starting model | Reasoning starting point |
|---|---|---|
| Routine lead work and bounded feature implementation | `gpt-5.6-terra` | Medium |
| Specific read-only file lookup, test fixtures, documentation, repeatable small UI tasks | `gpt-5.6-luna` | Low/Medium according to the task |
| Architecture decisions, complex debugging, permission/financial/evidence review | `gpt-5.6-sol` | Medium; High for a justified difficult review |
| Hard unresolved cross-system problem after cheaper approaches have been assessed | `gpt-6-astra` | Explicit user approval; choose effort for the specific problem |

These starting choices are not a benchmark guarantee. The lead can recommend a different available model by stating the task, risk and reason. Measure cost to obtain a **passing, reviewed result**, including rework, not just unit token price. For a difficult sensitive change, starting at Sol can be cheaper than repeatedly failing at Luna. Conversely, do not make Sol or Astra review every label change.

Use Terra as the ordinary lead after initial architecture preparation. Use Sol for the bounded Phase 00 architecture review and for high-risk approval/security/finance work. Use Luna only when the expected output is explicit and readily checkable. A model called "reviewer" is not an independent professional security assessment.

### Rules to put into the project instructions

1. Delegate only where a separate task adds value. Prefer one agent for a small serial change. Permit **at most two concurrent subagents in addition to the lead**; default to one. Do not create one agent per future module.
2. No nested delegation. Use at most four subagent launches per bounded task without returning a new plan to David. These are project policy limits; the concurrency setting alone does not enforce a total spending ceiling.
3. Set the intended model and effort explicitly. Record the actual observed model/effort where the runtime exposes them. If not observable, say so. Never claim that writing a model name into a prompt has switched a running agent.
4. Every delegate receives a small task packet: objective, applicable requirement IDs, invariants, precise files/context, ownership, acceptance tests, model/effort, stopping point and return format. It may request missing context from the lead rather than guessing. Do not send the entire master and chat history to each worker.
5. Assign exclusive write ownership. Independent readers/tests can run concurrently; writers must not race on shared schema, permission policy, dependencies, lockfiles or route registries. Isolated worktrees/branches help only when supported and understood; they do not remove merge conflicts. The lead owns integration.
6. Perform one implementation attempt and at most two focused repair cycles on the same failure. Then narrow the task, escalate to an appropriate permitted model or report the precise blocker. Do not loop indefinitely or rewrite unrelated modules.
7. Luna → Terra → Sol escalation may be selected within an already authorised task for a recorded reason. Astra, more concurrency, added paid services or a new billing/authentication route require separate approval. Repeated Sol use is not a substitute for returning to scope when stuck.
8. Use normal/Standard speed and modest effort by default. Do not enable Fast, Max or Ultra merely to make every task "better". Verify supported settings; do not invent a configuration key.
9. Keep a per-task usage ledger. Record model, role, launches, attempts, tests and actual usage/credits/cost only when reported by the runtime or dashboard. Mark unknown metrics as not available; do not estimate an exact bill from elapsed time or text length.
10. Never bypass workspace restrictions, approval policy or sandbox rules to spawn a worker, switch model or run a test. Read-only role settings are defaults subject to the effective runtime policy, not a guarantee against every interactive override.

### What model configuration can and cannot do

Codex documentation supports model-specific subagents and configurable defaults. Defaults/custom-agent settings matter because unspecified workers may inherit the parent; custom-agent files can take precedence over requested defaults. Account/client availability and managed configuration still apply. Verify the effective settings rather than assuming a prompt is enforcement. [O1–O3, O6]

A lead cannot be assumed to reconfigure its own active model mid-turn. Select the lead model using the supported app/CLI controls; project defaults apply as supported for new sessions. The templates here are deliberately **inactive** until checked and merged. If this client cannot choose worker models, use one agent at the selected economical model or report the supported fallback; do not fake a multi-model team.

### Billing interpretation

With included ChatGPT/Codex usage, this policy aims to make the allowance last longer; it does not lower the fixed subscription fee. Purchased credits and API billing are different charging routes. Exact consumption depends on the route and work performed. Subagent work is additional usage, not free parallel capacity. A written spending instruction is a behavioural limit, not a provider-enforced hard financial cap. [O2, O5]

Do not switch to API billing, buy credits or enable paid tools automatically. Before an externally metered batch, agree a budget and use whatever actual metering/enforcement the provider offers; stop when the agreed threshold can be observed. When it cannot be observed, use bounded task/attempt limits and return for review, without claiming a guaranteed cash ceiling.


## Initial model configuration

`configuration-templates/` contains a small project configuration and four named worker definitions. Keep them inactive until Codex checks installed-client compatibility, available models and existing configuration. Merge selectively into `.codex/config.toml` and `.codex/agents/`; never replace global settings, change billing or weaken permissions.

The proposed parent/default lead is Terra Medium. The fallback subagent default is Luna Medium, so a strong parent does not silently make every child equally expensive. The normal implementation worker explicitly uses Terra; the risk reviewer explicitly uses Sol. Parent and worker settings are different controls. Defaults are not an unbreakable model allow-list. [O1–O3]

For Phase 00, select Sol Medium for the initial architecture work when available; ordinary follow-on work returns to Terra. Astra is an approved escalation, not the default parent or worker. Verify actual runtime settings on new sessions and after changes. No model is automatically switched by this downloadable document.

## Progress and evidence files

Use `docs/delivery/STATUS.md`, `DECISIONS.md`, `MODEL_ROUTING.md` and `USAGE_LEDGER.md`. Store individual task plans, reports and executed-test evidence under a small delivery subfolder created as needed. Keep them factual and short; do not dump private logs, secret credentials, entire repository contents or hidden reasoning into the ledger.

Create requirement-to-task/test coverage from R01–R30 and QA01–QA24. Do not mark the entire phase complete while provider work or security verification remains unresolved. Trello mirrors accepted decisions and verified status; it does not replace the Git change/test evidence.

## Practical continuation instructions

To continue within a phase: “Read STATUS.md and execute the next ready bounded task in Phase 03 only. Apply the model policy, test and report. Stop before another phase.”

To approve a phase transition: “I accept the demonstrated Phase 03 outcomes. Start the first ready bounded task in Phase 04, without production deployment.”

To resolve a review: “Fix the demonstrated findings in this task only. Preserve unrelated changes and rerun the affected tests. Do not use Astra or increase concurrency without approval.”

## Important boundaries

No token or credit saving has been measured yet for KSS. No provider purchase, new paid service, live payroll, client email, production import or deployment is authorised by these files. AI reviewers do not replace accountable human review where operational, financial or privacy risk requires it. The early pilot needs the same appropriate safeguards as a later release.

## Official reference notes — checked 22 September 2026

These sources verify Codex behaviour, not the quality, completion or cost of this KSS implementation. The phase order, concurrency limit, attempt limit and role policy are project recommendations.

- **O1 — Codex models:** `https://developers.openai.com/codex/models` (redirects to `https://learn.chatgpt.com/docs/models`). Current model identifiers, account/client availability and model controls.
- **O2 — Subagents:** `https://developers.openai.com/codex/subagents` (redirects to `https://learn.chatgpt.com/docs/agent-configuration/subagents`). Model inheritance, per-agent configuration and delegation.
- **O3 — Configuration reference:** `https://developers.openai.com/codex/config-reference`. Keys for default subagent model/effort and concurrency.
- **O4 — AGENTS.md:** `https://developers.openai.com/codex/guides/agents-md`. Repository instructions and their discovery/size limits.
- **O5 — Codex pricing/usage:** `https://developers.openai.com/codex/pricing`. Included usage, credits, API distinction and usage visibility.
- **O6 — ChatGPT sign-in:** `https://help.openai.com/en/articles/11369540`. Account/client availability and managed controls.

Recheck model availability and configuration compatibility in the actual installed client before activating templates. No numeric saving or total build price is promised. Older master product-research citations are preserved as supplied, not all re-researched for this delivery-policy update.

