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
