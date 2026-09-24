# TASK-14A delivery report — synthetic Dev Site Book

Date: 24 September 2026. Status: **accepted by David in synthetic Dev on 24 September 2026**; not staged or production ready. This report covers only the approved routine Site Service book.

## David's acceptance — TASK-14A

David accepted the routine Site Occurrence and Shift Handover Book in synthetic Dev. The accepted first slice covers routine Site Service entries, outstanding items, multi-contributor shift handover, individual acknowledgement of the exact revision, reasoned resolution/reopening, immutable correction/history and finite relief-Staff contributor access. David accepted the synthetic security/integration proof, related regressions, build and authenticated 1280px/390px browser evidence. Reusing two synthetic Staff accounts for outgoing contributions and incoming acknowledgements is not an acceptance blocker; a four-person roster remains a future synthetic proof.

Site Book remains separate from Incidents, MagSecure patrols, Assets, attendance, worked time and Tasks. An entry or handover acknowledgement does not establish attendance, asset custody, Incident status or work/pay facts. Retention, legal hold/erasure, special-category handling and final privacy policy remain mandatory pre-live gates. Acceptance authorises no staging, production or real KSS data. Narrow Control Room facts, exact Asset references and explicit Incident creation are separate future tasks, with no automatic conversion or custody transfer.

## Delivered

- One book per exact `site_services.id`. Entries have permanent IDs, optional consistent dated-demand/allocation links, authenticated author, reported `occurred_at`, server `recorded_at`, original UK local time/offset and append-only correction versions. Allocation context is optional, so authorised relief Staff can contribute without one.
- Routine types cover contractor/visitor/delivery, keys/equipment, maintenance, client instruction, observation and outstanding items. There is no Incident conversion, MagSecure checkpoint/patrol workflow, attachment, notification, Task, client access or asset inference.
- Open items have independent IDs and attributed `OPENED → UPDATED → RESOLVED → REOPENED` history. The next-shift view carries all current open items without copying them into each handover; recently resolved lineage remains reachable from entry/search. A correction never overwrites the original.
- Handovers have exact outgoing windows, multiple attributed contributions, revisions, individual receiver acknowledgements bound to the exact revision, and reasoned manager closure. A later contribution creates a new revision; an earlier acknowledgement is visibly attached to the version seen.
- Staff access requires an active Staff role plus exact current allocated duty or a finite Person+Service contributor grant. Office/Super Admin issue and revoke grants with reasons and immutable grant events. Operations requires active role plus exact `SITE_BOOK_MANAGER` grant for that Service; Office has grant administration but no blanket book read. Super Admin oversight and manager reads are audited. Service, action and source identity are rechecked in guarded RPCs. New tables have RLS enabled and no direct authenticated table grants.
- The `/site-book` and `/site-book/[serviceId]` journey puts handover and acknowledgement, open items and recent notes ahead of the chronological list; scoped search and item lineage are available. `/site-book/access` manages finite grants. At 390px these surfaces use a single column, labelled actions, text status and blue/graphite/neutral styling with no green. A failed network submission keeps only the in-memory draft and says **Not sent**; no offline persistence or false server confirmation is used.

## Exact database boundary

Dedicated synthetic Dev project `dnfhkmmnlbiabqypclqg` was confirmed before application. Source and Dev migration history now match:

1. `20260924174321_site_book_14a.sql` — core identity, append-only business tables, RLS, grants and guarded write/read RPCs.
2. `20260924174833_site_book_access_choices_14a.sql` — scoped Office/Super grant selectors.
3. `20260924175751_site_book_read_model_14a.sql` — author IDs for action display, item history/search and serialised idempotency-key retries.
4. `20260924180819_site_book_item_lookback_14a.sql` — Staff cannot fetch arbitrary old resolved-item history by guessed UUID.
5. `20260924180911_site_book_item_execute_14a.sql` — restores authenticated execute on the guarded item-history RPC after replacement.
6. `20260924181907_site_book_grant_uniqueness_14a.sql` — prevents a second unrevoked grant of the same Person, Service and kind from silently retaining access after one grant is revoked. An expired grant must be explicitly revoked before replacement.

Readback confirmed RLS enabled on all 11 `site_book_*` tables. The Supabase security advisor lists these tables under informational `rls_enabled_no_policy`, consistent with the deliberate RPC-only, no-direct-grant pattern; it lists callable `SECURITY DEFINER` RPCs for review. No advisor finding was treated as a substitute for the negative tests below. No staging or production project was targeted.

## Synthetic proof and checks

`tests/site-book.test.mjs` passed against authenticated synthetic Dev. It created **Music Warehouse Security**, a 24/7 Site Service with materialised 06:00–18:00 day and 18:00–06:00 night demand. Staff created a routine note, maintenance item, contractor attendance and key note; two Staff contributed to one handover; each then acknowledged its exact revision independently. An open item appeared on the next-shift view, Operations added a factual update and reasoned resolution, and the full original/action lineage remained available. Staff correction created version 2 while version 1 remained readable. One Staff member also contributed through an exact night allocation after their contributor grant was revoked. Another contributed without allocation through a finite grant; revocation removed access immediately. A Staff member granted **another Site Service** could not read this book.

The focused test also denied Office book detail, Operations without manager grant, ungranted Staff, cross-person correction, cross-Service IDs, direct table/history writes and changed-payload idempotency-key reuse. Concurrent identical submissions returned one entry ID. The test revoked its temporary grants and cancelled its allocation; synthetic book history remains as evidence. The current fixture reuses the two synthetic Staff accounts as both outgoing contributors and incoming acknowledgers, so a four-distinct-person roster was not tested; the database stores each contribution and acknowledgement under its own Person ID.

`tests/site-book-routes.test.mjs` passed: unauthenticated redirects, Staff/Office route boundaries, Staff denial of grant APIs and unknown Service/search denial. A serial related regression run passed 08A Site shifts, 09B static attendance, 12A Incident core and Incident routes. Its first shell run failed because concurrent 13A/18A navigation had not yet been reflected in shell expectations; after those changes, the shell run passed 2/2. The final focused Site Book run passed 2/2. Owned-file ESLint, `npx tsc --noEmit`, `git diff --check` and a Webpack `npm run build` passed. One earlier build attempt encountered duplicate generated `.next/dev/types/* 2.ts` files during concurrent development; a later fresh build passed without source changes for that issue.

Authenticated local browser proof with synthetic Staff and Office accounts verified the next-shift card, independent-acknowledgement text, entry submission, finite grant-management page, and no horizontal overflow at desktop 1280px and mobile 390px (`scrollWidth === viewport width`). A deliberately aborted submit request displayed **Not sent — retry when online**, retained the in-memory draft and did not claim receipt. Temporary browser-proof contributor grants were revoked. Evidence: [desktop Site Book](../../output/playwright/task-14a-site-book-desktop.png), [390px Site Book](../../output/playwright/task-14a-site-book-390.png), [390px grant management](../../output/playwright/task-14a-access-390.png). These are synthetic development observations, not a human usability sign-off.

## Limits and stop gate

The implementation deliberately has no real records, client view, attachment, notification, Incident automation, MagSecure data, asset ID, payroll/attendance/worked-time effect, staging migration or production deployment. TASK-13A can later consume only an explicitly authorised safe read projection; TASK-15A can later add an exact asset reference. Neither is wired into 14A. Retention duration, legal hold/erasure process, special-category handling and controller policy remain pre-live decisions. The 48-hour Staff timeline, current open items and latest handover are the first-slice read boundary; manager search is Service scoped. No claim of emergency response or verified client instruction is made.

**STOP:** TASK-14A is accepted in synthetic Dev. Do not advance to staging, production, real data or a follow-on feature under this task.
