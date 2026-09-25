# TASK-UI04 exact owned paths

Starting main HEAD: `25dfb02dd5e1da087b0cc8034b2260d8c129122c`; branch `task-ui04-operations`.

Accepted first pass (commit `095bc69`; acceptance close-out `e302333`):

```text
src/components/control-room-client.tsx
src/components/control-room.css
src/components/action-centre-client.tsx
src/components/action-centre.module.css
```

Follow-up owned UI paths, checked against current main and UI03 before editing:

```text
src/components/incidents-workspace.tsx
src/components/incident-detail.tsx
src/app/(enterprise)/incidents/incidents.css
src/components/site-book-workspace.tsx
src/app/(enterprise)/site-book/site-book.css
src/components/event-attendance-client.tsx
src/components/site-attendance-client.tsx
src/components/my-attendance-client.tsx
src/components/attendance.module.css
```

Task-owned documentation:

```text
docs/ui/TASK-UI04-OWNED-PATHS.md
docs/ui/TASK-UI04-OPERATIONS-REPORT.md
docs/ui/SHARED-UI-CHANGE-PROPOSALS.md
```

All other files remain read-only. No root layout, global CSS, enterprise shell, shared primitive, UI03, backend, migration, 19A or 20E path is owned here.
