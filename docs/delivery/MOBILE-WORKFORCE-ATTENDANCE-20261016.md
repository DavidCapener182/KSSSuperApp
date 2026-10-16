# Workforce / Attendance local mobile verification — 16 October 2026

Status: local browser verification and one narrowly scoped Workforce dialog repair delivered. **12/12 browser tests passed**, with 39 captured layout checks at 390×844 and 1280×844. This is synthetic local component evidence, not authenticated remote, RLS, production or human acceptance.

## Authority and source provenance

- Parent allocated mobile follow-up for [Mobile UX & accessibility review](https://trello.com/c/vMkpSLpS), [Functional & regression testing](https://trello.com/c/rrbDYfxd) and [Workforce and operations status](https://trello.com/c/nEaY6Q7r). Cards were read on 16 October. TASK-09A's accepted synthetic Development status is retained; its responsive follow-up was tested without rebuilding Attendance.
- Isolated checkout: `/tmp/kss-document-audience-20261016`, base `ec463382352fb2bb56eed2d7873eedbd694f9ad6`, branch `doc-audience-20261016`. The original dirty KSSSuperApp checkout was not changed by this lane.
- Coordinator `01a1461e-e1a1-76b4-9559-1a047e81c0e5` agreed exclusive new spec/report/evidence ownership before writes, then explicitly approved sole source ownership of `src/components/workforce-planner.module.css` after the defect was reported. No TSX, auth, capability, global CSS, package, migration or database change was made.
- Workforce and Attendance components/CSS were copied unchanged from the base into a temporary fixture app, except the CSS repair described below. The three Staff pilot files were copied read-only from the coordinator's frozen `/tmp/kss-local-integration-20261016` source. This distinguishes the combined Staff source from unchanged baseline:

| Integrated Staff file | SHA-256 |
| --- | --- |
| `my-schedule-client.tsx` | `8b64aa524b809d17d2ab9e04289e11ff7d2bb3b04c3797ebedf3aacb74635b18` |
| `my-deployments-client.tsx` | `28861743a632d57c53644cdad69fe2ad2d0509b32e4826e6bb8e483225b572fc` |
| `my-shift-entry.module.css` | `f72d448cf99537c05744bd8b180e022025d92a0b9dd8c17b7a7bb7829a308771` |

`output/mobile-workforce-attendance-20261016/source-manifest.json` records every copied source path/hash. My Deployments was exercised in the journeys; My Schedule was included/compiled in the fixture app but was not separately browser-reviewed in this lane.

## Reproduced defect and repair

The Workforce duty sheet uses a Radix portal, placing its DOM outside `.planner`. Dark text/border tokens were defined only on `.planner`. Portalled `.inlineActions p` therefore inherited the global pale background token `--muted`, rendering near-white text on the white panel. The panel's inherited border token was also absent. The long mobile duty title additionally occupied the close button's space.

Added failing production-component browser assertions before editing CSS; their baseline run failed both Workforce dialog subtests. Other completed subtests passed. Actual computed measurements:

| Viewport | Before text / background | Before contrast | Before title overlaps Close | After contrast | After overlap |
| --- | --- | --- | --- | --- | --- |
| 390×844 | `rgb(241,244,249)` / white | 1.102:1 | Yes | 5.827:1 | No |
| 1280×844 | `rgb(241,244,249)` / white | 1.102:1 | No | 5.827:1 | No |

The four-line CSS addition defines the existing planner `--line`, `--ink` and `--muted` values on `.panel` and reserves 4rem of header padding for the existing 44px Close control. It preserves existing layout/portal behavior. Final muted text computes to `rgb(83,103,125)`. No business rules or access permissions changed.

Baseline screenshots and measurements are retained under `output/mobile-workforce-attendance-20261016/before-fix/`; final dialog screenshots and measurements are at the evidence root. Screenshots were inspected, and dialog animations were allowed to finish before the final captures.

## Actual checks

Run from the isolated checkout, using an already installed local Playwright module and browser:

```sh
KSS_PLAYWRIGHT_MODULE=/Users/davidcapener/.npm/_npx/e41f203b7505f1fb/node_modules/playwright \
KSS_MOBILE_STAFF_ROOT=/tmp/kss-local-integration-20261016 \
node --test tests/workforce-attendance-mobile-local.spec.mjs
./node_modules/.bin/eslint tests/workforce-attendance-mobile-local.spec.mjs
node --check tests/workforce-attendance-mobile-local.spec.mjs
git diff --check
```

Observed final run: **12 tests passed, 0 failed/cancelled/skipped** (11 journey subtests plus their parent). Focused lint, syntax and whitespace checks passed. Playwright 1.59.1 used its installed matching Chromium browser in headless mode. The restricted sandbox initially blocked Chromium's macOS process registration; a narrowly requested execution escalation for the prepared localhost-only harness was accepted. No unresolved approval denial remains.

The harness copies product components and actual global/module CSS to a temporary Next 16.3.6/Webpack fixture app, uses actual React/Next/Radix controls, and emulates genuine browser viewport dimensions. It displays a visible “Local simulated API · synthetic fixtures · no authentication” banner. Each test has isolated browser storage. Browser API requests are intercepted, external origins are blocked, and the fixture child process receives a restricted environment without credentials. No application `.env` file, remote server, real person or remote database is used. The temporary Next app has a simple synthetic page wrapper, not the authenticated enterprise navigation/shell.

| Local journey | Verified behavior |
| --- | --- |
| Staff Event and Site Shift, each at both widths | Assigned-work card → keyboard-activated exact allocation/source Attendance link → self Check In → simulated transport refusal → retry with the same idempotency token → disabled Recording state → fixture source readback → browser reload → Check Out → reload with exactly two simulated facts/revision 2. |
| Manager Event and Site Shift, each at both widths | Long synthetic names/details wrap; operational reason has an accessible label; blank reason disables no-show; entered reason enables it; observed check-in reads the revised fixture source and remains after reload. |
| Manager correction / long controls | Long no-show resolution control fits; correction remains disabled without reason; ambiguous London `2026-10-25T01:30` and nonexistent `2026-03-29T01:30` are rejected; valid `2026-10-16T10:05` enables Save. No correction submission was made. |
| Workforce, each width | Day/Schedule/Coverage layouts; long duty title; keyboard opens the dialog; eight Tab transitions retain dialog focus; Escape closes it; source link preserves exact Event/requirement; computed contrast and title clearance pass after repair. |
| Empty / error / uncertain states at 390px | Unaccepted allocation offers no self Check In; exact unavailable allocation has explicit empty copy; simulated fetch error has alert/Refresh; manager accepted action without a new readback revision remains an error, without confirmed-success notice. |

All **39 final screenshot layout checks** reported `document.documentElement.scrollWidth === window.innerWidth`, with no page horizontal overflow. Evidence includes `layout-results.json`, 39 final PNGs, source hashes and the local fixture compiler log. Primary Staff/manager controls were exercised by role/name, labelled inputs and visible focus; this was not a complete automated accessibility audit.

Two preliminary harness runs were interrupted for selector mismatches with existing product wording (“Next: open attendance” and Site's “Correct actual time”). These were harness corrections, not product defects. A populated 12/12 run passed before the legibility assertions were added; the subsequent failing baseline measurements, then passing CSS-repair run, establish the repair sequence.

## Limits and integration handoff

The local API simulator enforces fixture source/revision/idempotency checks only. These checks do **not** execute production attendance route policy, real RPC/RLS, auth sessions, direct database/Storage rules, durable history or remote idempotency. “Office” here identifies the manager component flow, not an authenticated Office account. Operations-authenticated scope, cross-person/client/site denials and signed-in desktop/mobile end-to-end verification remain pending for a separately approved synthetic environment. No real attendance fact was created.

The Workforce source link's identity was checked, but a full authenticated Workforce → Event source page → Attendance page journey was not executed. The temporary fixture wrapper omits the real enterprise sidebar/header, so whole-shell layout and screen-reader review remain open. No physical phone or touch-device testing, production build or deployment was performed by this lane. Webpack compiled the copied real source/CSS for these browser checks; combined production build remains the coordinator's integration check.

Handoff files: `src/components/workforce-planner.module.css`, `tests/workforce-attendance-mobile-local.spec.mjs`, this report, and `output/mobile-workforce-attendance-20261016/`. Previous document deliverables were not changed. Coordinator should review/copy only these owned files into its clean integration checkout and independently rerun. Keep the Trello acceptance gates open; no human or production acceptance is claimed. No commit, push, merge, credentials reset, role/permission mutation or deployment was performed.

## Coordinator integration readback

Copied the four owned deliverables into `/tmp/kss-local-integration-20261016` on exact baseline `ec46338`. The final spec includes `stat`/ENOENT handling so optional Staff CSS is copied even when the selected Staff source root equals the checkout root. The worker’s final accepted 12/12 rerun includes that correction. An earlier post-handoff rerun was denied before execution by automatic approval review due to frozen ownership; a later explicit instruction reopened scope and its one retry was accepted. No uncertain execution remains.

The coordinator independently executed the corrected spec with no Staff-root override: **12/12 passed**, 39 layouts match viewport widths, and all manifest hashes match integrated source. This directory’s final screenshots/JSON/compiler log are that coordinator run; before-fix evidence remains unchanged. The coordinator also passed a fresh combined 76-page production build, 69 local Node checks, post-build TypeScript, lint (one existing unrelated warning) and localhost smoke 1/1. Remote service and whole-shell gates above remain open. No further worker writes are requested after handoff.
