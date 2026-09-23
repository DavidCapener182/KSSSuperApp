# TASK-03F staging readiness review

23 September 2026. Review only: no Vercel project, deployment, production domain, live personnel data, or new Supabase project was created.

## Build and runtime

- Framework: Next.js 16.3.6 App Router, React 19.2.8, Node runtime. Source build command: `npm run build` (`next build --webpack`); install: `npm ci`; start/smoke: `npm run start`, `npm run smoke`. Webpack is the accepted build path; Turbopack remains development-tool debt.
- No `vercel.json` or linked `.vercel` project exists in source control. Vercel should be configured as a separate KSS Enterprise staging project only after approval. Confirm the exact Node runtime and project root during linking, then prove the deployed build and server routes, including private file downloads.
- `next.config.ts` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a narrow `Permissions-Policy`. `src/proxy.ts` marks protected pages and API responses `private, no-store`. A tested CSP is still open; Next inline scripts and Supabase Auth/network requirements should be measured before setting one, not guessed.

## Environment variable inventory (names only)

| Variable | Exposure | Staging requirement |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Dedicated approved KSS staging or approved synthetic development Supabase URL; confirm project choice before deployment. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Publishable key for that same project, not a secret/service-role key. |
| `KSS_DOCUMENT_SIGNING_SECRET` | Server only | Independent, high-entropy staging value stored in Vercel environment settings; never `NEXT_PUBLIC_`. Used by the existing private document proof route. |

Ignored `.env.local` and `.env.test.local` are local development inputs. `KSS_TEST_*` synthetic credentials are test-harness variables and must not be copied to the Vercel application environment. No service-role key is required by the application and none belongs in browser code. Environment values must be checked in Vercel settings without printing them into logs/reports.

## Auth, URL, and audience

- Current sign-in is Supabase Auth password sign-in for mapped synthetic people; server-side authorisation and database RLS still govern records. There is no Entra federation or email callback route in this task. Confirm Supabase Auth Site URL and exact approved redirect allow-list for the staging hostname before sending any auth email or enabling callback flows. Do not use a broad wildcard as a convenience for a stable staging hostname.
- Initial audience: David and individually approved KSS testers using synthetic accounts. Configure Vercel Deployment Protection for the **exact deployment scope** so no production alias accidentally remains public; test with an unauthorised browser, then with an approved tester. Vercel Authentication access and Supabase application sign-in are separate gates. The Vercel plan, team membership/viewer access, project, domain, and protection scope are not yet verified.
- Use HTTPS staging URL only; test same-origin session cookies, sign-in, sign-out, direct deep links, refresh, and expired session on desktop/iPhone. No open public demo or real employee invitation.

## Proposed deployment checklist, for separate approval

1. Select and verify the Vercel team/project, protected URL, Node runtime, and the Supabase project used for staging. Decide whether to clone the current synthetic schema/data into a separate staging Supabase project; do not point at unrelated projects.
2. Add only the three required application variables above to the intended Vercel environment. Verify environment separation and perform secret scan. Configure Supabase Auth Site URL/redirect allow-list for the exact hostname.
3. Enable and verify Vercel access protection *before* sharing a link. Check a signed-out outsider, approved Vercel viewer, unmapped Supabase user, Staff, Office, Operations, and Super Admin paths.
4. Deploy the separately approved commit, read back deployment/build status, and smoke Home, Staff My Onboarding, Office queue, Profile, My Work, Documents, private byte routes, controlled Terms, sign-out, and 390px navigation. Confirm no uncaught client/server errors and no public cached private response.
5. Roll back by promoting the previous known-good deployment after checking the active URL. Database migrations must be additive and separately verified; never treat a Vercel rollback as a database rollback. Retain synthetic test-data history.

## Decision gates

**Synthetic staging candidate:** local build, UI/browser, smoke and all authenticated regression suites passed after bounded reruns following a transient Supabase Auth rate limit. A staging project/protection/auth configuration and deployed smoke test still require separate approval and verification. This review is not deployment approval.

**Live personnel/production:** blocked by malware scanning; retention/deletion; privacy/data-protection review; production secret management; backup/recovery; operational ownership/support; legal/business RTW, SIA and identity policies; LMS provider/interface; and pilot environment/access governance. No synthetic workflow result is a legal compliance or deployment-eligibility decision.

References: [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection), [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication), [Supabase Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
