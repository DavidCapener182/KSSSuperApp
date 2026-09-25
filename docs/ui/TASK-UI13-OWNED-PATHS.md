# TASK-UI13 owned paths

- `docs/ui/prototypes/ui13-components.html` — self-contained, synthetic visual prototype.
- `docs/ui/prototypes/ui13-shell-study.html` — review-only refined sample framed to UI11 geometry; its shell navigation is static and has no authority role.
- `src/components/ui13/operational.tsx` — presentational UI13 primitives; no data fetch, state derivation or access decision.
- `src/components/ui13/operational.module.css` — scoped visual rules for those primitives.
- `docs/ui/TASK-UI13-OWNED-PATHS.md` — this manifest.
- `docs/ui/TASK-UI13-VISUAL-COMPONENTS-REPORT.md` — prototype scope, checks and review gate.
- `src/components/management-reports-client.tsx` and `src/components/management-reports.module.css` — approved Management Reports pilot presentation only.
- `src/app/(enterprise)/assets/page.tsx`, `src/components/assets-workspace.tsx` and `src/components/assets-workspace.module.css` — approved Assets pilot presentation only.
- `docs/ui/evidence/ui13/` — four genuine browser screenshots for the two approved routes at 1440px and 390px.
- `docs/delivery/TASK-UI13-PILOT-REPORT.md` — pilot checks, evidence and acceptance boundary.

Shared shell, global CSS, existing `src/components/ui` primitives, other product routes, APIs, migrations, delivery status and decisions are excluded from this lane. The approved UI11 shell was merged as an existing accepted commit; this pilot changes exactly `/management-reports` and `/assets`.
