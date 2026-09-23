# TASK-03G protected synthetic staging — work in progress

23 September 2026. TASK-03F accepted at `dbcf7dd`. TASK-03G authorises a protected synthetic staging deployment only after the separate database and deployment-protection gates pass.

## External preflight

- Vercel team `team_4eEheBD4W2Kr5jjv8U5SGUWG` contains existing `kss-super-app` project `prj_l9yuAeyAKwcrIDQcFMhALQKC4ufO`. Its deployment list returned zero deployments. The connected Vercel project API rejected its documented `projectId` argument, so the logged-in Safari account was used. The Deployment Protection setting was changed from Standard Protection to **All Deployments** with Vercel Authentication required; Safari showed `Vercel Authentication updated`. The actual unauthenticated deployment response remains to be verified after deployment. No deployment has been made.
- The user approved a separate project and possible additional charge. Supabase cost quote returned $0/month, and `KSS Enterprise - Staging` was created in the KSS Pro organisation `pfkyrobfqaopedqsjrzb`, West EU Ireland, with reference `kwpgjbxepxuhwxxydaca`. The development project remains `dnfhkmmnlbiabqypclqg` and is not the staging target.
- All 37 pre-existing source-controlled migrations were applied in order to staging. The Supabase Management API assigned execution-time migration versions; the source-controlled `20260923094852_staging_reconcile_versions_03g.sql` reconciled those metadata versions to source filenames after asserting the 37 expected names. Readback showed 38 matching migration entries at that stage.
- Four confirmed synthetic `example.test` Supabase Auth users were created in staging for Super Admin, Office Admin, Security Staff and Operations. The source-controlled `20260923095239_seed_staging_03g.sql` then inserted four stable Person records, provider mappings and corresponding role assignments, guarded by an exact four-user staging predicate. Readback: four Auth users, four People, four AuthIdentity rows and four roles; zero Sites, teams and onboarding cases. These later business records must be created through guarded application workflows. Migration readback showed 39 entries after this seed.
- Staging Auth redirects and synthetic Site/onboarding data remain pending. No unrelated Supabase project was used.
- The original `kss-super-app` Vercel project's Preview environment was configured with five staging variables, but it was not used for a successful release. The approved separate staging-only project and its Production-classified first deployment are documented below.
- The connected GitHub repository was empty. Pushing committed source `2719f52` to its first `staging` branch unexpectedly triggered a Vercel **Production-target** build even though the Production environment settings said `main` is the production branch. The production environment has no KSS variables, so the source-controlled prebuild gate rejected it with `NEXT_PUBLIC_KSS_STAGE must be staging`. Vercel reported Build Failed and **No Production Deployment / production domain not serving traffic**. Deployment ID: `dpl_FreeepTKQ2EwqCxTqk3waHYqtmuw`. No application became publicly available. Automatic approval review rejected use of that failed Production deployment's Redeploy control; do not use it.
- An explicit `--target=preview` dry run on the original project found that the CLI would otherwise upload ignored local browser/test artifacts. Added `.vercelignore` to exclude these from deployment input. The corrected root-anchored `/supabase/` rule and final staging project deployment are documented below.

## Local source preparation

- Added an explicit staging label to the sign-in and authenticated shell, with synthetic-data wording. `NEXT_PUBLIC_KSS_STAGE=staging` selects it.
- Added staging-only robots exclusion, `noindex, nofollow` metadata and `X-Robots-Tag`.
- Added a nonce-based Content Security Policy in Proxy for staging responses, using the configured Supabase origin for browser connections. It excludes `unsafe-eval` in the production build. `style-src-attr 'unsafe-inline'` remains for component inline style attributes; this is narrower than globally permitting inline scripts/styles. Next's bundled CSP guide requires dynamic pages for nonces; the sign-in and protected pages are dynamic.
- Added a Vercel prebuild gate requiring the staging flag, a matching explicit staging Supabase project reference and URL, and the two required application credentials. This prevents an unlabelled or obviously misdirected Vercel build. The publishable key must still be read back against the selected staging project's key before deployment.
- No existing application business rules, role policies or development data changed. The two 03G migrations are additive staging preparation and were committed before deployment.

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
- The original Preview-only deployment plan was replaced with the user-approved separate staging-only Vercel project. Its protected deployment is Ready; staging Auth URL, actual signed-in role/file checks and desktop/mobile checks remain. Do not run destructive regression fixtures against clean staging data.

## Stop condition

Do not give David a staging URL for use until the isolated protected deployment, staging Auth configuration, synthetic fixtures and post-deployment checks are verified. Training remains `NOT_CONNECTED`; live personnel and production gates remain open.

## 23 September continuation: isolated Vercel staging project

- David approved a **separate** Vercel staging project after Vercel's documented rule was confirmed: a new project's first successful deployment is Production-classified even when initiated from a non-production branch or without `--prod`. The earlier `kss-super-app` project remains without a successful deployment. The new project is `kss-enterprise-staging`, ID `prj_4jIvF5zewGzJqWKRukfqr4i7gwU1`, in the same Vercel team.
- Before code deployment, the new project's Vercel Authentication was set to **All Deployments** (including its Production-classified first deployment). Framework preset is Next.js. The five staging variables listed above were saved to this staging-only project's Production environment; the signing secret is hidden/Sensitive. `vercel env ls` read back all five names and their Production scope. The project was connected to `DavidCapener182/KSSSuperApp` only after protection and variables were configured.
- The first staging-only CLI build, deployment `dpl_2gP3chLKDktwfTWzHLQuNcrtHMhn`, failed because `.vercelignore` matched `src/lib/supabase/` as well as root `supabase/`. Build logs showed missing `@/lib/supabase/browser` and `@/lib/supabase/server`. Commit `7796b93` narrowed the rule to `/supabase/`. A deployment dry run then confirmed both application Supabase client files included and no root migration or `.env.local` file in the upload list. The clean commit was pushed to the remote `staging` branch.
- One local CLI source upload of the corrected commit reported `fetch failed`; a subsequent deployment appeared Ready, and a Git-backed deployment then succeeded as described below.
- A corrected CLI deployment (`dpl_GcEJNqspSwmSag3LJXT6u3TfHsMj`) subsequently appeared **Ready** despite the earlier CLI call returning no final result. GitHub was connected to the separate staging project, and commit `6ea0a76` on remote `staging` produced a second **Ready** Production-classified deployment `dpl_AuviSyPursBqndkL1MwpFmYkgJ2i`. The stable alias is `https://kss-enterprise-staging-capener182-gmailcoms-projects.vercel.app`; the project is staging-only despite Vercel's environment label.
- Unauthenticated `curl -I` to that alias returned HTTP 302 to `vercel.com/sso-api`, `cache-control: no-store`, and `X-Robots-Tag: noindex`. An authenticated Vercel CLI bypass request to `/` on the latest deployment returned HTTP 200 with a nonce CSP and `X-Robots-Tag: noindex, nofollow`; `/onboarding` returned HTTP 307 to `/?next=%2Fonboarding` without an application session. These prove platform and application entry barriers but not a completed synthetic user journey.
- Supabase Auth staging Site URL/redirect setup, synthetic Site/team/case fixture creation through authorised application workflows, and signed-in Staff/Office/mobile browser checks remain open. The Mac locked during Safari Auth configuration, so no unverified completion is claimed.

The earlier Preview-only plan is superseded by the approved staging-only Vercel project. Its first successful build is Production-classified **within that staging-only project** and remains Vercel-auth protected with synthetic Supabase data. All application and live-data gates remain unchanged.
