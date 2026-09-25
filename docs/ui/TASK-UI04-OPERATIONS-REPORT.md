# TASK-UI04 — Operations Workspace report

Status: UI-only partial implementation in isolated branch; not accepted.

Starting canonical main HEAD: `25dfb02dd5e1da087b0cc8034b2260d8c129122c`. Exact edited paths are in `TASK-UI04-OWNED-PATHS.md`.

## Source contracts and design direction

Read the UI01 product inventory, journey audit, design audit, roadmap and public competitor pattern review from the shared checkout, plus accepted 09B, 13A and 14A reports. The Control Room remains the bounded 13A read projection. It has no Site Book or asset facts and cannot present a combined source record or inferred risk score. Its Event and Site Shift cards retain exact source links and factual attendance links. Incident detail remains under the separate reviewer grant. Action Centre notifications retain the Staff-specific 08B/08C allocation source and link to My Deployments; reading or dismissing a notification does not respond to an allocation.

TrackTik, Guardhouse, Resolver and PagerDuty patterns in UI01 support an exception-first, source-labelled desk. This is a design inference from public material, not competitor task testing.

## Changed

- Restyled Control Room cards and attention rows with clearer hierarchy, source labels, separate staffing facts, readable time and stronger focus/44px action targets. Attention rows with attendance review or explicitly recorded no-show now link directly to the accepted source attendance route alongside the Event or Site Service link. Added a separate Site Book link and explicit boundary text; no Site Book fact is aggregated into Control Room.
- Action Centre notification state changes now show a success message only after server acceptance and a subsequent read projection confirms the requested read/dismissed state. If refresh or bounded confirmation fails, it says confirmation is unavailable and keeps the prior authoritative display. Increased section and action targets to 44px.
- No backend, migration, global style, shared component, 19A, 20E, UI03 or real data change.

## Deferred source and screen changes

The current 13A Control Room projection does not contain Site Book handover age, responsible owner or a cross-source priority; those cannot be added as UI-only facts. Incident, Site Book and attendance composition needs a separately approved bounded screen pass with authenticated source-specific scenario checks. Static worked time remains outside accepted 10B. No new severity, risk or urgency ranking was introduced.

## Checks and evidence

- Scoped ESLint passed on the two edited TSX files.
- Webpack production build passed with the existing development environment configuration; it compiled and generated the operations routes. The first build attempt without `.env.local` compiled but stopped at `/staging-access` prerender because the Supabase URL/key were absent. No credentials were printed.
- `tsc --noEmit` passed after Next generated its route types; `git diff --check` passed.
- A local preview server started on `127.0.0.1:3104` with approved sandbox escalation. Playwright CLI did not return a snapshot within 35 seconds and was stopped. Desktop, genuine 390px layout, keyboard/focus operation and authenticated source readback are **not verified** in this run. CSS breakpoints and focus selectors are implementation, not visual evidence.
- No acceptance, staging or production claim follows from these checks.
