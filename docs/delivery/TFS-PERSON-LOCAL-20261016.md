# TFS exact-Person assignment — local verification, 16 October 2026

**Local test portion complete; authenticated closeout remains open.** Baseline is `ec463382352fb2bb56eed2d7873eedbd694f9ad6`, the existing exact-Person implementation. No TFS source repair was reproduced or made. No real Dumfries issue, user, grant, credential or database record was changed.

## Exact source inspected

- `docs/delivery/TFS-EXACT-PERSON-ASSIGNMENT-20261012.md` and existing `tests/client-workspace.test.mjs`.
- `src/components/tfs-workspace-board.tsx`: explicit Person selection, separate source-owner label, fallback preservation choice, pending/error confirmation and exact workspace/issue save path.
- `src/lib/client-workspaces/server.ts` and `types.ts`: guarded owner-choice RPC and exact issue/workspace reads.
- `src/app/api/client-workspaces/[workspaceId]/issues/route.ts` and `[issueId]/route.ts`: authenticated guarded save, exact identity, revision/reason forwarding, and independent source readback.
- Existing board/detail pages under `src/app/(enterprise)/client-workspaces/[workspaceId]/loss-prevention/`: VIEW-only rendering versus editor/owner-choice access, typed owner/history display.
- `supabase/migrations/20261012134614_tfs_exact_person_assignment.sql` plus the original CW01 migration: exact OPERATE guard, row lock, revision check, explicit/omitted/null Person behavior, Person-existence check and attributable before/after events. These files remain unchanged.

## Retained evidence

`node --test tests/tfs-person-assignment-local.test.mjs`: **20 passed, zero failed/skipped**. Focused ESLint, Node syntax and diff checks pass.

The test executes production TypeScript API routes, owner-choice reader and client editor with explicit synthetic RPC/HTTP/element/hook boundaries. External network calls are forbidden by the harness. It verifies:

- Assignment and reassignment exact UUID payloads; explicit null clearing; omitted `ownerPersonId` remains omitted at the RPC boundary rather than becoming null. The response contains only the separate guarded readback fixture and `no-store`.
- Source owner label remains independent from the chosen mapped Person. Existing Person absent from newly supplied choices remains available as an explicit preserve-current-link option.
- Create uses null issue/revision and exact Person payload; update forwards the exact existing issue, revision and reason. No grant RPC is invoked by either path.
- Controlled unknown-Person/invalid-UUID RPC errors produce generic denial; stale revision produces the existing 409 message; OPERATE denial is masked as 404. These test **handling of authoritative rejection**, not database enforcement of that rejection.
- Malformed/guessed path IDs and unauthenticated principals stop before writes. Unexpected saved identity stops before readback.
- Failed or denied readback returns 503 rather than confirmed assignment. Pending or failed client save never refreshes/navigates or announces confirmation. Unavailable owner choices disable saves and also reject direct form invocation without a network call.
- Owner-choice read uses the exact workspace RPC and fails closed on errors/non-array results.
- Static migration assertions retain row/workspace lock, OPERATE and revision guards, omitted preservation, UUID cast/Person existence, separate owner fields, before/after actor/reason history and absence of grant-table mutation statements. This is **source inspection**, not an executed PostgreSQL/RLS/history proof.

## Limits and exact remaining dependency

No real Supabase test, SQL function, RLS policy, Storage operation, browser persona or persistent history readback was exercised. RPC results are explicitly synthetic; their returned assignment values do not prove stored database state. There was no source defect warranting a production repair within this test-only lane.

The 12 October implementation report records `Invalid login credentials` for the stored synthetic Office persona. This run did not retry that login or reset any credential. Authenticated closeout needs a currently usable, approved synthetic actor with an existing exact workspace OPERATE grant, a disposable approved synthetic issue/Person pair, and a confirmed environment for create/reassign/clear/refresh/history and no-access-grant readback. It must not use the real Dumfries issue or add a grant merely to make a test pass.

No native PostgreSQL executables were found on PATH. An optional offline PGlite setup was unavailable through normal local dependency resolution (cached index unavailable, then cache temporary-write permission denied); no cache ownership/permissions were changed. A supplementary cache-read helper was also unavailable. The lane remained on the authorized application-mock/static-source checks rather than claiming SQL execution. No project dependency or lockfile was changed.

The Trello card `gT6bWGtX` must retain its authenticated readback gate. No deployed behavior, human acceptance, legal finding or production readiness is established by these local tests.
