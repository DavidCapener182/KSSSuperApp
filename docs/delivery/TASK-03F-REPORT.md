# TASK-03F execution report — UI/UX and staging readiness

**Date:** 23 September 2026
**Scope:** approved TASK-03F only. Dedicated KSS Enterprise development Supabase project `dnfhkmmnlbiabqypclqg`. No Vercel project or deployment and no live data.

## Delivered

- Introduced a restrained blue/graphite/neutral token system, system typography, consistent spacing/radii, clearer headings and status treatments, and a future `.dark` token foundation. Product completion uses blue/neutral with explicit text. Source audit found no intentional green, emerald, lime, mint or teal product styling or green hard-coded colour.
- Added shadcn/ui foundation and the components actually used now: Button, Badge, Input, Sheet, Skeleton and Progress. Lucide icons support navigation. The shared action/status/loading primitives adopt those components while preserving existing API and business-state rules.
- Polished sign-in, authenticated shell, Staff Home/My Work, Office My Work, Office Onboarding queue, Staff My Onboarding, case detail, Profile, Documents/review, controlled Terms and Sites through the shared styles and targeted component changes. The mobile shell has role-scoped primary navigation and a Sheet for secondary destinations. Office queues remain tables on desktop and cards on phones; mobile filters wrap rather than disappearing off screen. On Office case detail, the starter checklist now precedes synthetic publisher administration.
- Staff My Onboarding shows the active accepted V2 case before older synthetic test cases, clear count/progress, evidence-versus-verification wording and the remaining induction blocker. List ordering is presentation-only and uses a bounded recent-decision query; it does not affect access or completion rules. Case list and selected-case reads now start in parallel to shorten detail loading without changing the authorised endpoints.
- Added `private, no-store` to protected page/API responses and common security headers. No staging Auth or secrets were changed. CSP remains a separate tested deployment gate (see staging review).
- Published the source-controlled [UI guide](../design/KSS-UI-GUIDE.md) and [staging readiness review](TASK-03F-STAGING-READINESS.md).

## Synthetic Staff A fixture

The accepted V2 case `3d3f1499-6163-4c9b-9adb-11972cedc985` began at an honest 3 of 6 due to development regression edits. The guarded `scripts/restore-staff-a-03f.mjs` ran only normal Staff/Office application routes against the dedicated development project:

1. Staff explicitly resubmitted current Personal Details, creating a new immutable submitted revision.
2. Staff saved a clearly synthetic `SYN-SIA-03F-...` credential and submitted a new immutable credential revision.
3. Office issued the case-bound protected SIA request; Staff uploaded a synthetic PDF; Office accepted its exact `DocumentVersion` as evidence.
4. A readback immediately after evidence acceptance still showed SIA awaiting separate requirement verification. Office then made that separate exact-version verification decision.

The first restoration created SIA submission `574b86a5-d34d-426c-b688-9eb227a26fcc`, request `0424b2ef-b837-4460-a1ec-cc011a8f174a`, and evidence version `30506393-c6cb-43b2-b4c7-7b69bdbeb1eb`. The full Profile/SIA regression later edited Staff A's current synthetic drafts, so the same guarded normal workflow was run once more after that suite: submission `f75cc8f9-d483-486f-92c0-2184f7dbb676`, request `19f090bc-c254-462f-815f-865166876424`, evidence version `f4c69c92-c014-4b10-bc4d-23ea798c3158`. Final route readback again showed **5 of 6**, `CORE_KSS_INDUCTION = NOT_CONNECTED`, and case `IN_PROGRESS`. Earlier immutable profile/credential/evidence/verification history was preserved. There was no direct SQL, sequence reset, fake completion, or migration.

## Checks actually run

- `npm ci`: passed. npm warned that `unrs-resolver` has an unapproved postinstall script under its allow-scripts policy; the Webpack build passed without it.
- `npm run lint`: passed after final UI changes.
- `npm run build`: passed with Next.js 16.3.6 Webpack and TypeScript after final UI changes.
- `npm run smoke`: passed when run with permission to bind its temporary loopback port. The initial sandbox-only attempt failed with `listen EPERM`, not an application failure.
- Authenticated regressions: `test:access`, `test:sites`, `test:shell`, `test:documents`, `test:document-review`, `test:work`, `test:onboarding`, `test:profile-sia`, `test:controlled`, `test:identity`, and `tests/onboarding-queue.test.mjs` all passed in 03F. Seven suites initially hit `AuthApiError: Request rate limit reached` at sign-in before assertions; each later passed on a bounded independent rerun after Auth recovered. The temporary interruption is tracked rather than hidden. `test:profile-sia` changed the current synthetic Staff A draft as expected; the normal workflow restored the accepted display after the suite.
- Browser demonstration: signed in as synthetic Staff and Office on the local production build; verified Staff A 5-of-6, mobile bottom navigation, Office scoped dashboard/counts and My Work. No page-level horizontal overflow at 390px on checked Staff onboarding and Office queue/Sites views (`scrollWidth = clientWidth = 390`). Browser snapshots showed labelled fields, text statuses, role-scoped links and no console errors in the checked Staff Documents journey. Accessibility check is a sanity pass, not a formal WCAG audit.
- Explicit green audit: searched `src` for green/emerald/lime/mint/teal terms and reviewed palette/icon hex values; no intentional green product UI remains.
- One bounded GPT-6 Sol staging/security review found no confirmed authorisation/RLS regression. Its bounded recent-verification-query concern was addressed with an ordered limit; transient Playwright snapshots were added to `.gitignore`; CSP remains documented as a staging gate.

## Representative browser evidence

- Staff 390px: [My Onboarding](../../output/playwright/task-03f/staff-mobile-onboarding.png), [Profile](../../output/playwright/task-03f/staff-mobile-profile.png), [Documents](../../output/playwright/task-03f/staff-mobile-documents.png).
- Staff desktop: [My Onboarding](../../output/playwright/task-03f/staff-desktop-onboarding.png).
- Office desktop: [dashboard](../../output/playwright/task-03f/office-desktop-dashboard.png), [case detail](../../output/playwright/task-03f/office-desktop-case-detail.png), [My Work](../../output/playwright/task-03f/office-desktop-my-work.png).
- Office 390px: [dashboard](../../output/playwright/task-03f/office-mobile-dashboard.png), [navigation Sheet](../../output/playwright/task-03f/office-mobile-navigation-sheet.png). [Sign-in desktop](../../output/playwright/task-03f/sign-in-desktop.png).

## Open items and recommendation

The Auth rate-limit interruption was transient; if it recurs during staging, investigate its cause and test-account cadence. Long Office case-detail loads and numerous accumulated synthetic regression cases were visible locally; query/performance and test-data housekeeping deserve attention before inviting testers, without deleting immutable business history. Dark mode has tokens but no complete QA or switch. CSP, staging protection, Supabase Auth hostname configuration, and any separate staging database/project choice remain unverified. The LMS provider/interface and all live-data gates remain open.

Recommend a separately approved, protected **synthetic Vercel staging deployment** after the exact staging audience/project/auth configuration is verified. Keep live personnel/production use blocked. No Vercel deployment occurred in TASK-03F.
