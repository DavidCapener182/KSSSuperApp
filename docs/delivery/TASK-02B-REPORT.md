# TASK-02B delivery report — personnel evidence review and replacement

**Date:** 23 September 2026. **Scope:** approved TASK-02B only. **Environment:** local Next.js and dedicated `KSS Enterprise - Dev` Supabase project `dnfhkmmnlbiabqypclqg`. **Data:** synthetic only. No deployment or live integration.

## Delivered

- Added one source-controlled migration: `20260922235110_document_review_replacement_02b.sql`. The migration was applied and appears in the development project's migration history. The five accepted 02A migration files were not changed.
- Added `public.document_reviews` as the immutable, typed business decision for an exact `document_versions.id`. Its unique version constraint, relationship/immutability triggers, read RLS, authenticated SELECT-only grant and fixed-search-path guarded review RPC enforce one terminal decision on the latest submitted undecided version. Ordinary clients have no review INSERT/UPDATE/DELETE grant. A minimal `audit_events` entry is inserted in the same review transaction; feedback stays in the protected business row.
- Added `public.document_subject_name` to expose the request subject's display name only to its existing audience. Extended the guarded `begin_document_upload` and `finalize_document_upload` functions and `private.document_can_submit_request` so Staff can create Version n+1 only after the latest submitted version was rejected. Existing private Storage policies and bucket were not changed.
- Added server review and exact-version download routes. Server capabilities and database guards separately enforce Office original-requester or Super authority, active roles, exact request/version binding, and non-self-review. A direct RPC call remains subject to those database checks.
- Derived Requested, Submitted — awaiting review, Rejected — action required and Evidence accepted from the current submitted version and its review; pending replacement is shown separately. The broad request `SUBMITTED` state remains submission history. Accepted evidence never means verified, compliant, deployable or scanned.
- Added reusable Documents page header, status badge, action button, field/feedback, empty state and focus-managed confirmation dialog primitives. The Office list has scoped names and review actions; Staff sees feedback and the next-version upload. History shows version, decision, reviewer Person ID, date, comment and protected downloads.

## Database object readback

The applied migration created `public.document_reviews`, index `document_reviews_request_at_idx`, `document_reviews_read` RLS policy, `private.guard_document_review()` with insert and change triggers, `public.document_subject_name(uuid)`, and `public.review_document_version(uuid,uuid,text,text,text)`. It extended the existing `audit_events` entity/target constraints and replaced the three existing upload authority/functions named above. Readback showed review RLS enabled, only an authenticated SELECT table grant, and both review triggers enabled. The `enterprise-personnel-evidence` bucket remained private; its existing four document upload/download/cleanup policies remained present. No new bucket or Storage policy was created.

Supabase security advisor readback showed no ERROR finding. It listed the existing signed-in GraphQL schema discoverability warning for nine earlier RLS-protected tables plus the new `document_reviews` table, and existing intentional authenticated SECURITY DEFINER RPC warnings plus the two new guarded 02B RPCs. The new table's SELECT grant makes its schema discoverable to signed-in users; RLS protects rows, and direct cross-person read tests pass. This discoverability warning should be revisited with the broader GraphQL exposure decision before live use. [Supabase lint 0027](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed), [lint 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Verification executed

| Check | Result |
|---|---|
| `npm ci` | Pass; 370 packages audited, zero npm vulnerabilities reported. |
| `npm run lint` | Pass. |
| `npm run build` | Pass with webpack and TypeScript. |
| `npm run smoke` | Pass. |
| `npm run test:access` | Pass. |
| `npm run test:sites` | Pass on sequential rerun. |
| `npm run test:shell` | Pass, two tests. |
| `npm run test:documents` | Pass on rerun. The first post-install attempt reached an external Supabase connect timeout; it was not an assertion failure. |
| `npm run test:document-review` | Pass, including direct RLS/RPC/Storage denial, exact bytes, immutable history, rejection/replacement/acceptance, role expiry, self-review with temporary Super role, concurrent requests and recovery. |
| Migration, table grant, RLS, trigger and bucket/policy readback | Pass in the dedicated development project. |
| Staged secret scan and `git diff --check` | Pass; no staged credential values or whitespace errors. |
| Independent bounded GPT-6 Sol read-only security review | No confirmed bypass or mutable-evidence path. Reviewer pointed out missing reviewer display and a queue count limited to recent records; both were corrected before final build. Reviewer did not inspect live grants or run mutating tests; local readback and automated tests cover these separately. |

The initial parallel regression run was invalidated by build/test server interference and then run sequentially. A later `test:sites` attempt hit Supabase Auth rate limiting; its sequential rerun passed. The 02A document test's one network timeout also passed on focused rerun. These interruptions are recorded rather than counted as passing attempts.

## Browser demonstration

The local production build was used with synthetic Office A and Staff A accounts. Office created synthetic request `f7c59d6c-702e-436f-a04c-3ab1f01a3432`. A separate existing synthetic submitted request `677c8586-a485-44f8-a3de-06bf8048b1ee` was used for the full browser review path: Office rejected Version 1 with `INCOMPLETE` and a required comment; Staff saw the reason, comment and Version 2 control; Staff uploaded a new synthetic PDF; Office saw Version 2 awaiting review while Version 1 retained its rejection; Office accepted Version 2 and saw Evidence accepted with both versions in history. The UI continued to state `NOT_SCANNED` and did not imply compliance. Automated tests independently proved exact Version 1/2 bytes, distinct object keys/hashes, reviewer/audit preservation, and Staff B/Operations isolation.

Desktop and 390px Office Documents views were inspected in the in-app browser. At 390px, `documentElement.clientWidth`, `documentElement.scrollWidth` and `body.scrollWidth` were all 390. The reject dialog exposed labelled reason/comment fields, required feedback and version-specific confirmation; initial keyboard focus went to Cancel. The Staff rejection, replacement and final Evidence accepted views were also inspected, including retained Version 1 feedback and no further replacement control. Synthetic browser fixtures remain in development; no live data was introduced.

## Files changed

Migration: `supabase/migrations/20260922235110_document_review_replacement_02b.sql`.

Application: `src/lib/auth/capabilities.ts`, `src/lib/documents/policy.ts`, `src/app/api/documents/[id]/upload/route.ts`, `src/app/api/documents/[id]/reviews/route.ts`, `src/app/api/documents/[id]/versions/[versionId]/file/route.ts`, both `src/app/(enterprise)/documents` pages, `src/components/documents-client.tsx`, `src/components/ui/workflow.tsx`, and `src/app/globals.css`.

Tests and delivery: `tests/document-review.test.mjs`, `package.json`, `docs/delivery/TASK-02B.md`, `docs/delivery/STATUS.md`, `docs/delivery/DECISIONS.md`, this report. No dependency version or lockfile change.

## Remaining boundaries and proposed TASK-02C

The existing Turbopack issue remains technical debt; webpack passes. The Documents list currently shows up to 50 recent authorised requests and labels its count accordingly; pagination is a later usability task. Evidence is still `NOT_SCANNED`. Before live personnel files, KSS must separately settle malware scanning, retention/deletion, production keys/secrets, backup/restore, privacy controls, pilot environment and support owner.

**Proposed TASK-02C for approval:** one synthetic assigned-task journey that hands off from an authorised document review to a bounded Office task and Staff My Work item, using stable Person/task IDs, dated assignment, state transition and audit. Define the narrow authority and non-leakage rules first; do not infer that evidence acceptance verifies a requirement or starts deployment eligibility. Keep publication/acknowledgement of site instructions as a separate explicitly scoped decision if TASK-02C is preferred for that original phase-map item. No TASK-02C implementation has begun.
