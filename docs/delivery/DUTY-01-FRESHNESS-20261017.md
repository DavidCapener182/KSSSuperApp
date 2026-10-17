# DUTY-01 exact-selection freshness correction — 17 October 2026

When a Staff user switches duties while the previous duty is still loading, the older response can overwrite the selected duty or attach its attendance to the newer duty. Clearing the selection can also leave old details visible. Navigating to a new exact allocation on the same mounted client previously kept the initial focus. This correction makes the current selection and latest request own the displayed facts.

Scope: isolated `kss-acceptance`, based on exact `baff9dc1285cc06778dd2346d90424089c1d5ed3`. Approved DUTY-01 implementation/report and Phase 1 accepted-build freshness/source-readback work provide the existing behavior; coordinator explicitly assigned this bounded defect lane after reproduction. Exactly one product file changes: `src/components/my-duty-client.tsx`. Added `tests/my-duty-freshness-local.test.mjs` and this report. No source API, query shape, role, record authority, migration, field, Attendance/worked-time distinction or DUTY-02 behavior changes. Original dirty checkout and redesign CSS remain untouched.

## Reproduction and root cause

The actual production component is transpiled and executed with a controlled React-hook lifecycle and deferred GET responses. No copied product implementation is substituted. Original requests update shared state without checking whether the selected duty or request changed. Initial `useState(focus)` also does not follow later focus props in a preserved client instance.

Before product edits, all five initial tests failed: late allocation replaced fast second selection; late Attendance attached old check-in state to the second duty; selection clearing restored old cards; old denied request hid newer confirmed details; and a pending request wrote state after unmount. Red TAP is retained as `output/backlog-acceptance-20261017/duty-freshness-red.tap`. After the first correction, a separate preserved-instance exact-focus test failed (old Event remained selected instead of the requested Site Shift); its red TAP is `duty-focus-red.tap`.

## Correction

Independent monotonic list/detail request counters allow only the current response to set facts, errors or loading. Selection changes immediately clear prior details and invalidate pending results; effect cleanup invalidates results on selection change/unmount. Rendering requires the detail identity to match the selected source/allocation pair. Focus-prop changes synchronize the selected exact identity while hiding prior-focus facts until synchronization. The initial automatic current/upcoming selection and deliberate manual picker remain available. Exact allocation and Attendance identity checks remain; data failures still produce an explicit unavailable state with Retry.

## Fresh verification

- **11/11 local freshness tests pass** with network blocked: slow-first/fast-second allocation and Attendance; clearing; outdated denial; latest denial; allocation/Attendance/list unmount; repeated same-duty refresh and loading; unavailable Attendance/retry; same-client focus navigation and pending prior focus; manual picker after focus navigation; automatic upcoming selection and wrong-source denial.
- Existing credential-free acceptance regression **155/155 passes** after the product change.
- Focused ESLint on product and new tests: exit 0, no warnings. `next typegen`, then sequential `tsc --noEmit --incremental false`: exit 0.
- Changes preserve every other baseline product file. Source/test/report hashes and a scoped patch are recorded in the handoff manifest.

The tests use an explicit local hook/network boundary and establish component state ordering, not React browser rendering, hosted Auth, RPC/RLS/Storage or human acceptance. Coordinator owns the genuine Chromium fixture and final integration/browser/build review. No full app build, signed-in journey, migration, push or deployment was performed in this lane. DUTY-02 remains separately blocked by missing exact artifacts and denied hosted access. No credential or `.env` was read or loaded.
