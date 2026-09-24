# TASK-08C — Static Allocation Action Centre

**Status:** Implemented in synthetic development; awaiting David's acceptance. No staging or production changes.

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

Only synthetic Dev was used. Protected staging and real data were not accessed. The initial source contract emits only for the new immutable `ALLOCATED` event; no Task, external delivery, scheduler, or card-level response action was introduced. Screenshots and tests are local evidence; they do not establish human acceptance, staging readiness or production readiness. The implementation is ready for David's review and acceptance.
