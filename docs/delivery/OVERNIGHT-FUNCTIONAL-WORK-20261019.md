# Overnight functional work — 19 October 2026

Baseline: current remote `main` verified at `a95d85079c33a3fd352bd190599864a79240c27c`. A fresh isolated checkout at `/tmp/kss-overnight-20261019` preserves all existing checkouts and avoids cloud-file placeholders. Locked `npm ci --ignore-scripts --no-audit --no-fund` completed. The original checkout remains at `e8922da9b18effb25c3a525a2d4391c6ff92ccdc`; its porcelain status SHA-256 remains `5f125a589e98ac9dfc5d5849ca8084769e1133cf6d060bd8139da81e777212b1`.

## Bounded scope

- `local_preview`: reproduce and repair current-read failure, stale response and retired-context handling in `crm-operational.tsx`, with dedicated synthetic tests. Preserve the published redesign and existing Complete/Reschedule implementation.
- `backlog_acceptance`: inspect the exact CRM writer and prepare an offline atomic concurrency proposal and tests. No migration application or live API cutover is authorised by this work.
- Coordinator: independently exercise existing Staff duty, My Work/calendar, report return paths and TFS contracts, review changes and verify one coordinated build. David authorised publication of finished, reviewed, tested work at 01:10 UTC. Unfinished dependent work remains isolated.

The live Trello board contains 110 open cards. `TRELLO-OVERNIGHT-SCOPE-20261019.json` records the relevant source cards. A checklist tick is not software or hosted acceptance. New feature ideas remain proposals; PARiM read-only reconciliation is a later candidate after the higher-priority functional work.

## Fresh completed checks

175 offline tests passed, zero failed/skipped, using `scripts/local-acceptance-network-guard.mjs`. Explicit selected suites: work filters/calendar, management report navigation, TFS Person assignment, Staff shift entry/duty/self-boundaries/self-readback, CRM task actions. No `.env` files, credentials, hosted sessions or database mutations were used. Log: `output/overnight-20261019/offline-acceptance-baseline.log`.

Existing report browser regression initially failed because its isolated fixture did not copy the existing shared Sheet stylesheet. Added that single missing fixture dependency, retaining all assertions. Fresh rerun: three Node tests passed (parent plus desktop 1280px and phone 390px journeys), covering reload/back/forward, exact Event/Site source and report return, filters/pagination, denied/invalid states and superseded responses. Ten fresh screenshots and source hashes are in `output/overnight-20261019/report-return/`. The 390px report capture was visually inspected. Historical output was restored after copying fresh evidence.

Existing CRM Complete/Reschedule and My Work calendar browser regression: twelve Node tests passed, zero failures/skips. At 390px/1280px they cover explicit confirmation, pending/duplicate submission, keyboard/focus, rescheduling and deadline removal, exact current readback, stale/denied/uncertain responses, safe refresh, history, London calendar dates/DST, filters, source links, loading and unavailable states. Fresh evidence contains 20 CRM captures and 13 calendar captures, with source hashes and layout records; copied historical regression subfolders were removed. These existing features were verified rather than reimplemented.

## Remaining gates

Hosted authenticated/RPC/RLS/Storage/Duty acceptance remains open. It requires approved ordinary persona sessions, scoped disposable fixtures and the exact authorised environment. Stored invalid credentials, previously denied database metadata and protected-token operations are not retried. No live database migration, real Staff assignment, credential, permission, authentication-protection or TLS change is included. The existing exact-Duty proposal belongs to its separate thread and is not duplicated. Source recovery evidence is not a database/Auth/Storage backup.

## Reviewed implementation and combined validation

The current-read CRM repair is complete locally. Both Pipeline and record work now hide facts after a denied current read, reject obsolete responses, and stop retired mutation continuations from reading back or clearing a new context's draft. Product scope is one file, `src/components/crm-operational.tsx`, SHA-256 `706b89eebdc019179742cab3bcbe5ad7d98965f11f8d2694a23cbd200b51052d`. Existing request URLs, payloads, source identity and server authority are unchanged. Existing Complete/Reschedule is preserved. Independent diff review found no blocking product regression in this bounded change.

Fresh coordinated verification: production Webpack build passed with synthetic public placeholders; standalone TypeScript passed; full lint passed with zero errors and the existing unused `officeId` warning. The broad network-blocked suite passed **885 tests, zero failures, one explicitly skipped PostgreSQL runtime test**. That runtime was then supplied explicitly in a separate independent invocation: **35/35 PostgreSQL results passed, zero failures/skips**. These counts are separate runs with overlapping static coverage, not an additive product acceptance total. Logs are under `output/overnight-20261019/`.

Several historical presentation tests pin every source file. Their only mismatch was this authorised CRM repair. Historical inventories remain unchanged; tests now name the exact old/new CRM bytes through a reviewed source-delta receipt and retain all other file/hash assertions. This is an explicit functional revision, not a claim that the old UI-only preservation scope still applies.

CRM browser packet: eight final before/after records at 390px/1280px passed, including denied-read clearing, recovery, retired write continuation and keyboard focus. The coordinator inspected the 390px cleared state and desktop recovery images. Failed early fixture/alert synchronisation runs remain labelled diagnostics. See `CRM-READ-LIFECYCLE-20261019.md` and its frozen packet for exact source hashes and limitations.

The offline CAS proposal reproduced the legacy stale-write race and rejected its stale loser in actual local PostgreSQL, with rollback/authority/ACL/ABA/null/malformed-token coverage. It changes no active API, existing RPC, table, policy or migration. Current production CRM traffic still uses the legacy writer; approved target/schema/permission/client cutover is required before claiming live CAS protection. See `CRM-FOLLOW-UP-CAS-20261019.md`.

Publication is recorded separately only after the remote push and deployment metadata have been verified.

## Publication and final proposal

Normal fast-forward push to main completed at `ee81c6316ab4221c0aa852ad56c984a931824a07`, including product commit `516eca7a81940f8a49568b4fa89d92876aa964ed`. Remote main was read back exactly. Vercel `dpl_GioDpeqgJNxsFqF8ADQXTJH69DF3` is READY for that SHA and production target, with `https://kss-enterprise.vercel.app` attached and no alias error; GitHub's Vercel status is success. This is release metadata, not signed-in hosted acceptance. The original checkout's HEAD/status remain unchanged.

The next eligible PARiM slice is complete as an explicitly synthetic identity-link preview under `docs/delivery/proposals/`, with no app/API/provider adapter or writes. Independent 39/39 tests passed and scoped lint passed. It uses only the existing source-link identity structure; unknown/duplicate/ambiguous IDs require review, provenance separates raw/semantic hashes, and scoped replay/conflicts are factual preview results. Review found duplicate JSON keys were initially accepted; the parser now rejects duplicate decoded keys, including escaped equivalents, with tests. `docs/delivery/evidence/parim-reconciliation-20261019/sample-preview.json` is the concrete synthetic review result. Actual export fields, ownership, completeness/deletion rules, freshness, retention and authorised access remain required before a vendor adapter.

The final broad network-blocked suite includes the PARiM tests: **924 passed, zero failed, one explicit PostgreSQL-runtime skip**. The separate actual PostgreSQL invocation remains 35/35 with zero skips. Hosted authentication/RPC/RLS/Duty, live CAS cutover, external app/source decisions and human acceptance remain open; no entire-product completion claim is made.
