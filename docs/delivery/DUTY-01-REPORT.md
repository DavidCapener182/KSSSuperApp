# DUTY-01 — Today's Duty implementation

Date: 27 September 2026
State: implemented in isolated development worktree; pending David's review. No staging, production or live data change.

## Scope delivered

- Added a Staff-only `/my-duty` route and primary Staff navigation/home entry.
- Composed own Schedule records to select a current or upcoming duty, including overnight work from the preceding week. An exact typed allocation link from My Schedule can open an older duty directly.
- Re-read the selected `EVENT` or `SITE_SHIFT` allocation through the own-only deployment API. For accepted allocations, read exact own Attendance separately. The selected duty retains its source identity in the response, Attendance and Operational Contacts links.
- Put the current source action first: allocation response, then Attendance. The view also opens the existing Site Book, Incident and Equipment workspaces without claiming an inferred service, incident or custody match. Event worked time stays separate from attendance.
- Kept Operational Documents out of this duty view. Duty-specific applicability is DUTY-02 and needs its own read contract.

## Source limits

- The allocation read does not expose an exact Site Service ID. Site Book opens its existing guarded list; this screen does not identify a matching book or handover.
- Incident creation and equipment custody have no duty-scoped read or deep-link contract. Their links open separately guarded workspaces, without a duty-level summary or action state.
- The default picker reads the first 50 rows of the previous, current and next schedule week. If a week exceeds 50 allocations, it warns and links to My Schedule. Exact allocation links still work independently of that picker.
- Source responses and attendance actions stay in their existing pages and keep their own server authority. This screen does not create a Duty record or a combined readiness state.

## Checks

- `npm ci --offline --ignore-scripts`: passed in isolated worktree.
- Production Webpack build using existing synthetic development environment settings: passed, including route generation and TypeScript.
- ESLint on changed application files and focused test: passed.
- `tests/my-duty.test.mjs`: passed. Anonymous return target and private cache header, Staff route, Operations denial, underlying API denial and Staff navigation checked against synthetic development. This test made no business record writes.
- `git diff --check`: passed.
- Authenticated synthetic Staff browser at 390px: the exact allocation route rendered the duty identity and three work stages; document `scrollWidth=390` at `innerWidth=390`. The screenshot is `/private/tmp/kss-browser-check/duty-390.png`.
- The browser fixture exposed recorded September attendance on an allocation now scheduled in November. The screen displays the source facts and flags this timing discrepancy for review; it does not silently call the future duty completed.
- No human acceptance or deployment is claimed.
