# Duty freshness and redesign integration, 17 October 2026

When Staff switch duties, an older allocation or Attendance response could replace the currently selected facts. Navigating to a new exact allocation link in the same mounted component also retained its first focus. The correction makes the current source/allocation identity and newest request own the displayed facts. Clearing selection and unmount invalidate pending results. Failed latest reads remain unavailable and can be retried.

The worker implemented one product file in the independent `kss-acceptance` archive. Coordinator reviewed the actual component and exact-focus page contract, requested the additional preserved-instance focus check, verified source/test/report SHA-256 hashes, and copied only those three handoff files into `kss-redesign`. `my-duty-client.tsx` is SHA-256 `84d03a2851e36a5bb785242a4d86e07ec4158b2aa8f11d4026a4350390afba70`.

Coordinator additionally migrated Today's Duty's existing hard-coded green/teal stylesheet onto the approved KSS semantic blue/graphite tokens, aligned its type/gutters/panel radii with the overall redesign, and retained its amber warnings and all source actions. This is presentation only. No API, role, query contract, permission, migration, Attendance/worked-time rule or DUTY-02 document applicability changed.

## Independent verification

- Reproduced the original stale-allocation failure in genuine Chromium against the actual original component before integrating the fix. A late first response removed the confirmed second selection. Log: `coordination-evidence/duty-browser-before.log`.
- Actual final component and CSS in Chromium: six scenarios passed, three at each 1440px/390px. Delayed allocation cannot overwrite a newer selection; delayed Attendance cannot attach old checked-in facts, and clearing removes details; actual Next Link navigation to a second exact focus follows its new identity. Each captured page has document width equal to its viewport. No page errors. `output/duty-freshness-20261017/browser-results.json` and six screenshots record the result. The browser blocks external origins and intercepts synthetic GET responses; no real identity or attendance fact was used or written.
- The worker's eleven local deferred-response tests cover additional old/latest denial, same-duty refresh/loading, unavailable Attendance/retry, selection clearing, list/allocation/Attendance unmount, exact focus changes and default picker behavior. Independent combined suite including these tests: **168/168 passed**, zero skips/failures.
- Full Next16.3.6 Webpack build, sequential post-build TypeScript with incremental disabled, and built sign-in smoke1/1: pass. Compile-only `.invalid` configuration, no `.env` copied.
- Full lint: zero errors, one existing unrelated unused `officeId` warning. The final test-only fixture preparation change also passes focused lint. Whitespace check passes.
- Thirteen changed product/test files in the separately tested snapshot match the integration manifest. Original dirty checkout status and all recorded changed-file hashes remain unchanged.

The persistent synthetic review server remains `http://127.0.0.1:3108/app`. The fixture preparation script now includes the real Duty component/CSS, an exact-link test route and synthetic read-only APIs. The unmodified product authentication remains enforced. Port3107 still has its deliberate non-working auth placeholder, so it is not a real-login test destination.

## Remaining work and boundaries

This is a completed, verified local functional correction, in addition to the earlier acceptance runner/matrix. The overall redesigned candidate remains local and reviewable. No push, merge, production deployment or hosted acceptance occurred. The separately recorded Production baseline remains baff9dc.

Remaining actionable verification spans signed-in Work/Documents/Reporting/Workforce, Commercial/Service, People/Training/HR, Assets/Admin and Client/TFS source/revocation cases in `BACKLOG-ACCEPTANCE-20261017.md`. Those need usable approved synthetic sessions, a named approved target and explicitly permitted disposable mutations. Earlier invalid credentials were not retried or reset. These gates are not closed by local mocks.

DUTY-02 needs recovery and hash verification of the exact earlier six-file proposal and nine-file local SQL validation artifacts from their prior executor. Hosted validation remains blocked by the recorded connector denial. Neither the missing files nor target authority were inferred from narrative. No alternative access route or permission expansion was used.

Further product phases listed as proposals or conditional in the roadmap remain separate choices: WF-02, private HR cases, Training policy expansion, new report/export contracts, stocktake and live governance/integrations. No other concrete already-approved unblocked implementation slice was established by this review. New locally reproduced defects within accepted behavior can be fixed under the same bounded process; broader modules are not implicitly implemented from roadmap labels.
