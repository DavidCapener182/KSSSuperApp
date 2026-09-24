# KSS Enterprise — canonical source baseline close-out

Date: 25 September 2026. **Source/Git only.** No migration, database object, RLS/grant, Auth, Storage, Cron, environment variable or deployment was changed. No KSS Platforms project was accessed. This report builds on the [read-only consolidation audit](../delivery/KSS-ENTERPRISE-SUPABASE-CONSOLIDATION-AUDIT.md) and the [canonical manifest](SUPABASE-CANONICAL-BASELINE.md).

## Integration state

An isolated worktree at `/private/tmp/kss-source-baseline` uses branch `kss-source-baseline`, based on main `4d5125e`. The shared main checkout and the 17C/19A owner work were left intact. Source integration commits:

1. `6b97048` merges hosted `3fc59cc` into main ancestry. This preserves accepted 17B (`b8cac06`, `90935c9`) and 21B/21C (`82dfb9f`, `31caaf4`, `442570c`, `eb5e5ee`) task histories, their ten applied SQL files and associated accepted UI/routes/tests.
2. `2055165` integrates committed TASK-17C implementation from `c0f4456`, including two already-applied SQL files and application source. 17C is **not accepted**. Its owner-only verification follow-up `da0249f` remains outside this branch.
3. `9c28192` commits the ten already-applied TASK-19A product SQL files, each byte-identical to its remote historical statement. This commits only the applied schema source. The unaccepted 19A UI/application, new server-only PDF code and tests remain in the shared owner's checkout. The pending Dev-only Storage boundary candidate remains there and is **UNAPPLIED — SECURITY CLOSE-OUT PENDING**. No secret was copied or configured.
4. `b0ced14` restores the 13 divergent historical SQL files to their actual applied statements, resolves two additional 22B `CREATE` versus `CREATE OR REPLACE` drifts, names all product files with their actual remote versions, and moves two 03G files to `supabase/staging_history`.

The source integration HEAD before this report's documentation commit is `b0ced14`. The final branch HEAD is reported in the task response. No task acceptance is inferred from Git integration.

## The 13 SQL pairs

The [manifest's disposition table](SUPABASE-CANONICAL-BASELINE.md#the-13-formerly-ambiguous-sql-pairs) records each pair's domain, initial equivalence, difference, relevant forward-correction chain and canonical source. Twelve old local SQL bodies had substantive differences from the applied remote statements; the 20B `select 1` difference was only a terminating semicolon. All 13 now use the **actual remote historical SQL** as canonical source. This resolves source identity without claiming the old local edits had run. Subsequent migration files remain individually represented in remote order. Historical task reports were not rewritten.

There are now **180** normal product migration files and **180** applied remote product ledger entries. Every descriptive name and version matches. **167** SQL files are byte-identical to the historical remote statement; the other **13** differ only by line comments/formatting under normalization. **Zero** applied product migrations lack canonical source; **zero** SQL pairs remain unresolved. Remote-only rows are five 08D historical proof/test entries and two Dev-only activation/fixture entries. The 19A Storage policy is a separate unapplied Dev-only candidate. The two 03G deleted-staging files are historical source outside normal replay.

## Static replay analysis

- **Filename/version uniqueness:** 180 files, 180 unique versions, all equal to actual remote historical versions; no duplicate product name or version found.
- **SQL syntax:** all 180 files parsed with PostgreSQL grammar via `pglast`; zero parse failures.
- **Ordering:** an initial scan on old local filenames found 08D and 08C ALTERs ahead of their 08A/08B CREATEs. Aligning all filenames to remote versions removed those eight detected ALTER-before-CREATE cases. The final scan found zero among locally created tables.
- **Product versus fixture/proof:** no 08D proof/test migration, Dev-only SQL or 03G staging-only SQL remains in `supabase/migrations`. The Dev-only files activate a synthetic SIA rule or create a synthetic Person; they are not schema creators for the product files. The pending 19A policy was not copied into normal replay.
- **Historical sequence:** normal files sort in the same order as the applied remote product entries. The historical remote database accepted those statements with interleaved Dev-only/proof operations. No local clean-environment replay was performed, so data-dependent assumptions, extension setup and PL/pgSQL runtime behavior remain unproven.
- **Local replay runtime:** `psql`, `supabase` and `docker` were unavailable in the isolated checkout. No software was downloaded or local/hosted database created.

## Application and hosted preview

A local Next.js type generation plus TypeScript check passed. A local production build passed with a non-secret placeholder publishable key and the survivor URL; it did not make an authenticated hosted-app check. The first build without any public Supabase build values failed during prerender of the tracked `/staging-access` page, then the controlled placeholder build passed. No product test suite was run because those suites may write synthetic business data.

Git ancestry corrects the prior report's parity statement. Hosted `kss-enterprise-staging` was last read back as READY at source `3fc59ccee1341002f65472c831aea1e7d47aad35` on `staging`. Local main `4d5125e` and hosted `3fc59cc` **diverged** after `544627a`; neither was simply a descendant of the other. Hosted had the accepted 17B/21B/21C source that main lacked. The new integration merge combines both histories. Ordered source candidate after the currently hosted commit is:

1. Merge `6b97048` — combines accepted main work, including `fc05a9a` TASK-12A acceptance and `4d5125e` TASK-20D assessments acceptance, with hosted accepted 17B/21B/21C source.
2. `2055165` — TASK-17C implementation, **unaccepted**.
3. `9c28192` — already-applied TASK-19A product SQL source, **unaccepted**; no 19A UI/PDF work.
4. `b0ced14` — canonical migration identity/order corrections and 03G history separation.
5. This documentation close-out commit, after review of the candidate.

This is an integration inventory, **not deployment approval**. Hosted source lacks the new 17C route/UI even though its schema is already in the shared Development database. It also lacks 19A UI/routes while 19A schema is present. This database-ahead-of-source condition can make those capabilities unavailable in hosted preview; no specific authenticated route failure was proven. The 19A owner must separately finish its server-only PDF/security boundary and acceptance checks. The protected preview still shares the synthetic Development database.

## Repository hygiene and outstanding work

At the end of source integration, branch `kss-source-baseline` contains all 180 applied product migration sources. The shared main checkout remains dirty with unrelated tracked changes and untracked task/artifact files; none was reset or copied broadly. The 19A owner checkout retains untracked UI/API/server-only PDF files, tests, report and unapplied Storage candidate. The 17C owner branch retains `da0249f` verification follow-up. The 17B and 21B/21C branches/worktrees remain available but their accepted commits are ancestry-reachable through the merge. The isolated branch has only these three environment documents untracked before its documentation commit; generated build output and a dependency symlink are ignored. This preserves the owners' close-out boundaries.

## Limit and recommendation

This is a **source-identical, statically ordered baseline**, not an executed clean replay. The source-integration branch can map 17C application source and 19A schema to the current database, but the unaccepted 19A application and Storage boundary are intentionally separate. No new positive evidence of live KSS data emerged; the previous metadata-only provenance qualification remains.

David/ChatGPT should review this branch before lifting the migration pause. A clean disposable replay, when an existing suitable environment is available, would provide stronger reproducibility evidence. Existing 17C non-write verification can resume against its owner branch after review; 19A security close-out remains owner-controlled. No deployment or migration was performed.

## SOURCE BASELINE CLOSE-OUT

- **Canonical branch:** `kss-source-baseline`
- **HEAD:** source integration `b0ced14`; final documentation HEAD in task response
- **Local canonical product migrations:** **180**
- **Remote applied product migrations represented in source:** **180/180**
- **Unresolved SQL pairs:** **0**
- **Applied migrations missing canonical source:** **0**
- **Dev-only/proof migrations separated:** **YES** — two Dev-only, five remote proof-only, two 03G staging-only outside normal replay; 19A candidate pending outside branch
- **TASK-17C source integrated:** **YES** — `c0f4456` via `2055165`
- **TASK-17C acceptance status:** **UNACCEPTED; verification outstanding**
- **TASK-19A applied source integrated:** **YES** — ten applied SQL files; application/security close-out outstanding
- **TASK-19A Storage candidate status:** **UNAPPLIED — SECURITY CLOSE-OUT PENDING**
- **Hosted source parity:** **BEHIND** — `3fc59cc` versus isolated integration branch; no deployment
- **Static replay dependency check:** **PASS for checked syntax, version uniqueness and ALTER/CREATE order; clean execution untested**
- **Positive evidence of live data:** **NO**, subject to metadata-only provenance limits
- **Safe to resume existing 17C verification:** **YES for non-write verification after review**
- **Safe to resume 19A security close-out:** **YES for owner-controlled non-write work after review; Storage policy application remains paused**
- **Safe to create NEW synthetic migrations:** **NO pending David/ChatGPT review of this source close-out**

**STOP.**
