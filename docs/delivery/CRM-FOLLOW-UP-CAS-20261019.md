# CRM follow-up atomic concurrency proposal — 19 October 2026

The current CRM writer locks the task row but accepts a stale review if the task remains Open. In an actual two-session PostgreSQL reproduction, two clients reviewing the same original deadline both rescheduled successfully; the second overwrote the first. The offline additive CAS proposal now rejects that second stale operation before adding any history or audit.

## Scope and boundary

Baseline: exact GitHub main/local clone `a95d85079c33a3fd352bd190599864a79240c27c`, `/tmp/kss-overnight-20261019`. Scope comes from David's prioritised CRM follow-up concurrency task and the coordinator's bounded local assignment. Existing Complete/Reschedule UI is already delivered and was not rebuilt. Other worker owns `crm-operational.tsx`; this lane changes no application source, API, existing migration, table, role, existing RPC grant or policy.

Executable proposal: `docs/delivery/proposals/CRM-FOLLOW-UP-CAS-20261019.sql`. It is deliberately outside `supabase/migrations`, is not applied to hosted services and is not an active product cutover. The only execution was in automatically destroyed local synthetic PostgreSQL clusters. It adds two opt-in signatures; no existing signature is replaced.

## Atomic design

1. `crm_follow_up_cas_snapshot(id)` checks the existing current-Person/CRM-role predicate and locks the exact CRM task for a consistent snapshot. It returns task/source identity, state, assignee, nullable deadline and immutable history count as decimal text. It exposes no new role/record population beyond the existing CRM task read authority.
2. `crm_change_follow_up_cas(id, expected, action, assignee, due, reason)` checks the same current authority, validates the expected snapshot and obtains the same exact task row lock as the existing writer. Only then does it compare source identity, Open state, assignee, nullable deadline and history count.
3. History count is monotonic because source history is immutable and existing CRM writers require an event. It detects an A→B→A change even if values and `updated_at` return to the reviewed state. No global task revision column or new trigger is introduced. Document-review task semantics stay outside this function.
4. A mismatch raises `PT409` before a mutation. A match delegates to the unchanged `crm_change_follow_up` in the same transaction. Its action/owner/source/state/history/audit guards remain authoritative. The wrapper returns the one new attributable event ID and new count, or raises and rolls back if its receipt cannot be established. History/receipt checks never turn a missing result into success.

Expected keys are exact and required. Decimal text avoids JSON number precision loss; malformed, signed, fractional, zero, leading-zero and bigint-overflow counts are rejected. Deadline comparison uses `IS DISTINCT FROM`, including deliberate null removal; non-ISO/non-finite/invalid dates are rejected. The new signatures explicitly revoke PUBLIC/anonymous execution and grant only the same existing authenticated role guarded by the existing CRM authority. Existing grants and existing function definitions remain unchanged. These are proposed DDL permissions in a file, not permissions changed on any hosted database.

## Fresh evidence

Final explicit local command passes **35/35 Node test results, zero failed/skipped**: 33 SQL scenarios plus their parent and one static staged-contract test. Evidence: `output/crm-cas-20261019/postgres-run.tap` and `postgres-evidence.json`.

- Real baseline two-session stale reschedule race: both legacy writes succeed under the row lock; deadline/history readback confirms the second write wins.
- Real CAS two-session races with each deadline winning in turn: the second session is observed waiting on a PostgreSQL lock via `pg_stat_activity`; after first commit it receives PT409. Exactly one new history row and audit row survive. The runner does not infer lock blocking from a sleep.
- Stale completion/reschedule after reschedule, completion or cancellation; null deadline/removal; same-transaction ABA; no-op and invalid action; wrong task/source/assignee; malformed expected tokens, null/extra/missing keys, invalid date/UUID and bigint overflow.
- Existing owner completion authority after reassignment; Staff/Operations and revoked-role denial; role revoked while CAS waits for the row lock is rejected by the existing writer after the wait.
- Injected synthetic audit failure proves the task and history roll back together. Rejected calls leave history/audit counts unchanged. New function ACLs deny anonymous/PUBLIC execution; `pg_get_functiondef` confirms the existing writer remains exact after proposal installation.
- Focused ESLint passes; proposal/test patch whitespace checks pass. No JavaScript race simulation is presented as transaction proof.

An initial fixture run omitted the foundation's existing SELECT privileges on CRM source tables, so the source task RLS predicate correctly denied a direct fixture read; this was corrected in the fixture to match the source-existing grants. No proposal/security weakening was made to obtain a pass. For the same-transaction ABA case only, the fixture temporarily uses ordered synthetic event UUID defaults: the unchanged source guard sorts equal-timestamp history by UUID, and random UUIDs would otherwise make a valid multi-action fixture nondeterministic. The ordinary default is restored. No guard/business function is replaced. This is fixture control, not a production ordering repair or a claim about all real same-transaction writer sequences.

## Reproducible local runtime

A normal reviewed public npm download supplied pinned `@embedded-postgres/darwin-arm64@18.4.0-beta.17` into `/tmp/kss-crm-pg-runtime-20261019`, with package lifecycle scripts disabled. Its tarball SHA-512 was checked against npm integrity before extraction:

`Kg1ZMNFzkVIJs3g4V2UYEc5X005km9rGinxFBH8R1sOU2Rblvz4pt2Uf93Pu8Rk273Ue9HIdrbMPpgUqwjUi0Q==`

Only library symlinks inside that extracted package were restored after inspecting the package metadata/script. No global install, launch service, user creation, certificate/security change or host configuration was performed. The pinned `pg@8.16.3` client and lockfile are in the separate temporary runtime directory, not the application package/lockfile. Runtime provenance is saved in `output/crm-cas-20261019/runtime-provenance.json`.

Run from the clone:

```sh
KSS_CRM_PG_BIN=/tmp/kss-crm-pg-runtime-20261019/package/native/bin \
KSS_CRM_PG_MODULE=/tmp/kss-crm-pg-runtime-20261019/client/node_modules/pg \
node --test tests/crm-follow-up-cas-postgres-local.test.mjs
```

Without both explicit runtime variables, the transaction suite is skipped and only the static contract check runs; that default cannot be reported as database proof. The suite starts its own private temporary Unix socket, uses no external host, sets `listen_addresses=''` and socket permissions 0700, and stops/deletes the cluster in cleanup. Evidence confirms PostgreSQL **18.4**, empty TCP listener setting, stopped cluster and deleted temporary directory. No application `.env`, hosted credential or existing user session is loaded. The local client has an explicit synthetic unused password; no real credential is requested.

The fixture derives the actual task table, CRM alterations/event table, writer, task/event guards, task policy, CRM authority/owner helper and audit function from pinned source migration files. Identity and role-session prerequisites are explicit synthetic local adapters; CRM source tables and audit prerequisites are minimal. This does not replay every baseline migration or establish hosted Auth/JWT/PostgREST, full database/RLS parity, private Storage or Production acceptance. Current documentation reviewed: [PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html), [Supabase database functions](https://supabase.com/docs/guides/database/functions) and [Supabase changelog](https://supabase.com/changelog). Markdown changelog retrieval was unsupported; official HTML was read. The recent TLS HTTP deprecation does not change this Unix-socket-only proposal; no TLS bypass was attempted.

## Deployment and client cutover gate — still open

This is an independently reviewable atomic opt-in contract, **not a claim that current CRM traffic has CAS protection**. The current API and existing clients still call the legacy writer. A legacy direct caller can still issue a later unguarded stale write. The new wrapper detects legacy changes made before its locked comparison, but cannot make those legacy callers concurrency-safe.

Before active rollout, obtain named-target migration/permission cutover authority; verify live schema/helper/trigger/ACL parity and all CRM writer paths; add snapshot-count projection to the relevant authorised reads; carry the reviewed expected token through every change path; route only to CAS with explicit 409 conflict/refresh, malformed-token 400 and unavailable-contract 503 handling. Never silently fall back to the legacy writer. Keep exact actor/source event receipt and fresh state readback; a POST success alone is not final current-state proof. Old clients/direct RPC access need a separately approved coordinated retirement or equivalent enforcement before fleet-wide concurrency closure. Do not revoke/change the old signature on the strength of this local proposal alone.

No API/client integration was made before that gate, so publishing these proposal/test files cannot call a nonexistent hosted RPC or break the existing deployment. No hosted SQL/query, live migration, existing permissions/credentials change, push, merge or deploy was performed by this worker. The original dirty checkout remains untouched. Root owns independent review and any publication of completed local work; the database cutover remains explicitly unfinished.
