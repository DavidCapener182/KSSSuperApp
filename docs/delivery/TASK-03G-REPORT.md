# TASK-03G protected synthetic staging — preflight record

23 September 2026. TASK-03F accepted at `dbcf7dd`. TASK-03G authorises a protected synthetic staging deployment only after the separate database and deployment-protection gates pass.

## External preflight

- Vercel team `team_4eEheBD4W2Kr5jjv8U5SGUWG` contains existing `kss-super-app` project `prj_l9yuAeyAKwcrIDQcFMhALQKC4ufO`. Its deployment list returned zero deployments. Project-level protection settings could not be read or changed with the available connector: its documented `projectId` argument is rejected by the backend, which instead asks for an unsupported `idOrName` argument. The browser reached Vercel sign-in; the Mac was locked. **Deployment protection is unverified.** No deployment has been made.
- Supabase development project `dnfhkmmnlbiabqypclqg` is active in KSS organisation `pfkyrobfqaopedqsjrzb` (`david.capener@kssnwltd.co.uk's Org`, Pro). The available project listing did not show a KSS staging project. Supabase's cost quote tool returned zero for the organisation, while its current billing FAQ indicates that an additional Pro project can incur compute charges starting around $10/month. The user has been asked to confirm that cost before creation. **No staging project has been created.**
- The development project must never be used as the staging database. No unrelated Supabase project may be repurposed. No staging credentials, Auth redirects, users, migrations, storage buckets or synthetic fixtures have been configured.

## Local source preparation

- Added an explicit staging label to the sign-in and authenticated shell, with synthetic-data wording. `NEXT_PUBLIC_KSS_STAGE=staging` selects it.
- Added staging-only robots exclusion, `noindex, nofollow` metadata and `X-Robots-Tag`.
- Added a nonce-based Content Security Policy in Proxy for staging responses, using the configured Supabase origin for browser connections. It excludes `unsafe-eval` in the production build. `style-src-attr 'unsafe-inline'` remains for component inline style attributes; this is narrower than globally permitting inline scripts/styles. Next's bundled CSP guide requires dynamic pages for nonces; the sign-in and protected pages are dynamic.
- Added a Vercel prebuild gate requiring the staging flag, a matching explicit staging Supabase project reference and URL, and the two required application credentials. This prevents an unlabelled or obviously misdirected Vercel build. The publishable key must still be read back against the selected staging project's key before deployment.
- No application business rules, database schema, role policies, fixtures or Supabase project state changed.

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
- A bounded independent Sol review identified the missing-stage and database-pairing risks; the Vercel prebuild gate addresses the missing stage and project URL mismatch. Exact publishable key pairing and Vercel protection remain deployment gates.
- Required before deployment: dedicated staging project and confirmed cost; source migrations and minimal synthetic seed; exact publishable key readback; Vercel protection enabled and unauthorised access denied; environment/configuration review; staging Auth URL; protected production build; actual URL role, file, desktop and mobile checks. Do not run destructive regression fixtures against the clean staging data.

## Stop condition

Until the database and deployment-protection gates pass, stop before creating a Vercel deployment. No staging URL is available yet. Training remains `NOT_CONNECTED`; live personnel and production gates remain open.
