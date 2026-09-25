# TASK-UI05 owned-path manifest

Starting main HEAD: `25dfb02dd5e1da087b0cc8034b2260d8c129122c`. Isolated branch: `task-ui05-people-staff`.

Exact implementation paths for the accepted first pass and this follow-up:

```text
src/app/(enterprise)/people/page.tsx
src/app/(enterprise)/people/[id]/page.tsx
src/app/(enterprise)/people/people.module.css
src/components/my-availability-client.tsx
src/components/my-availability.module.css
src/components/time-away-client.tsx
src/components/time-away.module.css
src/components/credentials-client.tsx
src/components/credentials.module.css
src/components/training-admin-client.tsx
src/app/(enterprise)/training/training.css
src/app/(enterprise)/training/my-learning/page.tsx
output/playwright/ui05-followup/staff-my-availability-390.png
output/playwright/ui05-followup/staff-availability-sheet-390.png
output/playwright/ui05-followup/staff-my-time-away-390.png
output/playwright/ui05-followup/staff-credentials-390.png
output/playwright/ui05-followup/staff-training-my-learning-390.png
output/playwright/ui05-followup/office-time-away-390.png
output/playwright/ui05-followup/office-training-admin-1440.png
output/playwright/ui05-followup/office-training-filter-390.png
docs/ui/TASK-UI05-OWNED-PATHS.md
docs/ui/TASK-UI05-PEOPLE-STAFF-REPORT.md
docs/ui/SHARED-UI-CHANGE-PROPOSALS.md
```

Excluded shared paths: `src/app/globals.css`, root layout, `src/components/enterprise-shell.tsx`, `src/components/ui/**`, `src/components/workforce*`, `src/components/my-schedule*`, `src/components/my-deployments*`, `src/components/workforce-planner*`, `docs/delivery/STATUS.md`, `docs/delivery/DECISIONS.md`, migrations and TASK-19A/TASK-20E files. Record any desired shared change separately.

Do not edit a path owned by another UI lane or concurrent task. Revise this manifest with exact edited paths as work proceeds.
