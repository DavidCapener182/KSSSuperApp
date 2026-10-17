# Sign-in contract verification — 17 October 2026

The redesigned sign-in presentation preserves the tested authentication/access behavior. Added only `tests/sign-in-contract-local.test.mjs` and this report; no product or shared test was edited by this QA lane.

## Exact results

- **14/14 tests pass** against frozen `baff9dc` SignInEntry/page source in the isolated acceptance checkout. Baseline component SHA-256: `02633e8cdcf24fa029f41ce7230b7fb9d1874f84744db6fe81ca4675a7426307`.
- **14/14 tests pass** against the designer's frozen presentation source. Current component SHA-256: `e10d5140df2cd936cb9d7b4b14306d6a7299a20babb58fd8607a97813325d180`. Page SHA-256: `b2cbefadcc34aeb05514e9af6f9a3dbaae7a626fab39acc70d4a1aaf0cbf4664` (unchanged baseline page).
- Final run uses the acceptance lane's network guard in addition to explicit synthetic Supabase/fetch mocks. Zero failures/cancellations/skips. Focused ESLint passes without warnings.
- Test SHA-256: `4d7282c0c42d69c5eaec19f807f3682c25b7b65db56cb701e5fa2e523f0ffde9`.
- DUTY-01 functional component remains SHA-256 `84d03a2851e36a5bb785242a4d86e07ec4158b2aa8f11d4026a4350390afba70`; this lane made no Duty changes.

## Behavior covered

Tests transpile and execute actual SignInEntry and the server entry page, using a deterministic hook lifecycle plus synthetic auth and `/api/me` responses. Assertions cover:

- `getUser` absent/error, checking state and no API call without an authenticated user.
- Authenticated API 200 navigates to the exact supplied return target only after the deferred access result resolves. API 401 exposes sign-in, 403 exposes no Enterprise access, and 503/network failure exposes unavailable/retry without navigation.
- Successful email/password authentication still requires the API access check. Post-login API 401/403/503 never claim entry.
- Required email/password inputs, accessible labels, username/current-password autocomplete, busy submit disabling, password clearing after response and safe failure messages.
- No-access sign-out stays busy until auth success, then clears the form. A returned sign-out error retains no-access state, reports failure and enables retry without claiming logout.
- Actual entry-page use of the existing `safeReturnTarget`: unsafe/unknown/multi-value destinations fall back to `/app`; exact allowed duty allocation/source query survives unchanged.

Tests deliberately permit presentation and explanatory-copy changes. Error checks assert semantic failure and no false navigation rather than the earlier development-specific sentence. UI primitives/icons/CSS are presentation mocks; authentication dependencies are explicit fixtures, not real sessions. Test state contains only synthetic values.

## Reproduction and evidence

Run `node --test tests/sign-in-contract-local.test.mjs` from `kss-redesign`. An optional `KSS_SIGN_IN_SOURCE_ROOT` points the test at a frozen local baseline; it never loads an application environment file.

Executed baseline command: `KSS_SIGN_IN_SOURCE_ROOT=/Users/davidcapener/Documents/Codex/2026-10-17/task-3/kss-acceptance node --test tests/sign-in-contract-local.test.mjs`. TAP: `/tmp/kss-sign-in-contract-baff9dc.tap`.

Executed final command: `node --import ../kss-acceptance/scripts/local-acceptance-network-guard.mjs --test tests/sign-in-contract-local.test.mjs`. TAP: `/tmp/kss-sign-in-contract-final.tap`.

These are deterministic local component/page contract checks. They do not establish real React rendering, browser/native input validation, hosted Auth/session/JWT/RLS or production acceptance. Coordinator owns visual/browser/build integration; no `.env`, real credential, hosted access, external communication, migration, push or deployment occurred here. No reproduced behavior regression was found within this tested contract.
