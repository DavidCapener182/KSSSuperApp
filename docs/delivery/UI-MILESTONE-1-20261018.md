# UI overhaul — milestone 1

The shared visual system now uses a neutral KSS navigation rail, clearer typography, consistent controls and a quieter canvas. Home separates assigned work from source-backed operational updates; Workforce presents the planner as the main workspace; Event detail prioritises staffing and attendance; Duty groups the before, during and end-of-shift workflows. Entry, Settings and Access use focused forms and registers.

## Scope and authority

This bounded milestone covers U01–U03, U07–U09, U54 and U74–U77: Sign-in, Staging Access, Home, Workforce, Events, Event detail, My Duty, Access, Person Access, Incident Reviewer grants and Settings. It is one checkpoint in the approved 77-route overhaul, not completion or acceptance of all route variants.

David authorised milestone pushes to main on 18 October 2026 at 00:56 UTC: “once done or at big milestones push to main”. The existing Git-connected KSSSuperApp main branch is the publication target. Baseline: `9b958f67c874ddbae16be3b4fed450525ee44d1a`. No credentials, permissions, deployment configuration, API, database or migration change is included. The existing navigation component and capability definitions remain byte-identical.

The Event deployment drawer also includes verified source-lifetime, read-order and exact receipt/readback guards. Sign-in adds a password reveal control while retaining the existing authentication and password-clearing logic. Shared sheets respect reduced motion. Reviewer grant/revoke handlers and server role restrictions are preserved.

## Verification

- 104 local contract checks passed, zero failed or skipped, with network access blocked by the local acceptance guard. See `evidence/ui-milestone-1-20261018/local-contracts.txt`.
- Webpack production build, standalone TypeScript and full source lint passed. Build used synthetic placeholder configuration; no dotenv or hosted credentials were read.
- All 40 manifest entries match the candidate; all 31 product files match the actual local browser runtime.
- Entry/Access: 56 before/after captures at 1440, 834, 390 and 320 pixels; no document overflow, page errors or external requests. Password reveal, failed-sign-in password clearing, form retention, computed button contrast, focus visibility, reduced motion, reviewer focus trap/return and exact denied payload passed. Office Access-route denial was checked with synthetic principals.
- Event list/create: all four widths passed exact filters, selected-source POST payload, rejected-save draft retention, keyboard trap/return and reduced-motion checks.
- Event detail, Workforce and four Duty phases passed representative keyboard and exact-source handoff checks at 1440, 390 and 320 pixels.
- Navigation: 12 role/reviewer/dynamic cases passed against both source versions, including desktop and phone group/order/depth parity, collapse persistence, tooltips and mobile focus handling.
- The original dirty checkout retained its HEAD, porcelain status and all 51 saved file hashes.

Browser checks used actual product components and explicitly synthetic identity/data boundaries. Mutations were intercepted and denied. These checks do not establish authenticated hosted Auth/RPC/RLS acceptance or Duty backend validation. Later source checkpoints remain outside this milestone until their own review and browser verification.

## Reviewed visual evidence

Before/after comparisons use matching labelled synthetic records. Desktop appears above phone, before on the left and after on the right.

- [Event](https://chatgpt.com/api/library/files/libfile_fa8661d81358819183ee719ec6098fce/download)
- [Sign-in](https://chatgpt.com/api/library/files/libfile_ae8da7fb48c88191ab7c3fc1abe5e83c/download)
- [Incident reviewer access](https://chatgpt.com/api/library/files/libfile_e61db0f3e8608191bc9dff15b2d3ebfd/download)

Home and Workforce comparisons were delivered separately. The newly captured Event list and Create Event panel were also visually inspected. This report records local evidence; the Git push and actual deployment result must be verified separately.
