<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## KSS project scope

- Read `docs/delivery/STATUS.md`, `DECISIONS.md`, and the current phase brief before changes. The master specification is the product reference, not authorisation to build every feature.
- Work on one bounded, approved task at a time. Do not advance phases, connect live data, deploy, or add paid services without David's approval.
- Inspect the current tree first; preserve unrelated work. Keep secrets and personal records out of code, fixtures, prompts and logs.
- Enforce role, action and record scope on the server, including files, search, export and AI. A linked private file does not inherit a wider audience.
- Preserve stable identities and exact evidence versions. Uploaded is not verified; observed hours are not approved payable or billable hours; local save is not server acceptance.
- Use synthetic data until a specific live source and its access rules are approved. Label simulations and unverified integrations.
- Prefer a single agent. If delegation is explicitly authorised, use no more than two concurrent workers, no nested delegation, and exclusive file ownership. Do not use GPT-6 Astra without explicit approval.
- Record actual checks and evidence in `docs/delivery`; do not claim human acceptance or production readiness from local tests.
