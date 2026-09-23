# TASK-03A report — first synthetic onboarding case

**Status:** implemented and development verified on 23 September 2026; awaiting David's acceptance. Phase 02 accepted baseline: `b08b142`. Scope: TASK-03A only. No Phase 03 follow-on work was started.

## Delivered

- Published synthetic `SECURITY_STAFF_BASE` Template V1 with six immutable requirement definitions. Every case references stable `people.id`, an exact template version, an original Office owner and optional synthetic Site context; multiple cases per Person are allowed. The development Site is **Synthetic Static Security Site**.
- Only Right to Work has a fulfilment path: Office starts a case and issues a private DocumentRequest, Staff submits an exact DocumentVersion, Office accepts it as evidence through the existing review and `DOCUMENT_REVIEW` Task flow, then the authorised Office owner separately records an immutable requirement verification. The other five requirements cannot be marked complete. Personal details, SIA and identity are not configured; contract is not available; induction provider is not connected.
- Staff My Onboarding and scoped Office onboarding screens show the six states, next actor/action, evidence separately from verification, exact protected document navigation, and `N of 6` progress. All pages label RTW as a **synthetic workflow proof**; no statutory check, compliance or deployability claim is made.
- Server permission checks and RLS scope Staff to self, Office to cases they originally own while their role is active, and Super Admin to audited oversight. Operations and another Office do not gain access through Site membership. Case actions are guarded database functions; ordinary authenticated clients have SELECT-only table grants.
- Cancellation preserves history and blocks case actions, new linked uploads and further reviews of already submitted linked evidence. Synthetic verification validity expiry removes current completion credit but retains its immutable decision.

## Database changes and object inventory

All changes target only dedicated development project `dnfhkmmnlbiabqypclqg` and are in three source-controlled migrations, renamed to match the actual remote migration-history versions:

1. `20260923010729_onboarding_case_03a.sql`: six tables (`onboarding_templates`, `onboarding_template_versions`, `onboarding_requirement_definitions`, `onboarding_cases`, `onboarding_case_requirements`, `onboarding_requirement_verifications`), primary/foreign/unique/check constraints and supporting indexes; six RLS SELECT policies; private scope and immutability triggers/functions; guarded `create_onboarding_case`, `start_onboarding_case`, `issue_onboarding_rtw_request`, `verify_onboarding_rtw`, `cancel_onboarding_case` RPCs; additive audit entity checks; synthetic published Template V1 and its six definitions.
2. `20260923011708_stop_cancelled_onboarding_upload_03a.sql`: replaces `private.document_can_submit_request` so linked cancelled cases cannot initiate or finalise a document upload. Standalone document requests retain their original rules.
3. `20260923011923_guard_onboarding_history_03a.sql`: adds a linked-cancellation review guard to `document_reviews`, and closes a privileged draft-definition move into a published template version found in independent review.

Remote migration list readback includes all three versions. Database readback found all six onboarding tables with RLS enabled, the five guarded RPCs plus the private guards present as security-definer functions, one published Template V1, and no persistent V2. The development project contains synthetic test cases and decisions produced by the checks; these are not live KSS records.

## Verification evidence

| Check | Result |
|---|---|
| `npm ci` | PASS; 369 packages installed from lockfile. Existing package-manager advisory about `unrs-resolver` install script was printed. |
| `npm run lint` | PASS. |
| `npm run build` | PASS on webpack; new `/onboarding`, `/onboarding/[id]` and guarded API routes built. |
| `npm run smoke` | PASS. |
| `npm run test:onboarding` | PASS. Synthetic Office/Staff path, exact evidence and Task separation, Staff B/Office B/Operations and direct-table denial, role expiry, self-verification with second role, idempotency, cancellation upload/review denial, synthetic validity expiry/history. |
| Template version probe | PASS. Transaction-rolled-back published V2 with six definitions left existing V1 cases pinned to V1 and six instances; updates to V1, inserts into published V2, and moving a draft definition into published V1 were rejected. No V2 persisted. |
| Phase 01/02 regressions | PASS: `test:access`, `test:sites`, `test:shell`, `test:documents`, `test:document-review`, `test:work`. |
| Browser | Office created and started a synthetic Staff A case, issued RTW request; Staff A saw six requirements and `0 of 6`, opened the protected request, submitted a synthetic PDF, and saw exact Version 1 awaiting review. Office and Staff views were inspected at desktop and 390px; 390px DOM width and scroll width both measured 390px. Automated test completed the evidence review → Task Done → separate verification → `1 of 6` sequence. |
| Independent Sol review | Two concrete findings: cancelled cases could still review already submitted evidence; a draft definition could be moved into a published version through privileged update. Both fixed in migration 3 and covered by cancellation/template probes. |
| Staged secret scan / diff integrity | Source scan found only test environment variable references, with no literal credentials. Final staged scan and `git diff --check` completed before commit. |

The first Phase 01 access regression initially failed because it assumed Staff A and B could each see exactly one Site. The approved synthetic pilot correctly adds a second authorised Site. The test was narrowed to assert the original allowed and denied Site boundaries; the rerun passed. This was a stale fixture expectation, not a widened RLS result.

## Remaining boundaries and proposed next task

- This is synthetic development workflow verification, not a legally compliant UK Right to Work check. No real passports, RTW files, SIA cards, contracts, personal HR details or live staff were imported. `NOT_SCANNED` files stay under the Phase 02 pre-live gates: malware scanning, retention/deletion, production secrets, backup/recovery, privacy/data protection, pilot environment and operational owner.
- No LMS, SIA register, controlled acknowledgement/e-signature, Microsoft Entra, SharePoint, MagSecure, PARiM, Finance or Vercel/production connection was made.
- Original Office ownership is deliberately temporary. A cancelled case with a pre-existing open document-review Task retains that Task row for history, although the linked review action is denied; a later approved Task lifecycle/queue design should address cancelled work presentation.
- **Proposed TASK-03B for separate approval:** design and implement scoped onboarding team queues, cover/reassignment and cancelled-work handling before extending additional requirement fulfilment. Define business ownership and access review first. Do not begin 03B from this report.
