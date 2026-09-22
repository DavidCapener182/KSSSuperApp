# KSS repository working rules — merge with existing AGENTS.md

This is a template. Preserve existing valid project instructions; the lead must adapt paths and discover real setup/test commands in Phase 00. Do not invent commands or replace global settings.

## Scope
- The master under docs/specification defines the product, not the current authorisation.
- Read docs/delivery/STATUS.md, DECISIONS.md and the selected phase/task brief.
- Execute one ready bounded task; stop after verification/reporting. Do not advance phase without David’s approval.
- Research proposals are not all accepted MVP scope. Record changes rather than silently dropping requirements.

## Models and agents
- Verify runtime models/settings. Ordinary lead/implementation: gpt-5.6-terra Medium.
- Bounded lookup/fixtures/docs/simple repeatable work: gpt-5.6-luna Low/Medium.
- Difficult design/security/financial review: gpt-5.6-sol Medium/High.
- gpt-6-astra requires explicit approval. Report unavailable choices; do not fake model switching.
- Default to one agent. At most two concurrent subagents plus lead; no nested delegation; at most four launches per task without a new plan.
- Give workers only applicable requirements, invariants, files, test objectives and exclusive write ownership. Lead owns shared schema/policy/interfaces and integration.
- At most two repair cycles for the same failure before reassessing. Do not endlessly spawn reviewers or rewrites.
- Keep ordinary speed/effort modest. Do not change billing, buy credits or enable paid tools automatically.

## Product invariants
- One person/client/site identity; scoped, server-enforced permissions, including files/search/exports/AI.
- Uploaded != verified; acknowledged != understood; eligible != deployed/accredited; scanned != checked.
- Observed hours != approved pay/bill; approved expense != paid; locally saved != server accepted.
- Preserve original evidence and exact document versions; replay safely; expose stale/unknown states.
- No mandatory legal-rule override, autonomous employment decisions or live financial action by assumption.

## Engineering
- Inspect before editing; preserve existing architecture and uncommitted work.
- Build complete small journeys with persistence, error handling, authorisation and tests.
- Mark simulations/adapters honestly. Do not expose fake integrations or placeholder modules as complete.
- Keep secrets and sensitive personnel data out of test fixtures, prompts, code and generic logs.
- Do not weaken sandbox/approvals. Existing runtime or workspace rules still control permissions.

## Verification and handover
- Discover actual build/lint/typecheck/test commands from the repository and record them.
- Run affected tests. Report executed/pass/fail/not-run separately; never claim an unrun test passed.
- Review high-risk changes independently; integrate and recheck the affected complete journey.
- Update STATUS, task report and usage ledger with observable facts only.
- Local verification is not human acceptance or production authorisation.
- Any live pilot needs the Phase 11 gate for its scope. No unapproved deployment, destructive migration, external messages or money movement.
