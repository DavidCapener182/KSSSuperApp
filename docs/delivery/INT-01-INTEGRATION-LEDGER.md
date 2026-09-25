# INT-01 synthetic Development integration candidate

25 September 2026. Candidate branch `int-01-enterprise-baseline`, isolated worktree `/private/tmp/kss-int01`. The shared `main` checkout was dirty and was not edited, reset or cleaned. No migration was applied, no Supabase data was changed, and no deployment was made.

## Inclusion ledger

| Work | Commit or lineage | Evidence and integration decision |
| --- | --- | --- |
| Canonical source | `25dfb02` | Source baseline close-out, including accepted 17B, 21B/21C, 20B/C/D, 12A, 08C/D, 10B, 16B, 22B, 23B and earlier accepted work. Its 19A product migration source is `9c28192`; its 17C implementation source is `2055165`. |
| 19A and 20E | `f93f876`, merged at `98a34ac` | Branch contains 19A acceptance `493df65`, operational document application files and Dev-only Storage boundary, plus accepted 20E completion/certificate source and report. No Dev-only SQL was applied here. |
| 21D | `00d11ac`, merged at `e390f22` | Accepted Service Delivery commitments and change control, two migrations and focused test. |
| UI02–UI13 | `e9263dd`, merged at `10dd98d` | Existing preview lineage includes UI02, UI03 and UI04–UI13 branches and closure evidence. CSS conflict in Training was resolved by retaining both the 20E completion styles and accepted UI presentation styles. No route/security handler was broadened to settle the conflict. |
| 17C close-out | `edb69c1`, integrated as `988ffd5` | Canonical source already had the 17C implementation. A whole-branch merge conflicted with newer canonical changes, so only the accepted close-out wording, mobile controls, tests, screenshots and report were applied. The older branch did not replace canonical source or reverse later work. |

## Held out

| Work | Reason |
| --- | --- |
| UI14 branch `5f105a3`, preview `f71895d` | `TASK-UI14-CONTROLLED-ROLLOUT.md` says Mobilisation's revised view awaits visual acceptance; Site Book and Site Service await screenshot review. UI14 is not an accepted complete rollout. The candidate includes UI13 and earlier. |
| TASK-20F, 21E, 21F, 07C, Home Needs Attention, Person Access & Grant Review | Outside this approved milestone. No source integrated. |
| Shared checkout dirty files and untracked artifacts | Not committed or copied into this branch. |

## Verification and limits

This candidate is synthetic Development source only. A build, TypeScript, focused tests and diff checks must be recorded below with their actual outcomes. Local checks do not establish human acceptance, live access or product-wide success. Accepted source reports retain their own route, persona and environment limitations.
