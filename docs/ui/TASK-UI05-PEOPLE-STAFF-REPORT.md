# TASK-UI05 — People & Staff Experience report

Status: **Accepted by David on 25 September 2026 for the bounded People directory and Staff Record UI pass in synthetic Development.** This acceptance covers implementation commit `9ed3084a1138c6f5d6f93ce075083017c73ed28b` and the checks documented below. It does not accept the broader UI05 brief, shared UI02 integration, staging, production or deployment.

The authenticated desktop, genuine 390px and keyboard/focus walkthrough remained an evidence gap at acceptance. No unverified browser result is treated as a pass. The deferred person-specific Training read contract and other module work remain deferred.

Starting canonical main HEAD: `25dfb02dd5e1da087b0cc8034b2260d8c129122c`.

## Owned routes and files

See `TASK-UI05-OWNED-PATHS.md`. Only the two People routes, their local CSS module, and this lane's UI documents changed. No server reads, actions, database policies or source identities changed.

## Competitor patterns and workflow changes

Read the UI01 inventory, journey audit, design-system audit, competitive research and roadmap, plus accepted 04A/04B and 17B contracts. Public vendor comparisons there identify BambooHR, HiBob and Rippling's person/task view, Credentially's evidence/expiry pattern, Deputy's separation of leave and availability, and LMS learner/admin paths as design hypotheses rather than hands-on benchmark proof.

The People directory now gives mobile cards explicit Onboarding and Site context labels, a full-size record link and a visible scoped result count. Active filters have a clear action. The Staff Record retains its source-scoped sections, adds larger reading text and action targets, and uses a horizontally scrollable section index on narrow screens. Focus rings and 44px targets are local to these two routes. No colour alone conveys status.

## UI-only work and deferred product changes

Current Availability and Time Away routes already represent separate sources; this pass did not combine them or change their writes. The 17B accepted contract expressly keeps approved leave separate from Availability and allocations. Credentials and local Training remain distinct; a completion, certificate, credential verification and deployment eligibility cannot be merged into one status. The Staff Record's Training section remains a legacy `provider not connected` placeholder; replacing it with a person-specific learner summary requires an exact authorised read contract, so this feature was held. No 20E certificate/PDF, training matrix, eligibility or private file surface was added.

## Desktop, 390px and accessibility evidence

Code review checked the 390px CSS rules: mobile directory cards retain the same safe fields as the desktop table, the filter form becomes one column below 520px, the record sections become one column, and section navigation scrolls within the viewport. `:focus-visible` outlines and 44px links/controls are defined in the local CSS module. **No authenticated browser or physical 390px viewport run was performed in this isolated worktree**, so overflow, keyboard order and actual focus appearance remain unverified. Synthetic browser credentials were not copied from the shared checkout.

## Tests and build

Focused ESLint on both changed TSX files passed. Webpack production build and TypeScript passed with synthetic public build placeholders (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); all 59 static pages generated. An initial build without the publishable key failed when the unrelated `/staging-access` page prerendered. No live source tests, action regression or UI acceptance run was claimed because this change does not alter source contracts.

## Dependencies and shared-component proposals

See `SHARED-UI-CHANGE-PROPOSALS.md`.

## Follow-up UI05 presentation pass — awaiting David's review

The earlier acceptance above remains limited to implementation commit `9ed3084`. This later Availability, Time Away, Credentials and Training work is separate and **not yet accepted**. It used the same isolated branch; the shared checkout, UI03, 19A, 20E, Supabase and deployment were not changed.

### Changes

- My Availability now links to the separate Time Away request workflow. Its existing declaration, edit, cancel and sheet controls have local 44px targets and visible focus. Save/cancel messages follow an authoritative current-list/history refresh; if the server accepts a write but readback fails, the UI says confirmation is unavailable rather than displaying a completed current state.
- Staff Time Away links back to My Availability and states that a request does not change a declaration. Time Away inputs, buttons and calendar entries now have 44px targets and more readable text. Decision and administration success messages follow source readback. Availability, allocation, attendance and pay records remain separate.
- Credentials has a local source-boundary note and more readable card typography, focus and mobile action sizing. Its success message follows current credential readback. Credential verification is still separate from accepted document evidence, Training and deployment eligibility.
- My Learning labels assignment state and distinguishes page progress, assessment attempts, credential verification and deployment decisions. Training CSS improves text hierarchy and mobile spacing. Training administration now filters its already loaded course list by title and collapses each course's versions, reducing the long synthetic list without changing authority or data. Its action message requires a successful current-course/grant refresh. No person-specific Training summary, Training matrix, 20E certificate/PDF or new result contract was added.

### Actual browser evidence

An isolated local production build used the existing synthetic Development settings and signed into Chrome as synthetic Staff A and Office A. Desktop was 1440px and mobile was an actual 390px browser viewport. Read-only navigation covered Staff `/my-availability`, `/my-time-away`, `/credentials`, `/training`, `/training/my-learning`; Office `/time-away`, `/credentials`, `/training`, `/training-admin`. In each visited desktop/mobile route the measured document `scrollWidth` equalled the viewport width. The main font was a system sans-serif stack. The first keyboard Tab exposed a visible shell-link outline; focused Availability Add and Training course summary controls also had visible solid outlines. Enter opened the Availability sheet and expanded a course. The 390px Availability Add control measured 44px high; all measured sheet buttons/inputs/selects were at least 44px in both dimensions. Filtering the 70 loaded synthetic courses to `KSS Enterprise` returned 1 course; its 390px summary was keyboard operable and 69px high. No source write was made in the browser walkthrough.

Screenshots: [Staff Availability 390px](../../output/playwright/ui05-followup/staff-my-availability-390.png), [Availability sheet 390px](../../output/playwright/ui05-followup/staff-availability-sheet-390.png), [Staff Time Away 390px](../../output/playwright/ui05-followup/staff-my-time-away-390.png), [Staff Credentials 390px](../../output/playwright/ui05-followup/staff-credentials-390.png), [Staff My Learning 390px](../../output/playwright/ui05-followup/staff-training-my-learning-390.png), [Office Time Away 390px](../../output/playwright/ui05-followup/office-time-away-390.png), [Office Training administration desktop](../../output/playwright/ui05-followup/office-training-admin-1440.png), [Office filtered Training 390px](../../output/playwright/ui05-followup/office-training-filter-390.png).

Office A had no active Credential Reviewer grant or authorised Time Away team decision queue in this readback, so reviewer decisions, request history for another Person and the manager calendar were not visually exercised. The browser walkthrough did not submit or reject a source action, test a screen reader, or confirm a completed course. Those are evidence limits, not UI acceptance claims. Existing 20E-named synthetic test courses appeared in the general admin list; no certificate or PDF data was read or used by this change.

### Checks

Focused ESLint on the five changed TSX files and `git diff --check` passed. The final Next.js 16.3.6 Webpack production build passed compilation, TypeScript and 59 static pages using the existing synthetic Development public configuration. The first follow-up build caught a nullable course-title type error in the new filter; it was fixed before the passing final build. No source-mutation, RLS, regression or deployment checks were run because this follow-up changes presentation and client feedback only.
