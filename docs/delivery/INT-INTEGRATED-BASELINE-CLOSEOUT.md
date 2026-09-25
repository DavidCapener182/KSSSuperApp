# KSS Enterprise integrated baseline — technical close-out

25 September 2026. This records the technical classification of the frozen INT-01 source candidate. It is not human acceptance, deployment approval, or authorisation for any feature outside its own approved brief.

## Source decision

Frozen Candidate 1 `4d38aa4cf4457fa90743e0bfc969520d3655b6b5` remains the integrated **application source baseline** for individually approved next tasks. It has not been edited. Candidate 2 `d2922c9e5ff66da76a41a5a465b8ac99d038d5e7` contains only documentation and test changes relative to Candidate 1; no application or migration source differs. No new product defect was confirmed by the validation lanes.

The source baseline is technically cleared for separately approved, isolated worktrees. The shared `main` checkout remains dirty and has not been merged, reset or deployed by this close-out.

## Validation evidence and limit

- INT-03 reconciled the integrated UI and route set against Candidate 1 without a product-source finding. Its report is `/private/tmp/kss-int-03/docs/delivery/INT-03-FROZEN-RECONCILIATION.md`.
- INT-04 reconciled 185 local product migration files with the synthetic Development ledger, including four documented timestamp mappings and known remote-only proof history. Its report is `/private/tmp/kss-int04-inventory/docs/delivery/INT-04-FROZEN-RECONCILIATION.md`.
- INT-02's final full serial regression on Candidate 2's earlier test-only SHA `831cf5b8b13a40d01116fb534073a3798784b346` ran 77 tests: **75 passed, 2 failed**. This is not a full green run. The failures were 23B and 08A assertions that expected a historical fixture or newly created allocation in only the first page of otherwise paginated results. The 23B fixture was subsequently found in a later authorised page (43 total lines). Full log: `/private/tmp/kss-int-candidate2-regression-verified.log`.
- Candidate 2 `d2922c9` corrects those two test assertions to inspect all bounded pages. The affected tests passed **4/4** in `/private/tmp/kss-int-candidate2-pagination-targeted.log`. Earlier affected 21B, 20E and 02C tests passed **5/5** in `/private/tmp/kss-int-candidate2-targeted.log` after test-only fixture and timing corrections.
- The integrated source's production build, TypeScript, lint and diff checks passed on the same application source before the final test-only commits. No database migration, deployment or live-data change was made for this close-out.

The remaining verification limit is explicit: **there has not been a single 77/77 full regression run on `d2922c9`**. The full-run failures are classified as test pagination assumptions, supported by the authorised later-page read and passing targeted reruns. This limit must stay in the delivery record; it does not turn into a retrospective full-suite pass.

## Next work boundary

WF-01 may start from frozen Candidate 1 source in its own isolated branch because David approved that bounded Workforce implementation after integrated baseline closure. Its implementation still needs its own tests, review and acceptance. Other PRODUCT proposals remain planning work unless individually authorised. Do not change Supabase, deploy, merge to the dirty shared checkout, or use real KSS data as a consequence of this close-out.
