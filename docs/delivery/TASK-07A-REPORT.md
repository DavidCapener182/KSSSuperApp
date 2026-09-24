# TASK-07A development completion — Staff Availability

**Status:** Implemented in synthetic KSS Enterprise Dev only, pending David's acceptance. Starting commit `ce28b70`. Protected staging, live data and production policy are unchanged.

## Delivered

- Active Security Staff can declare future `AVAILABLE` or `UNAVAILABLE` intervals in **My Availability**, distinct from **My Deployments**. Exact instants use half-open `[starts_at, ends_at)` ranges and Europe/London entry/display. Whole days, rest of today, custom/overnight ranges and bounded optional private notes are supported. Custom ambiguous/nonexistent DST times are rejected; London whole days can span 23 or 25 elapsed hours.
- Atomic replacement splits existing current intervals. For example, a 16:00–17:00 unavailable entry inside 12:00–20:00 available retains the outer available fragments and typed history. Overlap and affected own deployments require explicit preview/acknowledgement. Future cancellation also preserves history. Expected Person revision rejects stale edits. The initial 12-month horizon and 31 London-calendar-day entry bound are technical safeguards, not KSS policy.
- Exact-duty evaluation derives `DECLARED_AVAILABLE`, `DECLARED_UNAVAILABLE`, `NOT_FULLY_COVERED` or `NOT_DECLARED`. Any unavailable overlap hard-blocks allocation. Adjacent available intervals can jointly cover the entire duty; partial coverage and no declaration remain review warnings. Manager candidates receive only status and reason codes. Existing 06C role, clash, capacity and development-only synthetic SIA checks remain separate.
- Candidate search is informational. `deployment_allocate` recomputes availability after the Person lock, so concurrent availability and allocation actions resolve in committed order. Staff may declare unavailable over an existing accepted allocation after acknowledgement; allocation state and history stay intact. Staff and authorised managers see controlled conflict wording, with no private note or source evidence.
- Office, Operations and Super Admin have no ordinary availability editing action. Their exact authorised Event candidate/allocation views see only safe derived indicators. Direct table/history writes are revoked and guarded; Staff Person is resolved from authenticated identity, never browser input.

## Database and migrations

Source-controlled Dev migrations applied in order:

1. `20260924100601_staff_availability_07a.sql`: declaration/version/history tables, guarded self RPCs, exact evaluator and 06C integration.
2. `20260924101515_fix_availability_guard_07a.sql`: forward trigger correction found by the first focused run; the failed transaction wrote no availability record.
3. `20260924101752_ack_availability_cancellation_07a.sql`: cancellation acknowledgement when existing allocations lose coverage; API caller was changed to match.
4. `20260924102931_availability_calendar_bound_07a.sql`: 31 London-calendar-day technical bound, including DST-transition days.

Dev project `dnfhkmmnlbiabqypclqg` alone received the migrations. Migration registry/object readback confirmed the new RPCs and three RLS-enabled tables without direct authenticated table grants. The advisor's “RLS enabled no policy” INFO for these RPC-only tables is intentional. The optional `btree_gist` extension was absent; guarded Person row locks, overlap validation and revoked direct writes are used instead, with concurrent-call tests. No staging migration or deployment occurred.

## UI and browser evidence

- Staff **My Availability** has upcoming declarations, a responsive entry Sheet, replacement/affected-deployment preview, change/cancel actions and bounded history. **My Deployments** shows own declaration conflicts without changing response state.
- Office/Operations allocation Sheets show a safe availability label alongside the independent clash and configured-check results. No readiness verdict or green styling was added.
- Signed-in local production-build browser checks: Staff 390px My Availability/entry Sheet and My Deployments; Operations 1280px and 390px Event/candidate Sheet; Office 390px Event/candidate Sheet. Checked views had 390px body width in a 390px viewport, visible labels/focus and no horizontal page overflow. Staff `/api/availability/me` returned 200; Operations returned 403; anonymous returned 401. A candidate API read showed safe `NOT_DECLARED` alongside the independently satisfied synthetic SIA source check, without private source values. Browser checks opened/read the relevant surfaces; guarded mutations were proved by focused tests.
- Representative captures: `output/playwright/availability-07a/staff-390-sheet-viewport.png`, `staff-390-deployments-viewport.png`, `office-390-sheet-viewport.png`, `operations-1280-sheet-viewport.png`. Development has accumulated synthetic fixtures, so long page captures contain noisy historical records; the viewport captures show the actual interaction surfaces.

## Verification and limits

- `npm ci --ignore-scripts --no-audit --no-fund`, lint, TypeScript, Webpack production build and `npm run smoke` passed.
- Focused availability tests passed: Staff self/manager write boundary; raw table/history denial; replacement/splitting; exact candidate labels and safe fields; accepted allocation conflict preservation; stale revision; concurrent saves; allocation race; adjacent coverage/gap; cancellation acknowledgement/history. Time tests passed 23/25-hour all-day dates, custom DST rejection, overnight and rest-of-today conversion. Independent 06C deployment regression passed after updating its expectation for a deliberately undeclared candidate and paginating accumulated Dev history.
- One serial `tests/*.test.mjs` attempt was **incomplete**: 14 passed and 15 failed. Thirteen failures stopped on Supabase Auth `Request rate limit reached`; the existing controlled-document fixture returned `Onboarding case denied` (403 versus expected 201); the remaining 06C assertion reflected the intentional 07A availability result and was corrected, then passed independently. The full suite is **not** claimed green. See separate `ENGINEERING-TEST-AUTH-SESSIONS.md` for bounded session-reuse work; the controlled-document fixture denial needs independent diagnosis.
- No intentional product green in changed UI. Source and staged-file scans found no credential values. No Auth limits or production configuration were weakened. A bounded single-agent security review covered Staff actor mapping, manager projection, RPC grants, direct-write denial and allocation-time recomputation; focused failures were fixed by forward migrations.

## Remaining boundaries and next task

Availability does not establish eligibility, Staff acceptance, attendance, worked/payable time, travel/rest or training. The `SIA → SECURITY_GUARDING` rule remains synthetic Dev-only; live policy and the training provider remain open. No recurrence, manager-entered absence, notifications, rota or finance was added. Recommend a separately approved **TASK-07B Workforce Schedule / Rota** to compose Event demand, allocation, Staff response and declarations into a weekly operational view. Do not deploy 07A to staging automatically.
