# TASK-16B delivery report — Credential Capture & Verification Foundation

**Date:** 24 September 2026

**Status:** accepted by David in synthetic Dev on 24 September 2026. Implementation commit `72d9ffa`. No staging or production change.

## David's acceptance, 24 September 2026

David accepted the delivered separation: Person → credential claim → immutable submitted revision → exact accepted `DocumentVersion` evidence → independent credential verification decision. Document acceptance does not verify a credential, and credential verification does not establish operational eligibility. Acceptance covers only the three distinct synthetic SIA categories listed below; no other qualification is inferred or seeded.

`STAFF_DECLARED` records submission provenance, `OFFICE_CHECKED_EVIDENCE` can create a synthetic verification decision, and `EXTERNALLY_CONFIRMED` remains unavailable pending an approved external source. Each decision remains bound to the exact Person, category, submitted revision, accepted evidence version and SHA-256, reviewer, method, dates and immutable history. Replacement or material changes do not inherit verification. Rejection, revocation, withdrawal and reopening preserve attributed history; expiry is a factual state, not a duty decision.

The 03B–03F onboarding SIA history remains a separate historical domain, with no migration or backfill into current 16B credentials. Review authority remains a finite Person/category grant: Office membership alone grants none, Operations receives no credential detail, Staff is self-only, and Super Admin oversight uses the audited exact-Person path. Credential references, evidence identifiers, filenames, reviewer notes and private history remain outside broad operational projections and audit payloads.

David accepted the recorded synthetic-Dev checks below, including the successful route test before final oversight hardening and direct authority/readback after it. The later route-test interruption from the shared `.next/dev` lock and the production-build TypeScript failure in a concurrently changing TASK-19A file are shared-checkout evidence limitations. No successful full production build is claimed for 16B.

This acceptance has no effect on Event or Site Shift candidate checks, allocation, Availability, Workforce, Attendance, Worked Time, Training, payroll or operational eligibility. The existing synthetic SIA candidate rule remains separate and gains no live-use approval. Real SIA verification or API, real Staff evidence, treating `NOT_SCANNED` as malware-cleared, real-data retention/deletion policy, Training adapters, role requirements, deployment eligibility, staging and production remain unapproved. Stop TASK-16B here. TASK-16C and TASK-16D require separate approval after native Training establishes suitable result/certificate identities; TASK-16D owns any future versioned role requirement and whole-duty allocation guard.

## Delivered

- A separate 16B credential domain owns one Person/category claim, mutable draft, immutable submitted revisions, exact accepted `DocumentVersion` ID and SHA-256 binding, append-only verification/rejection/revocation decisions, and withdrawal/reopen events. Only Security Guarding, Door Supervision and Public Space Surveillance (CCTV) are seeded. References are synthetic by schema.
- Staff can save a draft, submit only with accepted exact private evidence, see current and historical states, and withdraw. Material draft changes advance a sequence so returning to an earlier value cannot restore an old verification. An accepted document alone never yields `VERIFIED`.
- A finite Person/category Credential Reviewer grant gates Office review and credential detail. The reviewer creates an exact private Documents request, then uses the existing guarded upload/review/file workflow. Super Admin grant administration and exact Person oversight are attributed; direct Super Admin credential-table reads are denied and the oversight RPC records a controlled audit event.
- `STAFF_DECLARED` records submission provenance. Only `OFFICE_CHECKED_EVIDENCE` may create a credential decision. `EXTERNALLY_CONFIRMED` exists as a reserved enum value but is blocked by constraints and route validation.
- The Staff Record and My Credentials screens separate current 16B claims from historical onboarding SIA. No existing onboarding verification creates a 16B claim. Withdrawn 16B claims appear in history. The Office screen lists only assigned review responsibility and guarded evidence actions.
- The existing 03B–03F SIA tables, candidate/allocation guards, Workforce, Availability, Attendance and Worked Time code were not changed by this task.

## Dev migrations and readback

Source migrations: `20260924194554_credential_foundation_16b.sql`, `20260924195120_fix_credential_submission_alias_16b.sql`, `20260924195954_office_only_credential_decisions_16b.sql`, `20260924200344_audit_credential_oversight_16b.sql`. These versions are applied only to dedicated Dev project `dnfhkmmnlbiabqypclqg`.

The exact Dev test left one withdrawn Door Supervision claim, one immutable revision, an Office checked `VERIFIED` decision and later `REVOKED` decision. The accepted evidence hash and exact version remain linked. The temporary reviewer grants were revoked; active test grants read back as zero. Controlled `audit_events.after_value` contained action/state/type codes only, no synthetic reference or filename. Existing onboarding SIA tables were not migrated or updated by the 16B SQL. Concurrent synthetic tests in the shared Dev project changed their row counts during this work, so a count comparison is not evidence of 16B preservation.

## Checks

- `node --test tests/credential-state.test.mjs`: passed; expiry is valid through the displayed London date, while a later date, reversal sequence, revocation and withdrawal remove current verification.
- `KSS_TEST_DEV=1 node --env-file=.env.local --env-file=.env.test.local --test tests/credentials.test.mjs`: passed before the final oversight hardening. It exercised normal routes for grant, draft, private request/upload, evidence acceptance, exact revision submission, Office verification, revocation and withdrawal; it also denied accepted-evidence-only verification, unrelated Office, Operations and other Staff direct access, forged external method and ordinary decision-table mutation. A later rerun of the expanded test was interrupted when concurrent Dev servers contended for the shared `.next/dev` lock. The test now fails fast if its server exits; the earlier full pass remains the route evidence.
- Direct authenticated readback after the oversight migration: Super Admin direct 16B table SELECT returned zero rows, exact Person oversight RPC returned the claim and wrote `credential_oversight / EXACT_PERSON_READ`; revoked Office, Operations and other Staff direct reads returned zero rows. Direct Staff mutation/reversal advanced the change sequence twice and left the earlier revision stale, then restored withdrawn state.
- ESLint passed on 16B source files. A source-only TypeScript check excluding concurrently generated duplicate `.next/types` passed. `npm run build` compiled the app but its TypeScript stage failed in concurrent 19A `src/app/api/operational-documents/context-status/route.ts:12:77` (`string | null` passed as `string`); that file is outside 16B ownership. No successful full production build is claimed.
- Signed-in synthetic Staff and assigned Office screens were inspected at desktop and 390px. Evidence: `output/playwright/task-16b-staff-desktop.png`, `task-16b-staff-390.png`, `task-16b-office-desktop.png`, `task-16b-office-390.png`. The Staff screen displayed historical onboarding Security Guarding separately from 16B history; the Office screen showed its exact Door Supervision review grant. These screenshots are local Dev evidence, not human acceptance.

## Boundaries and remaining gates

No real SIA verification, Training adapter, external source, operational policy, duty-interval check, allocation consequence, staging or production deployment was introduced. Evidence remains `NOT_SCANNED`; malware handling and real-data retention/deletion remain pre-live gates. TASK-20B–20E precede a separately approved 16C adapter; TASK-16D owns operational credential policy and any future shared allocation guard.
