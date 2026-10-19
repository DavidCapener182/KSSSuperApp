# PARiM identity-link reconciliation — local synthetic proposal

19 October 2026. Read-only research/prototype lane on source baseline `a95d85079c33a3fd352bd190599864a79240c27c`. This is a finished local review tool, **not a PARiM vendor adapter, an import, an approved field mapping or a verified integration**. No application, API, database migration, permission, dependency or live connection changed.

## Evidence and bounded decision

- `ARCHITECTURE.md`, integration boundary: explicit source-of-truth decisions, stable external IDs, freshness, retries and reconciliation; no copying private source data for UI work.
- Master specification v2.1 R26.1–R26.5: integration levels are separate; field owners and deletions require deliberate decisions. PARiM capability, export/API configuration and change ownership remain to be confirmed. Research cards do not approve a full operational import.
- `supabase/migrations/20260927204000_parim_existing_staff_profiles.sql`: `person_source_links(source_system, source_id, person_id, imported_at)` has a composite source primary key, a Person foreign key and unique `(source_system, person_id)`. PARiM positions are separate from access roles.
- `LIVE-PEOPLE-SITES-CLIENTS-2026-09-27.md`: historical import reports stable links and unresolved Site/address/reporting-point gaps. It does not supply an export header/schema, scope-completeness guarantee or retention policy. No actual imported records or source exports were read for this work.
- Read `AGENTS.md`, `STATUS.md`, `DECISIONS.md` and `PHASE-1-PROGRAMME-TRACKER.md`. September pending-state summaries are historical. This bounded lane comes from the current coordinator instruction, not blanket implementation authority from the master.

The only sufficiently specified contract is exact identity-link comparison. The module accepts a deliberately synthetic JSON envelope and compares opaque external IDs with synthetic copies of the existing link structure. It cannot parse an actual vendor export, prove a Person exists, verify access, establish source freshness or decide whether a missing row means departure/deletion.

## Deliverables and reproduction

- `PARIM-RECONCILIATION-20261019.mjs`: pure, in-memory parser and preview; Node standard library only, no I/O or writes.
- `../../../tests/parim-reconciliation-local.test.mjs`: 39 deterministic synthetic checks.

From the repository root:

```sh
node --test tests/parim-reconciliation-local.test.mjs
```

Call `previewSyntheticIdentityLinks(jsonText, trustedReviewScope, priorReceipts = [])`. The trusted scope must be supplied separately and match the envelope. This is a consistency check supplied by the harness, **not authorisation proof**; the caller must not treat an untrusted envelope's scope as permission. The prior receipts are also caller-held assertions, not a signed or transactional ledger.

The format is demonstrated by the `fixture()` function in the tests. Its fields are `synthetic: true`, `schemaVersion: 1`, `sourceSystem: "PARIM"`, `scope`, `batchId`, `sourceVersion`, `observedAt`, `externalIds`, and `links`. Each link has exactly `source_system`, `source_id`, `person_id`. No name, email, address, position, shift, attendance, financial or document fields are accepted. `sourceVersion` and `observedAt` are provenance assertions, not evidence of a successful vendor fetch.

The fixture envelope is a **proposed internal review format**, not an assertion about PARiM field names. Limits are preview safety bounds: 1 MiB UTF-8 input, maximum JSON nesting depth 64, 10,000 items per array, 200-character identifiers, UTC timestamps with milliseconds. A future vendor adapter needs separate reviewed mapping and size policy. Opaque source IDs preserve case, Unicode, leading whitespace and leading zeroes; they are never trimmed, lowercased, cast to numbers, or matched by names/email. UUID case alone is canonicalised for Person identity.

## Output semantics

- `EXACT_EXISTING_LINK`: exactly one ID in the declared snapshot and one unambiguous existing identity link. It does not verify employment, eligibility, current access or record authority.
- `REVIEW_REQUIRED`: duplicate source IDs, duplicate links, one Person linked to multiple source IDs, no existing link, an existing link absent from the declared snapshot, or conflicting batch history. Ambiguous entries disclose no selected Person or guessed mapping. Absence never proposes deletion, deactivation or creation.
- Every result is labelled `SYNTHETIC_READ_ONLY_PREVIEW`, `integrationVerified: false`, `freshness: UNVERIFIED`, `retention: OWNER_DECISION_REQUIRED`.
- Receipt hash covers canonical semantic content including source, scope, version, observation time, external IDs and links. Row/property order and UUID case do not change it. Raw UTF-8 JSON has a separate hash; formatting differences remain distinguishable. Batch ID is a receipt identity, so a new batch with the same snapshot is NEW with the same semantic hash.
- Same batch and scope with the same semantic hash is `EXACT_REPLAY`; changed content is `BATCH_CONFLICT` and all rows require review. Other scopes cannot establish replay. Conflicting history cannot be hidden behind an earlier matching receipt. Replay is a preview observation, not an applied import/idempotency acknowledgement.
- Inputs/ledger are not mutated, persisted or logged. Output contains synthetic IDs and must not be mistaken for permission to store real identifiers. The synthetic declaration is a caller assertion; this module cannot detect real personal data disguised as synthetic. No real data should be passed to it.

## Actual local verification

`node --test tests/parim-reconciliation-local.test.mjs`: **39 passed, 0 failed, 0 skipped**. Checks cover positive exact linking; opaque IDs; unlinked/absent records; duplicates; ambiguous Person links; UUID case; semantic/raw hashes; same/changed batch; changed version/time/mapping; cross-scope isolation; conflicting receipt history; empty snapshots; malformed/unknown/oversized fields; duplicate JSON keys (including decoded escaped-equivalent nested keys); structural strings with braces/quotes/backslashes; unknown prototype keys and nesting bounds; invalid UUID/date/source; immutability and deterministic output. Focused ESLint passed without warnings/errors; `git diff --check` passed. No hosted acceptance, real export, database reconciliation, API request or browser journey was run or claimed; this module has no app/browser surface.

## Ranked remaining decisions before a real adapter

| Priority | Exact missing contract | Required owner/evidence |
| --- | --- | --- |
| 1 | Actual stable PARiM Person key and export/API field paths, provider resource/schema/version; proof identifiers survive renames and rehire | PARiM system owner plus redacted schema/sample using synthetic records; never infer by display name/email |
| 2 | Approved tenant/account, resources/filters, export completeness/pagination and source versus KSS field ownership | KSS operational/data owner; read-only scope and explicit reconciliation direction |
| 3 | Link exceptions, reassignment/merge, unknown and missing IDs; departures/deletion tombstones and incremental-versus-full snapshot semantics | KSS People/operations owner; reviewed negative cases, no automatic unlink/deactivation |
| 4 | Observation/version semantics, timezone, freshness threshold, retry/backoff, rate/plan limits and partial-failure acknowledgement | PARiM interface evidence plus accountable operational owner |
| 5 | Permitted fields, access audience, audit receipt fields, retention/erasure period, storage location and incident handling | KSS privacy/security/data owner; synthetic-only tool currently stores nothing |
| 6 | Positions/Sites/Events/allocation mappings and who may change source work | Separately bounded approved contracts; position is never a KSS access role; missing address/reporting point remains unknown |
| 7 | Signed-in scoped readback, revocation/denials and replay with approved sandbox records | Separately authorised source and hosted acceptance; no real connection/access requested in this lane |

Eligibility, employment decisions, worked/payable/billable time, pay/charge rules, two-way sync and replacement of PARiM remain outside this proposal. No current access denial is being retried. No new credentials, exports or live migrations are needed to review this local tool. The live-adapter action is **not attempted**, pending the contracts above and separate source/access authority.
