# TASK-UI05 owned-path manifest

Starting main HEAD: `25dfb02dd5e1da087b0cc8034b2260d8c129122c`. Isolated branch: `task-ui05-people-staff`.

Exact implementation paths for this bounded pass:

```text
src/app/(enterprise)/people/page.tsx
src/app/(enterprise)/people/[id]/page.tsx
src/app/(enterprise)/people/people.module.css
docs/ui/TASK-UI05-OWNED-PATHS.md
docs/ui/TASK-UI05-PEOPLE-STAFF-REPORT.md
docs/ui/SHARED-UI-CHANGE-PROPOSALS.md
```

Excluded shared paths: `src/app/globals.css`, root layout, `src/components/enterprise-shell.tsx`, `src/components/ui/**`, `src/components/workforce*`, `src/components/my-schedule*`, `src/components/my-deployments*`, `src/components/workforce-planner*`, `docs/delivery/STATUS.md`, `docs/delivery/DECISIONS.md`, migrations and TASK-19A/TASK-20E files. Record any desired shared change separately.

Do not edit a path owned by another UI lane or concurrent task. Revise this manifest with exact edited paths as work proceeds.
