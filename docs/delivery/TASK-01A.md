# TASK-01A — runnable foundation and smoke test

Status: approved and accepted as locally verified by David. See `TASK-01A-REPORT.md`.

## Outcome and scope

Turn the existing default Next.js starter into a minimal KSS application shell with a documented local run command and one meaningful smoke test. Preserve the current framework unless the Phase 00 architecture decision changes. Use synthetic, non-sensitive content. This task does not implement authentication, database records, real navigation modules, app integrations or a dashboard claiming live data.

Dependencies: David accepts the Phase 00 architecture direction and Phase 01 task. Product identity/branding basics can be supplied; absent branding, keep neutral styling. Identity and database selections can be made in later Phase 01 tasks and should not be invented here.

## Files and ownership

Lead owns `src/app/`, `package.json`, lockfile, test configuration, `README.md` and delivery report. No parallel writer needs these shared files. Do not touch external systems or production configuration.

## Acceptance

1. Fresh `npm ci` succeeds on the documented Node version.
2. `npm run lint`, the smoke test, and `npm run build` pass.
3. Local browser shows a labelled KSS shell and a clear statement that operational data is not connected; mobile viewport has no page-wide overflow.
4. No invented users, compliance scores, incidents, financial figures or fake integration status appear.

Stop after recording exact commands/results and a browser check. Phase 01B identity and scope policy needs its own approved task and provider decision.
