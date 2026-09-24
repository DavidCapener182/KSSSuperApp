# TASK-08C — Static Allocation Action Centre

**Status: ACCEPTED — SYNTHETIC DEV.** David formally accepted TASK-08C on 24 September 2026. No staging or production changes.

## Acceptance and close-out

David accepted the delivered initial static allocation notification contract and the evidence below. The notification is created atomically from the immutable initial Site Shift `ALLOCATED` event, with the recipient derived only from the exact allocation Person. Typed Event and Site Shift sources, IDs, history, RLS, guarded producer, direct-write denial and FK/XOR integrity remain separate. Retry or concurrent replay returns one logical notification; replay after cancellation adds no second `CREATED` event. `READ` and `DISMISSED` change presentation only. My Deployments alone handles Staff response and independently reauthorises the exact static allocation; cancelled/inactive sources remain truthful history without a response action.

David accepted the three synthetic Dev migrations and readback, concurrent replay with one notification UUID and one each of `CREATED`, `READ` and `DISMISSED`, focused 08C and existing 08A/08B regressions, lint, Webpack build, authenticated desktop/390px Action Centre and My Deployments browser proof, no horizontal overflow, and preserved Event notification behaviour. Existing project-wide advisor findings and pre-existing Event-source notification-history FK index findings are outside TASK-08C and do not block acceptance; the new static source FKs have covering indexes.

No further static notification kind, Task, response control on a notification, email, SMS, push, provider, scheduler, staging, production or real KSS data is authorised. Stop this lane after its acceptance commit; future implementation work follows David's maximum of two active implementation tasks.

## Delivered

- Added a guarded, same-transaction notification for the immutable first `ALLOCATED` Site shift event. The notification recipient comes from the exact allocation Person. Existing Event notifications retain their Event source and output contract.
- Added typed static source references and XOR integrity checks to both notification and history records. Read/dismiss updates only presentation state. Static retries return the same notification and do not add another `CREATED` entry, including after source cancellation.
- Extended the Staff-only Action Centre projection and added `my_deployments_08c` for typed static focus. `/my-deployments?allocationId=…&source=SITE_SHIFT` reloads and authorizes the current source independently.
- The notification remains informational; allocation response remains on My Deployments.

## Database scope and migration evidence

Applied to dedicated synthetic Dev project `dnfhkmmnlbiabqypclqg` only:

| Version | Migration |
|---|---|
| `20260924140336` | `static_allocation_action_centre_08c` |
| `20260924140706` | `static_notification_fk_indexes_08c` |
| `20260924140945` | `replay_static_notification_after_cancel_08c` |

Dev readback confirmed both notification tables retain RLS, authenticated direct table reads/writes are denied, the private producer is not callable by authenticated users, and the authenticated staff RPCs enforce self scope. The focused integration checks confirmed recipient-only visibility, denial for peer/Operations/Office, source discriminator isolation, idempotent READ/DISMISS, and no source-state mutation from presentation actions.

Two concurrent privileged replays of one cancelled synthetic source event returned the same notification UUID. Readback showed one notification and exactly one each of `CREATED`, `READ` and `DISMISSED` for that fixture. Post-run Dev readback showed 9 synthetic static notifications and 15 static history rows in total; these are test fixtures, not live staffing records.

The Supabase CLI was unavailable locally and its `npx` installation could not reach the package registry. Migrations were authored locally and applied/read back with the Supabase MCP. Local filenames were aligned to the exact versions assigned by Dev. Security and performance advisors were rerun after DDL. The RPC-only tables intentionally have RLS enabled without direct policies; access is through guarded functions. The advisor also reports the new `my_deployments_08c` security-definer RPC, which is intentional and reauthorizes exact active Staff identity and source ownership. Remaining unindexed-FK findings shown for notification history relate to pre-existing Event-source/actor/allocation/recipient FKs; the new static source FKs have covering indexes. Project-wide legacy advisory findings remain outside this slice.

## Verification

- `npm run lint` passed; two warnings were reported in unrelated/concurrent files (`tests/onboarding-queue.test.mjs` and `tests/site-horizon-maintenance.test.mjs`).
- `npm run build` passed using the repository's Webpack build path.
- `tests/static-allocation-action-centre.test.mjs` passed against synthetic Dev, including exact source focus and peer denial.
- Existing `tests/action-centre.test.mjs` passed (08B Event regression).
- Existing `tests/site-shifts.test.mjs` passed (08A static allocation/My Deployments regression).
- Authenticated local browser proof passed at 1280px and 390px. Both Action Centre and focused My Deployments had `scrollWidth === viewport width`. The Action Centre item showed “Site shift”, the exact Site Service/Site/role/date/time, dismissed/currently inactive state and an `Open in My Deployments` link. The exact `source=SITE_SHIFT` deep link displayed current history and did not offer response actions for the cancelled allocation.
- Screenshots: [Action Centre dismissed history, 390px](../../output/playwright/task-08c-action-centre-dismissed-390.png), [focused My Deployments, 390px](../../output/playwright/task-08c-focused-mobile.png), [focused My Deployments, desktop](../../output/playwright/task-08c-focused-desktop.png).

## Scope and remaining boundary

Only synthetic Dev was used. Protected staging and real data were not accessed. The initial source contract emits only for the new immutable `ALLOCATED` event; no Task, external delivery, scheduler, or card-level response action was introduced. David's synthetic Dev acceptance does not establish staging readiness or production readiness.
