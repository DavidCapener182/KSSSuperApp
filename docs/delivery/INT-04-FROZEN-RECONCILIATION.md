# INT-04 — frozen Integrated Baseline v1 migration/source reconciliation

**Verdict: PASS for migration/source reconciliation of frozen Candidate 1.** This is a catalog, provenance and accepted-source check in synthetic Development. It is not a database regression, remote SQL byte-for-byte attestation, staging replay approval, fixture cleanup approval, or product-wide acceptance. INT-02 owns the first integrated regression against current Development fixtures.

## Exact snapshot and method

- Frozen candidate: `4d38aa4cf4457fa90743e0bfc969520d3655b6b5` at `/private/tmp/kss-int01`; worktree clean when checked. No candidate file was edited.
- Target: dedicated synthetic Development project `dnfhkmmnlbiabqypclqg`. A fresh read-only Supabase migration-list call returned **193** entries.
- Canonical product source: **185** SQL files under `supabase/migrations`. **181** have exact descriptive-name and version ledger matches. **Four** have exact descriptive-name matches with documented local/remote timestamp differences. No local-only product migration, unexpected remote-only entry, duplicate local version, duplicate remote version or duplicate remote descriptive name was found.
- [INT-04-FROZEN-CANDIDATE-MIGRATIONS.csv](INT-04-FROZEN-CANDIDATE-MIGRATIONS.csv) records each of the 185 files with canonical path, name, local version, actual remote version, target ref, owning task, accepted-task source SHA-256 where explicitly supplied, report acceptance classification and match type. Acceptance labels describe task-report claims, not new INT-04 human acceptance.

## Explicit timestamp mappings and accepted SQL hashes

| Owner | Canonical local file | Actual Development ledger version | Accepted source SHA-256 check |
|---|---|---:|---|
| 21D | `20260925000333_task_21d_commitments_changes.sql` | `20260925000440` | `00b0f439…1184` matches report and frozen file |
| 21D | `20260925001749_task_21d_create_revision_guard.sql` | `20260925001912` | `dea3bd03…2862` matches report and frozen file |
| 20E | `20260925013000_training_completion_evidence_read_safe_20e.sql` | `20260925005845` | `23bf56e7…ab3` matches report and frozen file |
| 20E | `20260925104455_training_certificates_20e.sql` | `20260925105342` | `e6290b52…e02` matches report and frozen file |

The first 20E Completion migration, `20260925000018_training_completion_20e.sql`, matches the ledger version exactly; its accepted SHA-256 `2507b146…7ded` also matches the frozen file. The four differing timestamps are preserved as mappings. No applied SQL or remote history was renamed. The accepted reports provide source hashes for these five files; the migration-list API provides names and versions, not remote SQL bytes, so fresh remote byte equivalence was not independently established. No accepted-task source hash mismatch was found.

The reported clean 20E implementation HEAD `b913fd9` is an ancestor of close-out `f93f876`. The sole later commit is `f93f876`, changing only `docs/delivery/TASK-20E-REPORT.md` (7 insertions, 3 deletions). There is no product or SQL diff between these two commits.

## Eight expected remote-only Development entries

| Owner/class | Remote version(s) | Source / promotion handling |
|---|---|---|
| 06C synthetic SIA fixture | `20260924091902` | Canonical Dev-only file is `supabase/dev_only/20260924091837_dev_only_enable_06c_sia.sql`; intentionally outside `supabase/migrations`. |
| 08D temporary proof/recovery | `20260924141623`, `20260924141717`, `20260924141727`, `20260924141743`, `20260924143247` | Historical Dev proof entries, with no product source file in the frozen migration path. Do not replay as product migrations. |
| 22B synthetic Person fixture | `20260924201216` | Canonical Dev-only file is `supabase/dev_only/20260924235800_task_22b_synthetic_person.sql`; intentionally outside product migrations. |
| 19A accepted private Storage boundary | `20260925100018` | Source is `supabase/dev_only/20260925100018_operational_storage_server_boundary_19a.sql`, SHA-256 `183930bc…b055` as computed from the frozen file. The accepted Dev-only classification is preserved; no automatic staging/production promotion is implied. |

**Unexpected remote-only: zero. Missing canonical product source: zero. Dev-only files incorrectly inside `supabase/migrations`: zero.** The older consolidation audit's 170/187 counts and the moving INT-01 snapshot's 180/193 or 185/193 counts must not replace these frozen-snapshot results.

## Fixture, test and documentation debt

- The accepted 21D report measured 906 Staff A and 195 Staff B accumulated synthetic Event/Site Shift allocations at its verification point. INT-04 did not requery Person-level rows or alter fixtures; those numbers are historical evidence, not a fresh count. No deduplication or deletion is authorised before INT-02's first candidate regression against Development as it exists.
- The `site-shifts.test.mjs` 08A assertion reads the default `my_deployments_08a` page and expects its newly created allocation there. The RPC's accepted default is 25 rows and already supports `p_focus`. The 21D report recorded this test failure accurately. Classify it as **test-maintenance debt**, unless INT-02 finds contrary product evidence. After INT-02's first run, a bounded test change should query the exact new allocation with `p_focus` or deterministic pagination. Do not enlarge the product page, reorder allocations or delete fixtures to force a pass.
- `TASK-08A-REPORT.md` still says migration versions `20260924150000`–`20260924153400`. The old `STAGING-SYNC-RELEASE.md` explicitly maps those former local filenames to actual Development ledger versions such as `20260924115024`, `20260924115956` and `20260924121209`. The frozen source uses normalized actual-ledger filenames. This is **historical documentation debt**: verify original apply evidence and add a dated clarification; do not rewrite SQL history.
- The 21D report's statement that 19A had not yet been accepted at 21D verification is historically true. 19A was accepted later on 25 September. A dated later note may clarify sequence; do not rewrite the original verification claim or imply 21D tested a 19A adapter.
- Several accepted task reports and earlier staging/cutover ledgers describe earlier repository and environment snapshots. Their counts and acceptance limits remain time-specific. No worktree or report was deleted or rewritten by INT-04.

## Gates and unresolved evidence

This PASS is limited to frozen source versus Development migration ledger, accepted-task hash evidence, known mapping and classification. The ledger does not expose SQL body hashes, so **fresh remote SQL byte identity remains unverified by this read-only inventory**. INT-02's database-backed integration and current-fixture regression is the next authorised check. Fixture cleanup and the 08A test correction follow that first run and require separate ownership. No Supabase write, migration repair, fixture mutation, candidate edit, deployment or worktree cleanup was performed.
