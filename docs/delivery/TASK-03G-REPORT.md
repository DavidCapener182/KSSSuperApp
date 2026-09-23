# TASK-03G protected synthetic staging — work in progress

23 September 2026. TASK-03F accepted at `dbcf7dd`. TASK-03G authorises a protected synthetic staging deployment only after the separate database and deployment-protection gates pass.

## External preflight

- Vercel team `team_4eEheBD4W2Kr5jjv8U5SGUWG` contains existing `kss-super-app` project `prj_l9yuAeyAKwcrIDQcFMhALQKC4ufO`. Its deployment list returned zero deployments. The connected Vercel project API rejected its documented `projectId` argument, so the logged-in Safari account was used. The Deployment Protection setting was changed from Standard Protection to **All Deployments** with Vercel Authentication required; Safari showed `Vercel Authentication updated`. The actual unauthenticated deployment response remains to be verified after deployment. No deployment has been made.
- The user approved a separate project and possible additional charge. Supabase cost quote returned $0/month, and `KSS Enterprise - Staging` was created in the KSS Pro organisation `pfkyrobfqaopedqsjrzb`, West EU Ireland, with reference `kwpgjbxepxuhwxxydaca`. The development project remains `dnfhkmmnlbiabqypclqg` and is not the staging target.
- All 37 pre-existing source-controlled migrations were applied in order to staging. The Supabase Management API assigned execution-time migration versions; the source-controlled `20260923094852_staging_reconcile_versions_03g.sql` reconciled those metadata versions to source filenames after asserting the 37 expected names. Readback showed 38 matching migration entries at that stage.
- Four confirmed synthetic `example.test` Supabase Auth users were created in staging for Super Admin, Office Admin, Security Staff and Operations. The source-controlled `20260923095239_seed_staging_03g.sql` then inserted four stable Person records, provider mappings and corresponding role assignments, guarded by an exact four-user staging predicate. Readback: four Auth users, four People, four AuthIdentity rows and four roles; zero Sites, teams and onboarding cases. These later business records must be created through guarded application workflows. Migration readback showed 39 entries after this seed.
- Staging Auth redirects, synthetic Site/onboarding data and successful application deployment remain pending. No unrelated Supabase project was used.
- Vercel Preview now has exactly the five required application variables: `NEXT_PUBLIC_KSS_STAGE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `KSS_STAGING_SUPABASE_PROJECT_REF`, and secret-typed `KSS_DOCUMENT_SIGNING_SECRET`. The Preview-only scope and secret classification were read back in Safari. No values were placed in source or this report. The framework preset was corrected from `Other` to `Next.js`; Vercel saved it and the build command is its default `npm run build` (Webpack via `package.json`). Vercel Authentication is enabled for **All Deployments**.
- The connected GitHub repository was empty. Pushing committed source `2719f52` to its first `staging` branch unexpectedly triggered a Vercel **Production-target** build even though the Production environment settings said `main` is the production branch. The production environment has no KSS variables, so the source-controlled prebuild gate rejected it with `NEXT_PUBLIC_KSS_STAGE must be staging`. Vercel reported Build Failed and **No Production Deployment / production domain not serving traffic**. Deployment ID: `dpl_FreeepTKQ2EwqCxTqk3waHYqtmuw`. No application became publicly available. Automatic approval review rejected use of that failed Production deployment's Redeploy control; do not use it.
- The official Vercel CLI 59.23.2 is authenticated as `capener182-6606` and linked to the approved project. An explicit `--target=preview` dry run found that the CLI would otherwise upload ignored local browser/test artifacts. Added `.vercelignore` to exclude `.env*`, `.playwright-cli`, `output`, `tests`, `docs`, `supabase` and `coverage` from deployment input. A second dry run reported Next.js, 144 files, and no local environment, browser artifact, test document or listed secret/password/token path in the upload.

## Local source preparation

- Added an explicit staging label to the sign-in and authenticated shell, with synthetic-data wording. `NEXT_PUBLIC_KSS_STAGE=staging` selects it.
- Added staging-only robots exclusion, `noindex, nofollow` metadata and `X-Robots-Tag`.
- Added a nonce-based Content Security Policy in Proxy for staging responses, using the configured Supabase origin for browser connections. It excludes `unsafe-eval` in the production build. `style-src-attr 'unsafe-inline'` remains for component inline style attributes; this is narrower than globally permitting inline scripts/styles. Next's bundled CSP guide requires dynamic pages for nonces; the sign-in and protected pages are dynamic.
- Added a Vercel prebuild gate requiring the staging flag, a matching explicit staging Supabase project reference and URL, and the two required application credentials. This prevents an unlabelled or obviously misdirected Vercel build. The publishable key must still be read back against the selected staging project's key before deployment.
- No existing application business rules, role policies or development data changed. The two 03G migrations are additive staging preparation and must be committed before deployment.

## Staging environment variable inventory

| Variable | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_KSS_STAGE` | Client safe | Must be `staging` for Vercel build. |
| `NEXT_PUBLIC_SUPABASE_URL` | Client safe | Exact dedicated KSS staging project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client safe | Publishable key from that same staging project. |
| `KSS_STAGING_SUPABASE_PROJECT_REF` | Server/build only | Explicit selected staging reference for build gate. |
| `KSS_DOCUMENT_SIGNING_SECRET` | Server only | Independent high-entropy staging signing secret. |

Do not place `KSS_TEST_*` credentials or a Supabase secret/service-role key in the Vercel application environment. No values belong in source or this report.

## Checks and remaining gates

- Local lint and final `NEXT_PUBLIC_KSS_STAGE=staging npm run build` passed, including the Vercel prebuild guard in its local no-op mode. The existing smoke test passed when run with localhost socket permission; the first sandboxed attempt was denied the local socket by `EPERM`.
- Local staging-mode HTTP response showed a nonce CSP, `X-Robots-Tag: noindex, nofollow`, robots `Disallow: /`, noindex metadata, and staging label. The in-app browser rendered sign-in without console warnings/errors. This was a **local build using the existing development environment**; it is not a staging database or deployed URL test.
- The prebuild gate rejected missing stage and mismatched Supabase URL test cases, and accepted a synthetic matched test configuration.
- A bounded independent Sol review identified the missing-stage and database-pairing risks; the Vercel prebuild gate addresses the missing stage and project URL mismatch. The staging publishable key was read back from that project and is browser-safe, but Vercel environment pairing remains to be verified.
- Required before the successful Preview deployment: commit `.vercelignore` and use the explicit CLI `--target=preview` path; do not retry the failed Production-target deployment. Staging Auth URL is set after a Preview hostname exists and before user testing. Required after deployment: unauthorised protection denial; protected build; actual URL role, file, desktop and mobile checks. Do not run destructive regression fixtures against the clean staging data.

## Stop condition

Until all remaining configuration gates pass, stop before creating a Vercel deployment. No staging URL is available yet. Training remains `NOT_CONNECTED`; live personnel and production gates remain open.
