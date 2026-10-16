# Document audience local verification — 16 October 2026

Status: bounded local verification delivered. The wider document audience / signed-in acceptance gate remains open. No application defect was reproduced in these checks, and no production source repair was made.

## Baseline and ownership

- Source: `ec463382352fb2bb56eed2d7873eedbd694f9ad6`, coordinator-verified current main. Original checkout remained at `e8922da` with unrelated edits and was not modified by this lane.
- Isolated checkout: `/tmp/kss-document-audience-20261016`, branch `doc-audience-20261016`. Created by `git archive` followed by independent Git initialization/index at the exact SHA; clean status confirmed before edits. It borrows source objects through a read-only Git alternate and has no dependency on source working files. Source `.git/worktrees` was not changed. Preserve the source object store while using this checkout, or make the object store self-contained before moving it.
- Coordinator: thread `01a1461e-e1a1-76b4-9559-1a047e81c0e5`. Agreed exclusive writes: `tests/document-audience-local.test.mjs` and this report. All existing document, My Work, shared auth/capability, package, CSS and migration files remained read-only.
- Scope evidence: Trello [Security, privacy & permissions testing](https://trello.com/c/DiGY0Zs7) and [BUILD STATUS — 27 Sep 2026 / KSS Enterprise delivery](https://trello.com/c/pwuaMjID), read on 16 October. The latter explicitly retains document audience checks as an open gate. Existing 02A/02B/02C, 03C and 19A implementation was reused.
- Project registry initially showed this task without a project. The attempted project move returned “cancelled, unsupported, or failed”. The coordinator's subsequent fresh registry read confirmed task `01a14626-7066-721c-a7db-fbdfad3200e3` attached to KSS Enterprise App (`8b97db78-cf8d-4a64-8db1-b4e09c06e54f`) with the expected KSSSuperApp cwd. No remaining attachment blocker was reported.

## Reproduction and checks

Dependencies installed from the local npm cache with `npm ci --ignore-scripts --offline --cache /Users/davidcapener/.npm --no-audit --no-fund` (679 packages). No lifecycle scripts or application environment files were used. Read the installed Next 16.3.6 route-handler guide before writing the test harness.

Run from the isolated checkout:

```sh
node --test tests/document-audience-local.test.mjs
./node_modules/.bin/eslint tests/document-audience-local.test.mjs
git diff --check
```

Observed: **30 tests passed, 0 failed, 0 skipped**; focused ESLint passed with no output; whitespace check passed. The first lint attempt rejected the harness variable name `module`; it was renamed and verification rerun successfully. No source repair was needed.

The harness transpiles and executes existing TypeScript route/policy modules in an isolated VM, using real capability and document/My Work policy code and NextResponse. It supplies synthetic principals, mocked session clients, scoped query results and RPC/storage outcomes. Unexpected dependency imports fail, VM fetch throws, and no credentials, real records, app server or remote service are used. Storage hashes and server proofs are supplied test doubles; their cryptographic implementations are not validated by this suite.

| Boundary | Local evidence |
| --- | --- |
| Personnel list/detail/download | Staff, Office and Super Admin receive only the records supplied by the mocked scoped query. Empty results produce empty lists and metadata-free 404s. Anonymous/Operations are denied before lookup. |
| Personnel versions and review | Projection omits raw object keys and pending bytes; current-file alias selects submitted v2 over pending upload; explicit unknown/pending version IDs do not fetch storage; historical v1 review does not attach to v2. Self-review is denied for Office/Super Admin and old-version review conflicts; permitted review forwards the exact version. |
| Privileged byte audit | Super Admin retrieval invokes exact request/version proof and audit RPC. Audit rejection returns a private 503 without file bytes or metadata. This checks invocation/failure handling, not persistence of an audit row. |
| Operational list/detail/preview | Self list invokes scoped RPC; manager detail and audience preview require explicit assignment capability. RPC errors are masked. Permitted preview forwards exact version/Person/context and returns the supplied synthetic recipient projection. |
| Operational PDF | Outside audience, historical, conflicted and list-error fixtures deny before open/download. Current access records open, obtains file authority, downloads, then rechecks exact version/object. Revocation, changed version/key, download refusal and open failure deny delivery. Manager retrieval also requires capability and fresh file authority. |
| Acknowledgement and attestation | Opening never calls acknowledgement. Explicit confirmation is required; forged Person/version body values cannot replace the current assignment version used for proof. Out-of-audience acknowledgement fails. Onboarding terms acknowledgement rejects Office, Super Admin and another Staff Person, while the exact Staff owner may submit. |
| My Work | Existing resolver rechecks private source and exact submitted version before exposing the task. A visible task row cannot expose an unavailable document source. Missing exact completed-review evidence suppresses a DONE task. |

No source changes, database/role/permission changes, credentials changes, commit, push, merge, deployment, live service test or browser interaction were performed. No full app build was warranted for these two test/report-only additions; this lane makes no new build claim.

## Remaining verification

These mocks deliberately do not prove which rows a real database returns. Real RLS/RPC/Storage audience resolution, cross-client/site isolation, finite grants, guessed-ID database denials, audit/history persistence, concurrent replacement, revoked sessions and direct Storage behavior remain unexecuted here. The existing integration tests mutate synthetic remote records and sometimes roles, so they were not run under the local-only authorization.

Signed-in Staff/Office/Super Admin/out-of-scope browser journeys, preview/download rendering and My Work at desktop/390px remain pending. A separately authorized target and synthetic personas must be confirmed before running those checks. No credential reset or permission adjustment is implied. These results do not establish production readiness, live data acceptance, reading, legal acceptance, identity/credential verification or operational eligibility.

Handoff: copy only the two owned files into the coordinator's clean `ec46338` integration checkout and rerun the commands above there. Do not apply older-root patches wholesale. The coordinator may incorporate the test/report pair after this lane's final result; existing source ownership remains with the coordinator.
