# TASK-20E — Training Completion & Certificates: implementation record

**Status: PARTIAL SYNTHETIC DEVELOPMENT IMPLEMENTATION; NOT ACCEPTED.** Completion foundation is applied; certificate/PDF work remains stopped. No staging, production, real learner data or deployment.

## Approval and target

David approved the bounded 20E direction on 25 September 2026. Two apply attempts were rejected by automatic approval review because approval relayed from the lead task was not a trusted user message in this task. David then directly approved the exact frozen source, SHA-256 and target in this task. The next apply succeeded. The source bytes have not changed since the approval.

| Item | Exact value |
|---|---|
| Canonical baseline | `25dfb02dd5e1da087b0cc8034b2260d8c129122c` |
| Isolated branch/worktree | `task-20e` at `/private/tmp/kss-task-20e` |
| Literal Supabase project | `dnfhkmmnlbiabqypclqg` |
| Approved source filename before apply | `supabase/migrations/20260925103000_training_completion_20e.sql` |
| Canonical local migration, renamed to match applied ledger | `supabase/migrations/20260925000018_training_completion_20e.sql` |
| Frozen SQL SHA-256 | `2507b146ff0db4e7b8f58115cce375474065dc811a52a151bd58d3faac767ded` |
| Actual remote migration ledger version | `20260925000018` (`training_completion_20e`) |

The Supabase CLI was unavailable in this worktree. The migration file was created locally using the existing repository naming convention, then renamed after apply to match the actual remote ledger version without changing SQL bytes. The remote project `id` and `ref` were positively read as `dnfhkmmnlbiabqypclqg` immediately before successful apply.

## Local implementation

- Separate Office Admin `TRAINING_COMPLETION_MANAGER` grant, Super Admin grant/revoke, and attributable grant events. Role alone does not grant manager actions.
- Immutable published `CompletionRuleVersion` pins exact CourseVersion, all-page requirement, exact AssessmentVersion, pass evidence rule, effective interval, optional validity months, publisher/time and rule hash. Publication requires an active Office Training Publisher grant.
- First evaluation pins one rule to an exact Assignment case. Staff may evaluate only their own active assignment; a named Completion Manager may evaluate. Missing page marks or exact submitted PASSED Attempt returns factual unmet codes without a Completion. Successful evaluation creates one Completion and a snapshot of rule hash, page count and qualifying Attempt IDs. Assignment locking, unique keys and request-key payload hashing address concurrent evaluation and replay.
- Reasoned manager void preserves the Completion row and evidence while recording immutable correction history. No score, page mark or Attempt override exists.
- Direct table access to new records is revoked from `anon`/`authenticated`; all new public-schema tables have RLS enabled. Guarded RPCs use actor identity and fixed empty search paths.
- Staff My Learning has a completion check and history projection. Office has rule publication, manager evaluation and correction controls; Super Admin has grant controls.

## Certificate and PDF dependency

**Certificate issue, reissue, revocation, template publication, private PDF and download are not implemented or claimed.** TASK-19A confirmed its proposed server-only Storage boundary is unapplied and unaccepted; a certificate PDF built on its current private-object path would not meet David's requirement for fresh server authorisation without reusable Storage object paths. This portion was stopped. Completion and certificate remain separate; no certificate is issued automatically.

## Checks actually completed

- SQL syntax parser: 38 statements parsed from the frozen migration. This is syntax only, not execution or security proof.
- TypeScript `tsc --noEmit`: passed after Next generated route types.
- Next 16.3.6 Webpack production build with existing Development environment variables: passed.
- Existing 20C and 20D regression assertions were updated to check that all page marks or a PASSED Attempt alone create no Completion while direct base-table reads remain denied.
- Focused 20B, 20C, 20D and TASK-11A external shortcut regressions: **7/7 passed** against synthetic Dev after apply. Initial sandbox run failed to reach Auth (`fetch failed`); approved network execution passed.
- Focused 20E synthetic proof: **1/1 passed**. It exercised explicit rule publication, unmet page/pass outcomes, PASSED Attempt alone, all page marks alone, concurrent one-ID completion, request replay and changed-payload rejection, peer/Operations/Super role-only denial, manager void, historical readback and temporary grant cleanup. Readback after the test showed zero active temporary Completion Manager grants for the Office fixture. The first 20E test run met an existing active Training Author grant; the fixture was corrected to reuse existing grants and revoke only those it created.
- Remote ledger readback: `20260925000018 training_completion_20e`. All seven new tables show `rowsecurity=true`; no `anon` or `authenticated` base-table grants were returned. Ten `training_completion_*` public RPCs show `SECURITY DEFINER`, empty `search_path`, and execute ACL only for `authenticated` plus service roles.
- Authenticated Staff/Office desktop and genuine 390px evidence, and the full 20E synthetic proof, remain outstanding.

## Required before David's acceptance

1. Expand the 20E synthetic proof for retired CourseVersion/AssessmentVersion, cancelled/superseded Assignment, older AssessmentVersion explicitly accepted or denied, manager grant revocation, expiry date semantics and cross-domain no-mutation checks.
2. Finish the approved certificate issue/history/template/private PDF slice behind an accepted independent server-authorised delivery boundary, including fresh access checks, immutable PDF/hash, revoke/reissue, and dependent void invalidation.
3. Complete authenticated Staff and Office desktop and genuine 390px browser evidence, then return to David for acceptance. No acceptance is inferred from local checks.
