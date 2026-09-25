# TASK-20E — Training Completion & Certificates: implementation record

**Status: UNACCEPTED.** The core Completion decision is applied and its expanded synthetic proof passes. Exact Office evidence review is prepared locally and awaits approval for a separate guarded read migration. Certificate/PDF work remains blocked pending accepted TASK-19A private-file delivery. No staging, production, real learner data or deployment.

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

## A. Completion Foundation — implemented, with verification still open

- Separate Office Admin `TRAINING_COMPLETION_MANAGER` grant, Super Admin grant/revoke, and attributable grant events. Role alone does not grant manager actions.
- Immutable published `CompletionRuleVersion` pins exact CourseVersion, all-page requirement, exact AssessmentVersion, pass evidence rule, effective interval, optional validity months, publisher/time and rule hash. Publication requires an active Office Training Publisher grant.
- First evaluation pins one rule to an exact Assignment case. Staff may evaluate only their own active assignment; a named Completion Manager may evaluate. Missing page marks or exact submitted PASSED Attempt returns factual unmet codes without a Completion. Successful evaluation creates one Completion and a snapshot of rule hash, page count and qualifying Attempt IDs. Assignment locking, unique keys and request-key payload hashing address concurrent evaluation and replay.
- Reasoned manager void preserves the Completion row and evidence while recording immutable correction history. No score, page mark or Attempt override exists.
- Direct table access to new records is revoked from `anon`/`authenticated`; all new public-schema tables have RLS enabled. Guarded RPCs use actor identity and fixed empty search paths.
- Staff My Learning has a completion check and history projection. Office has rule publication, manager evaluation and correction controls; Super Admin has grant controls.
- A follow-up Office exact-evidence panel now reviews one Assignment before evaluation or void. David reviewed and **did not approve** the first read projection, `20260925010000_training_completion_evidence_read_20e.sql`, SHA-256 `1364bf916351ea9572f971ac932f55ddd248ee67323712736d6e2f1aab96f951`, because Staff could receive administrative actor IDs/reasons and raw event details. **Those bytes were never applied.** The revised local file is `20260925013000_training_completion_evidence_read_safe_20e.sql`, SHA-256 `23bf56e7d317573d4511ff2b2043db51cfab9f58c15e1f9134f699ae3ec6cab3`. It branches explicitly on Staff self versus named manager: Staff gets factual allowlisted fields; manager-only attribution is allowlisted; raw event details are never returned. The revised file has not been applied and awaits David's review of its full SQL.

## B. Certificate and PDF — blocked pending accepted server-authorised private-file boundary

**Certificate issue, reissue, revocation, template publication, private PDF and download are not implemented or claimed.** TASK-19A confirmed its proposed server-only Storage boundary is unapplied and unaccepted; a certificate PDF built on its current private-object path would not meet David's requirement for fresh server authorisation without reusable Storage object paths. This portion was stopped. Completion and certificate remain separate; no certificate is issued automatically.

## Checks actually completed

- SQL syntax parser: 38 statements parsed from the frozen migration. This is syntax only, not execution or security proof.
- TypeScript `tsc --noEmit`: passed after Next generated route types.
- Next 16.3.6 Webpack production build with existing Development environment variables: passed.
- Existing 20C and 20D regression assertions were updated to check that all page marks or a PASSED Attempt alone create no Completion while direct base-table reads remain denied.
- Focused 20B **1/1**, 20C **1/1**, 20D **1/1** and TASK-11A external shortcut **4/4** passed against synthetic Dev. A first combined rerun collided with temporary browser grants; the temporary author/assigner grants were revoked, then 20C and 20D passed sequentially. The remaining temporary Office Completion Manager grant was also revoked after the current browser proof.
- Focused 20E synthetic proof: **2/2 passed**. It exercised explicit rule publication, unmet page/pass outcomes, PASSED Attempt and page marks without automatic Completion, exact old/new AssessmentVersion policy, active/cancelled/superseded Assignment, CourseVersion and required AssessmentVersion retirement, historical Completion preservation, rule pinning, concurrent one-ID completion, request replay and changed-payload rejection, peer/Operations/Super role-only denial, guessed IDs, direct table read/write denial, reasoned manager void, named grant and immediate revocation. It does not yet assert the new full evidence projection.
- Expiry basis readback on the synthetic voided Completion `e5ab5e03-c5eb-4425-ba41-f5753a707d44`: immutable rule `8e6868db-19c7-4c79-bb62-fe739fa4eb6d` records 12 validity months, pinned rule hash matches, London completion date is 25 September 2026 and its calculated factual date is 25 September 2027. A separate null-validity rule returned a null factual date. These are source facts for possible later certificate policy, not credential invalidity, deployment eligibility or an issued certificate.
- Direct exact-ID void readback retained the original Completion, its 1/1 page-mark snapshot and the same current mark, its qualifying submitted PASSED Attempt ID/result, and separate `COMPLETED` and `VOIDED` events with distinct Staff/Office actors and the manager reason. No manual failed-rule Completion was created.
- Scoped cross-domain non-mutation: for synthetic Staff A, exact person-filtered row counts and JSON digests matched before and after one successful Completion evaluation and reasoned void across 19 onboarding, Credentials, Event/Site allocation, Availability, Time Away, Attendance and Event Worked Time tables. No pay/payroll/finance table exists in this Development schema. The synthetic Completion was retained as VOIDED. This readback proves those scoped rows were unchanged; it does not constitute an authenticated candidate-policy journey.
- Authenticated Staff desktop and genuine 390px browser proof showed exact Assignment/CourseVersion, 0/2 then 2/2 page marks, unmet page and assessment messages, PASSED Attempt without automatic Completion, explicit successful check, Completion history and no certificate card. At 390px, `scrollWidth=390`, control height 44px and visible keyboard focus. Screenshots: `output/playwright/task-20e-staff-desktop.png`, `task-20e-staff-check-390.png`, `task-20e-staff-history-390.png`.
- Authenticated Office desktop and genuine 390px browser proof showed the named manager grant, rule publication selector, manager evaluation and reasoned void retaining the original Completion ID. At 390px, `scrollWidth=390`, control height at least 44px, visible keyboard focus, text status cues and blue/neutral styling. Screenshots: `output/playwright/task-20e-office-desktop.png`, `task-20e-office-390.png`. That capture preceded the new exact-evidence panel, which still needs readback and browser verification.
- Relevant 03A onboarding test passed **1/1**. The 16B state/date boundary test passed **1/1**. The broader 16B Credentials integration test failed in isolation at an existing `latest_revision_id` expectation (`tests/credentials.test.mjs:78`): the current 16B migration sets this value on save. No 16B code or policy was changed here; the integration failure remains a separate regression limitation.
- New local changes: SQL parser accepted the revised follow-up read migration; TypeScript, Next 16.3.6 Webpack production build, focused ESLint and `git diff --check` passed before the SQL-only revision. Final rerun is needed after any approved remote read migration.
- The remote definitions of `private.current_person_id()`, `private.has_active_role(text)` and `private.training_completion_manager()` were read back after David's review. They require an active Supabase Auth identity mapping, a current effective unrevoked `OFFICE_ADMIN` role, and a named Completion Manager grant with `revoked_at is null`. The focused 20E test had already proved granted Office access followed by immediate denial after revocation. The revised read RPC is not applied, so its audience outputs still require remote proof after approval.
- Remote ledger readback: `20260925000018 training_completion_20e`. All seven new tables show `rowsecurity=true`; no `anon` or `authenticated` base-table grants were returned. Ten `training_completion_*` public RPCs show `SECURITY DEFINER`, empty `search_path`, and execute ACL only for `authenticated` plus service roles.
- Full repository regression was not run.

## Required before David's acceptance

1. If David approves the exact separate evidence migration, apply it to the literal synthetic Dev target, verify its ACL/guarded read, retained void snapshot and attribution; complete Office desktop/390px evidence with a new temporary named manager grant and revoke it afterward. The applied original migration remains frozen.
2. Finish the approved certificate issue/history/template/private PDF slice behind an accepted independent server-authorised delivery boundary, including fresh access checks, immutable PDF/hash, revoke/reissue, and dependent void invalidation.
3. Complete authenticated Staff and Office desktop and genuine 390px browser evidence, then return to David for acceptance. No acceptance is inferred from local checks.
