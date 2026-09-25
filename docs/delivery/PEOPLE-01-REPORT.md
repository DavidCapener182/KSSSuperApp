# PEOPLE-01 — Onboarding requirement journey

**Implementation for review · 25 September 2026 · synthetic Development only.** Source branch `people-01-onboarding-journey` started at frozen Candidate 1 `4d38aa4cf4457fa90743e0bfc969520d3655b6b5`. David approved this presentation slice after Integrated Baseline technical close-out. This report does not claim human acceptance, staging/production readiness or live use.

## Scope and change

Owned files: `src/components/onboarding-client.tsx`, new `src/components/onboarding-journey.css`, this report and four synthetic browser screenshots. The existing `/onboarding/[id]` page and guarded `readOnboardingCase` stay unchanged. No migration, RPC, API, role/grant, fixture, source record or private-file contract changed.

The case detail now presents its existing sorted requirements as numbered current-snapshot cards. Each card separates **current requirement state**, **document evidence state**, **next actor**, **next action/current outcome**, and the exact controlled terms version where one is assigned. Existing source links and all guarded request, review, verification, contract and cancellation controls remain in place. The heading and explanatory text say this is a snapshot in template order, not historical event chronology. `COMPLETE` personal details remain labelled self-submitted; accepted evidence remains separate from `VERIFIED`. A verification timestamp appears only when the guarded case read supplies it.

The UI still reports unconnected induction and unavailable terms from the existing frozen case contract. It does not infer Training completion, legal Right to Work, SIA authenticity, compliance or deployment eligibility. The Office requirement actions still use the same server-checked gates. A linked document does not inherit broader access.

## Checks actually performed

- Read Next 16.3.6 local Server/Client Component and CSS documentation before editing. Reviewed `STATUS.md`, `DECISIONS.md`, onboarding source policy, UI09 report and the PEOPLE-01 scope.
- `next typegen` and `tsc --noEmit` passed after generated route types. Focused ESLint on `onboarding-client.tsx` passed. `git diff --check` passed.
- A clean `npm run build` passed with the existing synthetic Development environment: Webpack compiled, TypeScript passed and 67 static pages generated. An earlier concurrent dev/build attempt failed because generated `.next/dev` route types were incomplete; after stopping dev and clearing only ignored `.next`, the clean build passed. The dev preview also produced an unrelated request-scope `cookies` error, so authenticated checks used the production preview.
- Installed Chrome, read-only synthetic sign-in, local production preview: Staff A and Office A each saw six ordered requirement cards for the exact authorised case at 1440px and genuine 390px. `document.documentElement.scrollWidth` equalled viewport width at both sizes. The first Staff evidence action measured 44px high and, when focused, had a solid 3px outline. Screenshots: [Staff desktop](../../output/playwright/people-01/staff-desktop.png), [Staff 390px](../../output/playwright/people-01/staff-390.png), [Office desktop](../../output/playwright/people-01/office-desktop.png), [Office 390px](../../output/playwright/people-01/office-390.png).
- In the observed case, Personal Details was `COMPLETE — self-submitted`; RTW and SIA were `VERIFIED` with separate `ACCEPTED_AS_EVIDENCE` labels and verification times; Identity was `NOT_CONFIGURED`; Terms `NOT_AVAILABLE`; Induction `NOT_CONNECTED`. This proves those labels render separately for this fixture. It does not exercise submitted-but-unreviewed, accepted-but-unverified, rejected, expired, acknowledged-terms or an authorised cover view.
- Authenticated Operations and unrelated Office B direct visits to that case returned HTTP 404. The unrelated Office B request to the exact linked personnel Document detail API and exact versioned file API also returned HTTP 404. The generic `/documents/[id]` app shell returned 200 before its client fetched detail; the API and file denials are the relevant private-access readback.

## Evidence limits and next review

No business POST action or database integration regression was run: this is a presentation-only diff, and the existing integration tests write synthetic Development records. The browser pass did not exercise an active controlled terms assignment, a case cover holder, or a pending evidence state. Those should be covered in the later acceptance walkthrough if safe fixtures exist. The screenshot captures synthetic data only. No staging, production, real Staff data, legal/compliance conclusion or deployment is authorised here.
