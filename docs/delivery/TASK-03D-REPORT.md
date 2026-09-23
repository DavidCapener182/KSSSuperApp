# TASK-03D delivery report — synthetic Identity Evidence

**Status:** implemented and development verified on 23 September 2026; awaiting David's acceptance. Scope is the dedicated `KSS Enterprise - Dev` Supabase project (`dnfhkmmnlbiabqypclqg`) and synthetic Staff A Template V2 onboarding case only. No deployment or live data.

## Delivered

- One source-controlled additive migration: `supabase/migrations/20260923061212_identity_evidence_03d.sql`. Remote migration history confirms version `20260923061212`, `identity_evidence_03d`.
- Narrowly extended `private.guard_onboarding_requirement()` for a single V2 `IDENTITY_EVIDENCE` one-time request link. The link cannot be changed after assignment. Request, case, Person, Office requester, Site context, title and post-start creation are checked. RTW behaviour remains available.
- Narrowly extended `private.guard_onboarding_verification()` for Identity Evidence. Existing RTW and SIA branches, including the SIA credential change-sequence protection, remain. Identity verification rejects synthetic validity/expiry and SIA submission values.
- Added authenticated guarded operations `issue_onboarding_identity_request(uuid)` and `verify_onboarding_identity(uuid,uuid,uuid)`. The first is Office-owner-only, transactional and idempotent for an existing valid link. The second enforces active Office owner or Super Admin authority, denies self-verification, and binds the latest submitted, exact accepted `DocumentVersion` to an immutable `onboarding_requirement_verifications` row. Server routes independently check case and action scope.
- Reused `DocumentRequest`, immutable `DocumentVersion`, private personnel Storage, `DocumentReview`, `DOCUMENT_REVIEW` Tasks, existing requirement verification and `audit_events`. No new table, bucket, Storage policy, Task type, identity subsystem or general provider override.
- Staff and Office onboarding cards now show request, submission/review, rejection/action-required, accepted evidence awaiting separate verification, and a final **Verified — synthetic workflow** state. The UI states that identity was not authenticated. Office gets distinct issue-request and verify-requirement actions.
- Added a one-page synthetic PDF fixture with the prominent text “Synthetic development identity evidence — not a real identity document.” It contains no personal data or official-document imitation. The file remains `NOT_SCANNED` under the existing service.

## Exact development readback

The existing Staff A V2 case `3d3f1499-6163-4c9b-9adb-11972cedc985` remains `IN_PROGRESS` with **5 of 6** currently complete. Published V2 `IDENTITY_EVIDENCE` still has `fulfilment_kind = NOT_CONFIGURED` and `provider_state = NOT_CONFIGURED`; the case-specific requirement `64dda219-20c5-46db-8b08-751dc047c0f4` links request `aa0d683d-2c79-42e6-a9b6-6d3755672426`. Office A created it at `2026-09-23 06:21:24 UTC` for Staff A.

Browser-submitted evidence version `6bb0e60b-69b4-4e95-9b65-76b44fb9e6fb` is Version 1 of that request and has an `ACCEPTED_AS_EVIDENCE` review. Its existing document-review Task is `DONE`. The separate verification business row `0ea1b46a-62dc-437d-ba4f-ec20151a75a2` identifies Office A as verifier, binds exactly that evidence version, and has `synthetic_valid_until = NULL`. The audit readback separately shows an attributable request-link update and verification insert with case/requirement/request/version IDs and no file contents. Before the separate verification, the same Office browser showed **4 of 6** and “Office verification needed” after evidence acceptance and Task completion.

Core KSS induction remains **Training provider not connected**, with no manual completion, LMS record, 6-of-6 outcome, compliance or deployability claim. The existing V2 Terms acknowledgement and Template V2 definition were not rewritten. A synthetic fixture's Personal Details and SIA current state had been changed by accepted regression suites; these were restored to the existing case's 4-of-6 baseline through the normal Staff and Office application routes before the browser Identity proof, including a new synthetic SIA evidence/review/verification lifecycle. No direct database repair was used.

## Checks actually run

| Check | Result |
|---|---|
| `npm ci` | Passed; 369 packages. Existing optional install-script and ESLint deprecation warnings only. |
| `npm run lint` | Passed. |
| `npm run build` | Passed with webpack. |
| `npm run smoke` | Passed with localhost-bind permission. An unprivileged final rerun first hit sandbox `listen EPERM` before the test assertion; the permitted rerun passed 1/1. |
| `npm run test:identity` | Passed 1/1 (rerun after adding the active-role expiry check). Covered Office-only idempotent request, case link, rejected Version 1/replacement Version 2, exact review and Task states, separate verification, dual-role Staff self-denial, Staff B/Office B/Operations isolation, direct verification/audit table denial, direct private Storage byte denial, Office role expiry, cancellation, and no Identity expiry. |
| Full existing Phase 01/02/03A/03B/03C regression command | 9/10 suites passed. The 02A documents suite stopped before assertions on a transient synthetic Auth `fetch failed` during parallel sign-in. |
| `npm run test:documents` rerun alone | Passed 1/1, resolving the only failed suite. |
| Bounded GPT-6 Sol review | Completed read-only review of requirement-link and verification guards. No concrete finding. Static review, with live checks above. |
| Remote migration/object readback | Confirmed applied migration, exact V2 definition, linked request, review, completed Task, immutable verification and audit rows. |

The focused test additionally used direct authenticated RPC/table/Storage calls rather than relying only on hidden buttons. The full regression run's transient sign-in means the 10-suite aggregate was not one wholly green invocation; its sole failed suite passed on isolated rerun. A browser proof was performed separately on the existing case, not just on the test-created case. The test-created synthetic case was cancelled after its checks.

## Browser demonstration

In the actual Staff A V2 case, Office issued the protected request, Staff uploaded the synthetic PDF in Documents, Office reviewed its exact version through the existing document review screen, and Office then recorded the separate requirement verification from Onboarding. The visible count stayed **4 of 6** after upload and evidence acceptance and advanced to **5 of 6** only after verification. Staff and Office both displayed the 5-of-6 result and the unconnected induction requirement.

Screenshots of the case detail at desktop and 390px:

- [Office desktop](../../output/playwright/task-03d-office-desktop.png) and [Office 390px](../../output/playwright/task-03d-office-390.png)
- [Staff desktop](../../output/playwright/task-03d-staff-desktop.png) and [Staff 390px](../../output/playwright/task-03d-staff-390.png)

At 390px, `document.documentElement.scrollWidth` was 390 for both Staff and Office. The screenshots were inspected; the requirement cards, exact states, progress and blockers remain legible. The Office and Staff screenshots contain synthetic data only.

## Security and live-data boundary

The result is a synthetic workflow verification, not legal identity establishment, passport/issuer validation, RTW clearance, screening, compliance or deployment eligibility. No real identity material was used. Malware scanning, retention/deletion, privacy, production secrets, backup/recovery, pilot environment and operational ownership remain pre-live gates. Existing Office case-owner authority remains temporary; team queues, cover, delegation, reassignment and cancelled-work presentation remain required. No Entra, SharePoint, SIA register, training, Vercel or production integration was connected.

## Proposed TASK-03E for separate approval

The actual training provider and usable interface are not identified in the project material or connected environment. Do not invent an LMS or synthetic induction completion. Propose a bounded **Office onboarding team queue, delegation, cover/reassignment and cancelled-work presentation** task next, retaining exact case/Person scope and audit. If David supplies the actual training provider and usable interface, prepare a Training integration proposal instead. Neither direction is authorised by this report.
