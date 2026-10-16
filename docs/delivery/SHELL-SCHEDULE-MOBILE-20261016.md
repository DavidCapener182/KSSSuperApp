# Enterprise shell and My Schedule — local browser verification

16 October2026. Baseline13cce15060f0c561e43e71cfcf9aeecc7094ba16, independently archived checkout `/tmp/kss-shell-schedule-20261016`. The coordinator resumed this previously queued bounded test while the second worker owned Reporting source changes. No nested workers and no shared file writes. No product source defect was reproduced; no product source/CSS/auth/package/migration file changed.

## Executed result

`tests/shell-schedule-mobile-local.spec.mjs`: **3 tests passed, zero failed/skipped/cancelled** (two viewport journeys plus parent), using real Chromium at390px and1280px. Seven screenshot/layout captures all have document scrollWidth equal to viewport width. The390px initial screenshot was visually inspected: date/day controls, Event offer and accepted Site Shift actions fit and wrap inside the genuine enterprise shell.

The fixture renders actual unchanged EnterpriseShell, MyScheduleClient, Radix drawer, React/Next links and product global/module CSS. It hashes every copied source in `output/shell-schedule-mobile-20261016/source-manifest.json`. Only the fixture’s browser Supabase module is substituted, avoiding real Auth construction/sign-out; `/api/me` and `/api/my-schedule` are explicit synthetic intercepted responses. A visible simulation banner identifies this boundary. The fixture receives no `.env` or app credentials; headless browser external origins are blocked; no user desktop UI is touched.

At both viewport sizes:
- Initial returned Monday matches the Go to date input. Mobile shows one selected day; desktop shows all seven days.
- Event offer retains exact allocation/source/returnWeek in its deployment link; accepted Site Shift retains exact allocation/source in Attendance. Site Shift does not offer Event worked-time entry.
- Keyboard Skip to content focuses the real shell content target.
- Date control accepts the selected Friday; Next week requests the next Monday, shows its work and retains that week in the offer return link.
- Simulated schedule503 removes prior work and shows explicit unavailable copy; Retry recovers fixture work.
- A later simulated `/api/me`401 during visibility refresh redirects to the local sign-in destination with exact `/my-schedule` next target and removes My Schedule.

Mobile additionally verifies Tuesday keyboard selection changes aria-current and hides Monday, opens the real navigation drawer with Enter, keeps focus inside it over12 Tab transitions, and Escape closes it and restores trigger focus. Desktop verifies collapsed navigation persists over reload and can be expanded. Both journeys finish with zero browser page errors and no attempted external requests.

## Reproduction

```sh
KSS_PLAYWRIGHT_MODULE=/Users/davidcapener/.npm/_npx/e41f203b7505f1fb/node_modules/playwright node --test tests/shell-schedule-mobile-local.spec.mjs
node --check tests/shell-schedule-mobile-local.spec.mjs
./node_modules/.bin/eslint tests/shell-schedule-mobile-local.spec.mjs
git diff --check
```

Syntax, focused lint and whitespace checks passed. Localhost/headless Chromium execution required narrow accepted sandbox escalation. Playwright uses the already installed module/browser; no package change or network install. Raw fixture compiler log is retained locally as generated output, excluded from a proposed source patch because compiler indentation is not source formatting. PNGs, layout JSON and hashes remain exact.

## Limits and handoff

This closes the missing local real-shell-component layout/navigation proof. It does not establish authenticated enterprise server layout/routes, deployed role revalidation, RLS, real session revocation, persistent source facts or server acceptance. The source links were checked for exact href identity; their protected destination workflows were not executed. API failure and401 are simulations, not proof that a live account was revoked. The Supabase sign-out stub was not exercised. No physical phone, screen-reader audit or human acceptance is claimed. Synthetic Office/Staff credential failures remain a separate open access dependency and were not retried.

Deliverables are this new report, the new spec and `output/shell-schedule-mobile-20261016/`. Original checkout and published13cce15 release checkout remain untouched. No commit, push or deployment from this test lane. Reporting is still independently worker-owned until its final handoff.
