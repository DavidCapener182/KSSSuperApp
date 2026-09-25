# INT-01 synthetic Development integration candidate

25 September 2026. Candidate branch `int-01-enterprise-baseline`, isolated worktree `/private/tmp/kss-int01`. The shared `main` checkout was dirty and was not edited, reset or cleaned. No migration was applied, no Supabase data was changed, and no deployment was made.

## Inclusion ledger

| Work | Commit or lineage | Evidence and integration decision |
| --- | --- | --- |
| Canonical source | `25dfb02` | Source baseline close-out, including accepted 17B, 21B/21C, 20B/C/D, 12A, 08C/D, 10B, 16B, 22B, 23B and earlier accepted work. Its 19A product migration source is `9c28192`; its 17C implementation source is `2055165`. |
| 19A and 20E | `f93f876`, merged at `98a34ac` | Branch contains 19A acceptance `493df65`, operational document application files and Dev-only Storage boundary, plus accepted 20E completion/certificate source and report. No Dev-only SQL was applied here. |
| 21D | `00d11ac`, merged at `e390f22` | Accepted Service Delivery commitments and change control, two migrations and focused test. |
| UI02–UI13 | `e9263dd`, merged at `10dd98d` | Existing preview lineage includes UI02, UI03 and UI04–UI13 branches and closure evidence. CSS conflict in Training retained both 20E completion styles and accepted UI presentation styles. |
| UI08 acceptance close-out | `cb8bec5` reapplied as `17bb491` | The UI08 implementation was already in the preview lineage; its later documentation-only acceptance commit was not ancestry-reachable and is included without replaying source. |
| UI14 | final implementation `5f105a3`, preview `f71895d`, merged at `b04915e` | David directly accepted the remaining Mobilisation, Site Service and Site Book review on 25 September. Record anatomy across nine accepted routes is included. The overlap with 21D keeps both UI14 section navigation and 21D commitments/change controls. Acceptance close-out is appended to `TASK-UI14-CONTROLLED-ROLLOUT.md`. |
| 17C close-out | `edb69c1`, integrated as `988ffd5` | Canonical source already had the 17C implementation. A whole-branch merge conflicted with newer canonical changes, so only the accepted close-out wording, mobile controls, tests, screenshots and report were applied. The older branch did not replace canonical source or reverse later work. |

## Held out

| Work | Reason |
| --- | --- |

| TASK-20F, 21E, 21F, 07C, Home Needs Attention, Person Access & Grant Review | Outside this approved milestone. No source integrated. |
| Shared checkout dirty files and untracked artifacts | Not committed or copied into this branch. |

## Verification and limits

This candidate is synthetic Development source only. The production Webpack build passed after `npm ci` and nonfunctional synthetic Supabase URL/publishable-key placeholders were supplied; compilation, TypeScript, 67 static pages and route generation completed. Focused ESLint on the integration overlap paths and `git diff --check` passed. An initial build without these placeholders compiled and passed TypeScript but failed when prerendering `/staging-access` because Supabase configuration was absent. The smoke test could not bind `127.0.0.1` in the sandbox (`EPERM`). Database-backed task tests were not run: this isolated worktree has no approved Dev credentials and no database mutation was authorised for INT-01. Local checks do not establish human acceptance, live access or product-wide success. Accepted source reports retain their own route, persona and environment limitations.

## Candidate reconciliation and freeze evidence

The final UI14 implementation commit `5f105a3` is ancestry-reachable through `f71895d`. The accepted UI02, UI03, UI04–UI07, UI09–UI14 branch tips are ancestry-reachable; UI08's implementation lineage is reachable and its later acceptance-only `cb8bec5` is represented by `17bb491`. The accepted 19A `493df65`, 20E `f93f876`, 21D `00d11ac`, 17B `90935c9`, 21B `31caaf4` and 21C `eb5e5ee` are ancestry-reachable. The 17C branch tip `edb69c1` is intentionally not ancestry-reachable: newer canonical 17C source `2055165` is preserved, with accepted close-out changes represented by `988ffd5`.

The candidate has **185 migration SQL files** under `supabase/migrations`. The completed Next app manifest has **194 route entries: 63 page routes and 131 route handlers**. After UI14 source integration, `npm ci --ignore-scripts --no-audit --no-fund`, `next typegen`, `tsc --noEmit`, focused ESLint on integration/UI14 paths, the production Webpack build (with nonfunctional synthetic Supabase placeholders), and `git diff --check` all passed. The UI08 close-out added only documentation after these static checks. No database-backed tests or migrations were run by INT-01.

**INT-01 INTEGRATED BASELINE V1 CANDIDATE — FROZEN** at the commit that records this ledger. INT-02, INT-03 and INT-04 must validate that exact SHA. A later correction requires a new candidate SHA and affected validation to restart.
