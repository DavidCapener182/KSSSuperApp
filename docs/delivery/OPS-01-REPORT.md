# OPS-01 — Control Room attention desk

Date: 27 September 2026
State: implemented in isolated synthetic development worktree; pending David's review and coordinator integration. No new migration, staging, production or live data change in this task.

## Scope delivered

- Reshaped the accepted `/control-room` snapshot into a factual attention desk. Tabs show all attention, staffing reasons, attendance reasons, separately authorised Incident references, Handover's missing read, and all operational source rows.
- Kept Required, Allocated, Accepted and Checked In as separate counts. Explicit no-show, attendance review, open staffing and availability conflict reasons are shown only when returned by the existing 13A source read. The screen makes no priority score, readiness verdict or cross-source acknowledgement.
- Shows 10 rows initially with a user-controlled continuation on the current bounded page. Current/upcoming attention precedes recent attention, and each row retains its source window and exact Event or Site Service identity.
- Carries source/site/offset/tab/focus in a local return URL for Event and Site Service detail and Attendance. Return reads a fresh Control Room snapshot, highlights the matching row, or explains that it has moved or disappeared from the current filtered page.
- The Handover tab states that 13A has no Site Book attention projection and links to the separately guarded Site Book. Incident references remain hidden without the separate Incident Reviewer grant and individual links are hidden in large display.

## Checks

- Full Next.js Webpack build with existing synthetic development settings: passed.
- Focused ESLint and `git diff --check`: passed.
- Read-only authenticated route test in `tests/my-duty.test.mjs`: Staff denied Control Room; Operations can open it and the source Attendance route displays a validated return link. No business record writes.
- Authenticated Operations browser at 390px: six tabs, 10 initial rows, no horizontal overflow (`scrollWidth=390`, `innerWidth=390`); Handover limitation is visible. At 1280px, no horizontal overflow (`scrollWidth=1280`, `innerWidth=1280`). Screenshots are `/private/tmp/kss-browser-check/control-room-390.png` and `/private/tmp/kss-browser-check/control-room-1280.png`.
- Browser source-to-return journey: authorised Site Service opened from the desk, the return link reopened `/control-room` with focus, and the matching current row was highlighted after refresh.

## Limits

- The 13A snapshot is aggregate and does not expose named officer detail, observed per-person times, Site Book handover status or acknowledgement ownership. Those claims require separate source-owned reads and authority decisions.
- This UI has not been deployed or accepted by David. The source projection and synthetic development records are unchanged.
