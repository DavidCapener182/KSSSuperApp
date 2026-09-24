# E-01 synthetic test Auth sessions and controlled-document fixture

**Scope:** Test infrastructure and fixture setup in the dedicated synthetic development project. No production, staging, Auth-limit, RLS, or business-policy change.

## Baseline and cause

The accepted test files contained 28 `signInWithPassword` call sites. Most test suites created separate direct and SSR clients, and each file signed the same synthetic personas in independently isolated Node test processes. The previous TASK-07A broad run completed 14 of 29 tests and failed 15: 13 at `Request rate limit reached`, one at controlled-document case creation, and one at an availability assertion subsequently corrected in 07A. A normal broad run made at least dozens of password sign-in attempts against the same small set of synthetic accounts; the exact pre-change request count was not logged. This is a client cadence problem, not a reason to raise the Supabase Auth limit.

## Session design and isolation

`tests/helpers/auth-session.mjs` caches only a valid synthetic Supabase session in process memory, keyed by project URL and email. Each new direct or SSR client receives the cached access/refresh pair through `auth.setSession`; an expired or failed restore uses one password sign-in. No token enters source, fixture files, persistent caches, or logs. The serial `npm run test:regression` command uses one Node test process (`--test-isolation=none --test-concurrency=1`) so safe sessions can be reused between files. Test clients and their SSR cookie jars are still constructed afresh. Anonymous clients remain anonymous. The shell's explicit direct Auth sign-in remains fresh, and the helper's test uses mock credentials/projects.

Database roles, onboarding ownership/cover, RLS and record permissions are checked on each server/database action. The cache stores authentication, never role or record authority. Existing expiry, revocation, temporary dual-role, and denial tests retain their database changes and checks. No Auth denial is retried as success.

## Controlled-document denial

The 03C regression created a new onboarding case on the existing synthetic Site without first ensuring Staff A had a **current SiteAssignment**. The current 03E `create_onboarding_case` guard raises `Onboarding case denied` if the target lacks an active assignment for that exact Site. Earlier tests can leave only expired/revoked historical assignments; their history is valid. The controlled test now reads current assignment state and, when needed, obtains a finite new assignment through `/api/access/sites` as Office before creating its case. It does not edit an old assignment or bypass the guard. A standalone controlled-document run passed the full publish, assign, access and acknowledge sequence after the correction.

## Verification and measured result

- `npm ci --ignore-scripts --no-audit --no-fund`: passed.
- `npm run lint`: exited 0; one concurrent 07B `workforce-client.tsx` React hook warning observed.
- `npx tsc --noEmit`: initially blocked by a concurrent 07B `events/[id]/page.tsx` argument type error; sent to 07B worker.
- A later `npx tsc --noEmit` passed after the parallel source correction.
- `npm run build`: Webpack production build passed against the combined in-progress checkout.
- `npm run smoke`: passed after the build settled. An earlier attempt raced a concurrent `.next` rebuild and exited before the local server was ready; manual server start and the subsequent smoke run passed.
- `node --test tests/auth-session.test.mjs`: helper cache/project isolation passed.
- `npm run test:controlled`: passed (one complete 03C regression).
- First serial `npm run test:regression`: **28 passed, 2 failed, 30 total; zero Auth rate-limit failures; controlled-document passed.** The two failures were shell expectations during concurrent 07B navigation changes: an erroneous return-target regex denied a valid document URL, and expected navigation omitted the new Workforce route. Both were sent to the 07B worker. The run measured 10 helper Auth sign-ins, including two mock test sign-ins, plus the deliberately fresh shell sign-in. This is about 9 real password sign-ins for the full run, compared with at least 28 static sign-in sites and an unlogged larger dynamic count before the change.
- The baseline 07A broad run was **14/29**, with **13 Auth throttles** and the 03C denial. The first E-01 run was **28/30**, with **zero Auth throttles** and 03C passing; the full suite is not green yet.

The final combined regression, staged secret scan and final diff check remain to be recorded. 07B is still being edited; E-01 will commit its files separately, and the 07B worker owns the shell expectations.

## Files and security review

Changed files are the shared `package.json` test command, `tests/helpers/auth-session.mjs`, `tests/auth-session.test.mjs`, the existing Auth-heavy test files, and the narrow `tests/controlled-documents.test.mjs` fixture. No application, migration, Supabase project configuration, or staging/production file was changed by E-01. Tokens are neither printed nor persisted; stats print counts only. Server and RLS authority are unchanged.

The 07B worker was contacted directly at task `01a0cae4-0753-7ad3-bf37-e1683f028f8b` with the file boundary, typecheck warning, and shell failures. E-01 has not edited the 07B Workforce files or their business tests. The shared package edit adds only the regression script. Final integration/commit status remains pending.
