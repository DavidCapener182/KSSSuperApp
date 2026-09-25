# INT-02 — test-only validation repair handoff

Date: 25 September 2026. Base and frozen Candidate 1: `4d38aa4cf4457fa90743e0bfc969520d3655b6b5`. This branch (`int02-validation-repair`, `/private/tmp/kss-int02-repair`) contains test and harness corrections only. It is **not Candidate 2** and has not been merged. INT-01's frozen commit and the shared checkout were not edited.

## Scope and target

Used only synthetic Development project `dnfhkmmnlbiabqypclqg` and the same copied, ignored local environment files verified in the Candidate 1 report. Existing tests created bounded synthetic business records and temporary grants. No product source, migration, schema, RLS/policy, Auth configuration, Storage configuration, environment value or deployment was changed. Historical synthetic test records remain by design; exact residual row counts were not audited. Temporary grants retain each test's established `finally` revocation path.

## Test-file diff

| Path | Bounded correction |
| --- | --- |
| `tests/availability.test.mjs` | Select an exact empty interval through authoritative preview, paginate availability/deployment/history reads after accumulated fixtures, and prove same-Staff Availability edits leave Time Away requests unchanged. |
| `tests/credentials.test.mjs` | Read the exact prior 16B claim revision after reviewer grant and assert draft save does not create a submitted revision. Reused synthetic Staff history is preserved. |
| `tests/helpers/auth-session.mjs` and `tests/auth-session.test.mjs` | Cache the token pair returned by `setSession` and test refresh-token rotation; retain project/persona cache isolation. |
| `tests/shell.test.mjs` | Add the accepted 19A Operational Documents route to each entitled role's expected navigation. |
| `tests/staffing.test.mjs` | Expect the current accepted catalogue of nine roles instead of eight. |
| `tests/site-book.test.mjs` | Generate an additional current synthetic duty and choose an allocated duty inside 14A's existing one-hour write window; no access policy is widened. |
| `tests/site-shifts.test.mjs` | Include the existing synthetic Staff Zero in the exact candidate pool and select two available, distinct Staff for the same 08A clash proof. Existing focused deployment assertions remain. |
| `tests/controlled-documents.test.mjs` | Prove the same Staff's controlled-document acknowledgement leaves Training completion facts unchanged. |
| `tests/training-certificates-20e.test.mjs` | Prove the same Staff's credential claims/revisions/decisions remain unchanged through certificate issue and Completion void. |

The 20E app URL was supplied to the runner as `KSS_20E_APP_BASE_URL=http://127.0.0.1:3197`; a production Webpack build of unchanged product source ran on that isolated local port and was stopped after testing. The full-suite script itself was not changed.

## Verification

- `npm ci --offline --no-audit --no-fund`: passed. `npm run build`: passed. `npm run lint`: passed with one pre-existing unused-variable warning in `tests/site-horizon-maintenance.test.mjs`. `git diff --check`: passed.
- Targeted repaired 01D/session, 14A, 08A, 16B and 07A tests passed. 16B required one test-order correction after the first repaired run showed its pre-grant baseline projection was empty; no product change followed.
- Full serial command: `KSS_20E_APP_BASE_URL=http://127.0.0.1:3197 npm run test:regression` against synthetic Development. **77 tests; 76 passed, 1 failed, 0 skipped, 0 cancelled.** Log: `/private/tmp/kss-int02-repair-regression.log`. The added Auth-session unit test accounts for the increase from 76 to 77 tests. All ten Candidate 1 failures passed in this run, including 17C, 19A, 20E certificate/private PDF/void, 21D, 07A, 16B, 08A and 14A.
- The one full-run failure was TASK-10B at `event_work_time_manager_action(APPROVE)`: Supabase returned `canceling statement due to statement timeout` after about 45 seconds. The unchanged `tests/work-time.test.mjs` passed an isolated rerun **1/1 in 9.2 seconds** (`/private/tmp/kss-int02-repair-10b.log`). This is classified **D — transient database/test-environment timeout**. No 10B source or test was changed, and the full suite must not be called all-pass.
- Added same-Person checks then passed targeted serial run **3/3**: `tests/availability.test.mjs`, `tests/controlled-documents.test.mjs`, and `tests/training-certificates-20e.test.mjs` (`/private/tmp/kss-int02-repair-cross-domain.log`). These checks were added after the full run and therefore are evidenced by this targeted run, not included in the full-run assertion count beyond their original tests.

## Journey and negative-boundary status

| Journey | Status | Evidence and remaining limit |
| --- | --- | --- |
| Commercial CRM → Mobilisation → Site/Event → staffing | **PASS at domain seams** | CRM, 06A, 06B, 06C, 08A, 17C and 18A passed serially. A single same-record chain was not constructed. |
| Staff onboarding → Training/evidence → Availability/Time Away → deployment → Attendance → Worked Time | **BLOCKED as a complete journey** | Constituent tests passed except a transient 10B full-run timeout; 10B passed isolated rerun. Same-Person Availability ≠ Time Away passed targeted. No one synthetic Person traversed the entire chain. |
| Training Course → Assignment → Assessment → Completion → Certificate/PDF → revoke/reissue → void | **PASS** | 20B–E passed serially; same-Person Certificate ≠ Credential verification readback passed targeted. Deployment eligibility was not tested by this certificate check. |
| Operations Workforce → duty → Control Room → Incident/Site Book | **PASS at domain seams** | Workforce, 08A/09B, Control Room, Incident and Site Book passed serially. No single duty was carried through all surfaces. |
| Service Delivery → Commitments/Changes → exact source application | **PASS** | 21B/C/D passed serially, including Management approval ≠ authoritative source application. |

Operational Document and Certificate direct Storage denial remained in the passing 19A and 20E tests. Same-Person Document acknowledgement ≠ Training completion passed targeted. Allocation acceptance ≠ Attendance ≠ Worked Time and CRM WON ≠ Mobilisation ≠ Event delivery remain independently asserted by their passing domain tests; a combined same-record proof was not added. Training Certificate ≠ deployment eligibility remains **UNTESTED** as a cross-domain transaction.

## Handoff verdict

The test-only patch resolves or stabilises all ten originally classified Candidate 1 failures in the full run. One new, non-reproducing TASK-10B statement timeout leaves the full-suite result **FAIL (76/77)**. No confirmed product-source defect emerged. The coordinator should decide whether an isolated, controlled full-suite rerun is worth the synthetic fixture cost, or retain the classified timeout and targeted 10B pass as an explicit gate exception. Do not merge this branch or declare Candidate 2 from this report alone. Any accepted integration commit needs a new SHA and affected validation against that SHA.
