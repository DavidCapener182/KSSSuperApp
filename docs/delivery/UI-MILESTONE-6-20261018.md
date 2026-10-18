# Staff duty and Equipment visual milestone 6 — 18 October 2026

This candidate completes the redesigned presentation for My Schedule (U55), My Deployments (U56), My Attendance (U57) and My Equipment (U61), based on published 3b7b3d13413e8ba7cc0f747b4635a0ae6f54c876. Schedule uses a focused week agenda; Deployments groups response offers, accepted duties and history; Attendance keeps attributable source facts and explicit recording confirmation separate; Equipment provides a personal equipment/uniform wallet with focused history, acknowledgement and dispute Sheets. Shared published branding and navigation remain unchanged.

## Exact scope

Nine product files are enumerated in product-manifest.json. All 413 other published source files remain byte-identical. No API, authentication, permissions, schema, migration, provider or credential changes are included. The full 77-route integration is not being blindly pushed.

Already-planned functional corrections are explicit prerequisites: Schedule rejects wrong-week or retired reads; Deployments binds focused allocation/source, pending authority and current receipt/revision readback; Attendance validates the existing receipt and exact current allocation/event/revision/time before success, protects pending/lifetime/idempotency behavior, and updates only the exact confirmed row while preserving appended-page context. Server ownership remains enforced by existing principal/API/RPC guards; the client does not claim a Person-ID comparison absent from its projection.

Assets uses the existing reload path for self-view loading/error feedback, preserves original named action/readback functions, replaces the native uniform discrepancy prompt with a labelled Sheet, and separates personal equipment/uniform facts. A bounded CSS correction adds 24px desktop/16px phone insets and 32px trailing title clearance. The Assets component is shared with U30: its register presentation is affected, and a read-only register Sheet fixture checks the CSS consequence. U30 route/workflow acceptance is not claimed or counted. Existing synthetic-development product wording is retained.

## Verification

485 explicit credential-free candidate tests passed, with no failures or skips. Production build, standalone TypeScript and changed-fixture lint passed. Full lint: no errors and one pre-existing unused officeId warning. The broader local integration independently passed 872 tests, build and TypeScript. Original dirty checkout HEAD, status and all 51 file hashes are unchanged. Fresh GitHub main matches the exact published base.

Independent source review confirms all nine product hashes, all 413 non-owned hashes and an owned-only source diff. Representative browser coverage maps all nine products. Staff packets contain 21 Schedule, 22 Deployments and 23 Attendance checks across 1440/834/390/320, with 142 verified images. Equipment final evidence has 36 records and 44 screenshots, including faithful Sheet viewports and actual computed padding/title-close separation. All requests use synthetic identities and local intercepted APIs; zero external requests or real writes occurred.

The parity receipt explicitly distinguishes frozen final component bytes from initial/red immutable CSS/dependency continuity. Mutable reused fixture paths were not used to prove historical parity. Unused copied sibling files are excluded. The Equipment fixture copied an EnterpriseShell without rendering it; this is not a new U61 shell/navigation verification claim. The global shell was separately published and verified earlier. These are representative checks, not whole-route/all-variant or hosted Auth/RPC/RLS acceptance.

Earlier legacy cases remain: real receipt/readback fixtures replace empty synthetic receipts, exact request/revision/reason and rejection assertions are retained, and changed function contracts are pinned individually while unaffected contracts remain byte-identical. Diagnostic scripts are retained byte-identically as .mjs.txt evidence; canonical executable scripts remain in their frozen worker packets.

## Limits and publication

Concurrent superseding revisions, unreadable exact sources or a response moved beyond a current page may remain unconfirmed. Attendance confirms the selected row, not freshness of every paginated row. The existing retained stale-revision retry token may continue rejecting manual retries until explicit recovery; this candidate does not silently replay or change that policy. No audit-actor/reason or hosted persistence confirmation is inferred from current-state reads.

David authorised tested milestone pushes to main on 18 October. At report preparation this candidate is local and unpublished. A successful normal push and Vercel confirmation add four to the 41 published redesign routes, for 45 of 77. The other 32 route source checkpoints remain local. Held Operations browser scopes, including the separately reconciled Site Book hold, are neither accepted nor included here; prior denied hosted database/protected-token access remains untouched.
