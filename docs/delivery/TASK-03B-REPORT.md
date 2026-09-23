# TASK-03B report — Personal Details and synthetic SIA

**Status:** implemented and development verified on 23 September 2026; awaiting David's acceptance. Accepted starting point: TASK-03A at `fddc8e5`. This report covers TASK-03B only. No deployment, live data, SIA register, LMS or Phase 03 follow-on implementation.

## Delivered

- Published immutable `SECURITY_STAFF_BASE` Template V2 with the same six ordered requirements. V1 definitions and existing cases remain pinned to V1; no RTW decision is carried into a new V2 case. Readback confirms V1 Personal Details/SIA remain `NOT_CONFIGURED`, while V2 alone enables Staff profile submission and synthetic `SECURITY_GUARDING` SIA fulfilment.
- Added one current `person_profiles` record per stable `people.id`. Required fields: legal first name, surname, separate contact email, mobile, address line 1, town/city and postcode. Preferred name and address line 2 are optional. Draft saves update only the current record; each explicit, case-bound submission creates one immutable protected revision. Completion is **self-submitted**, never identity/address/email verified. A required-field edit increments a database change sequence and removes current completion until resubmission, even if the old value is later restored. Optional edits do not increment that sequence.
- Added one current synthetic SIA credential per Person/category, with immutable submitted revisions linked to exact case requirements. The pilot accepts `SECURITY_GUARDING`; Door Supervisor and CCTV are controlled future categories with no inferred equivalence. Office issues the protected evidence request only for the latest, unchanged, unexpired submitted credential. Staff submits a synthetic file through existing Documents/Storage; existing `DOCUMENT_REVIEW` Task follows review. Evidence acceptance and Task Done leave SIA unverified. A separate guarded Office/Super decision binds the exact case, Person, requirement, credential revision, request and accepted DocumentVersion.
- SIA expiry is date-only and current through the displayed Europe/London calendar day. An expired or subsequently edited credential loses current credit while immutable revision, evidence and decision remain. A value reversal cannot revive old verification; a new submission, evidence and decision are required. No SIA register or authenticity conclusion is made.
- Staff `/profile` now has a responsive Personal Details form with Save draft, explicit Submit/Resubmit, validation errors, sign-in versus contact email explanation, and synthetic SIA details. Staff My Onboarding and the scoped Office starter view show Template version, case creation time, progress, evidence separately from requirement state, blockers and next actions. Office sees submitted revision/time and current-value divergence but cannot edit Staff records. The six-item case remains `IN_PROGRESS` at 3 of 6; Identity evidence is not configured, contract acknowledgement is not available, and induction is not connected. There is no compliance or deployability score.

## Access, audit and review fixes

Server routes check active roles and exact case ownership before guarded RPCs. RLS restricts Staff to self and Office to its active owned V2 cases for current private profile/SIA records. V1 or cancelled ownership does not expose later current values. Super Admin current-profile and revision oversight uses an audited case-bound RPC; direct broad SELECT is denied. Generic audit payloads contain IDs, changed field names and synthetic markers, never full contact/address values. Ordinary clients cannot directly write revisions, verifications or audit events. SiteAssignment grants no private profile or onboarding authority.

The bounded independent Sol review found four concrete issues and all four were addressed: historical Office ownership exposing current records; required or SIA edits reversed to old values reviving completion; stale credential submissions receiving a new evidence request; and unaudited direct Super Admin private reads. The source-controlled fix migrations and extended negative tests cover them. The original case-owner rule remains temporary; team queues, delegation, reassignment, cover and cancelled-work presentation remain required later in Phase 03.

## Database inventory

Only dedicated development project `dnfhkmmnlbiabqypclqg` was changed. Seven source-controlled migrations match the remote migration-history versions:

1. `20260923042043_personal_details_sia_03b.sql`: six tables (`person_profiles`, `person_profile_revisions`, `onboarding_profile_submissions`, `person_sia_credentials`, `person_sia_credential_revisions`, `onboarding_sia_submissions`); exact SIA submission foreign key on `onboarding_requirement_verifications`; Template V2 and six definitions; six SELECT RLS policies; validation, history, audit, guarded save/submit/request/verify RPCs and cancellation-aware document guards.
2. `20260923043252_fix_03b_submission_aliases.sql`: removes a PL/pgSQL record/table alias ambiguity found by the first end-to-end submission test.
3. `20260923043554_scope_current_profile_to_active_v2_case.sql`: prevents historical V1/cancelled case ownership from reading later current private records.
4. `20260923043644_track_profile_credential_changes.sql`: required-profile and SIA change-sequence columns/triggers, captured on immutable revisions.
5. `20260923043746_guard_stale_sia_request.sql`: denies an evidence request for a changed or expired submitted credential.
6. `20260923043808_bind_sia_verification_change_sequence.sql`: guards direct SIA verification against a reverted credential edit.
7. `20260923043916_audit_super_private_profile_read.sql`: case-bound audited Super Admin read RPC and narrower private RLS.

Remote readback found all six new tables, six new RLS policies and eight new history/change triggers, with published V1 and V2 each containing six definitions. Remote migration history contains all seven versions. Supabase security advisors report two warning families: authenticated GraphQL table visibility under existing SELECT/RLS and authenticated security-definer RPC exposure. They are reviewed as guarded synthetic-development objects, not evidence of unrestricted reads. [Advisor reference](https://supabase.com/docs/guides/database/database-linter).

## Verification

| Check | Result |
|---|---|
| `npm ci` | PASS; 369 lockfile packages installed. The existing `unrs-resolver` install-script advisory remains. |
| `npm run lint` | PASS after removal of one unused test variable. |
| `npm run build` | PASS on webpack; TypeScript and all new routes compiled. |
| `npm run smoke` | PASS on localhost. |
| Full serial regression | PASS: 9 suites, including Phase 01 access/sites/shell, Phase 02 documents/review/work, accepted 03A onboarding and 03B profile/SIA. |
| 03B business/RLS test | PASS: draft versus submission history, required and optional edits, value reversal, cross-person and cross-role denial, direct-write denial, exact SIA submission/evidence, document Task separation, Office decision, V2 RTW exercised independently, 3 of 6 and an as-of London date expiry check. Expanded dual-role, reviewer role-expiry and evidence-isolation checks passed separately. |
| Database readback | PASS: V1/V2 six definitions and mechanisms, six new tables/policies and eight triggers; seven remote migration versions. |
| Browser | Synthetic Staff Profile and My Onboarding inspected at desktop and 390px; Office scoped starter inspected at desktop and 390px. Staff validation, Save draft and explicit Submit were exercised in the browser. Both onboarding views measured 390px document width at a 390px viewport. Six captures are in `output/playwright/`. |
| Independent Sol review | Four findings above; fixed in forward migrations and retested. |
| Staged secret scan | PASS: 32 staged files checked against 10 local secret values and privileged-credential patterns; zero literal matches. `git diff --cached --check` also passed. |

The first browser pass exposed many indistinguishable synthetic test cases. The case list and header now show Template V1/V2 and creation time. The first local smoke attempt could not bind localhost inside the default sandbox; the authorised localhost retry passed. No regression was hidden.

## Open gates and proposed next task

All identities, addresses, phone numbers, SIA references and files are synthetic. No real personnel, RTW or SIA material was imported. Pre-live gates remain malware scanning, retention/deletion, production secrets, backup/recovery, privacy/data protection, pilot environment and operational ownership. Production RTW/SIA rules, licence verification, role/client/site policy, controlled contracts and LMS integration need separate KSS approval. The test data has no legal, compliance or deployment meaning.

**Proposed TASK-03C for approval:** make the existing Identity evidence requirement functional through the private Document service and a separately designed Office identity-evidence decision, with a visible Staff/Office journey and no authenticity or legal identity claim. Keep contract acknowledgement and induction unavailable, and continue to track team queues/reassignment as a required later Phase 03 administration task. Do not begin 03C from this report.
