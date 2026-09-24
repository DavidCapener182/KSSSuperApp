# TASK-20D delivery report — Training Assessments & Attempts

**Status: ACCEPTED — SYNTHETIC DEV.** David formally accepted TASK-20D on 24 September 2026 after reviewing the recorded evidence. Target was verified as active/healthy `dnfhkmmnlbiabqypclqg` before applying SQL. Protected Staging `kwpgjbxepxuhwxxydaca`, production and real KSS learner data were not used.

## Delivered boundary

- A separate Assessment identity attaches to an exact published, unretired CourseVersion. Draft AssessmentVersions use optimistic revision; published versions seal the ordered question/options/key snapshot and SHA-256 hash. New publication moves only the Assessment current-version pointer. Earlier Attempts and results retain their own AssessmentVersion.
- Separate named `ASSESSMENT_AUTHOR` and `ASSESSMENT_PUBLISHER` grants are limited to active Office Admin Persons; Super Admin grants/revokes and has oversight only. Existing Training Author, Publisher and Assigner powers do not confer assessment authority. One Person may hold both new grants.
- The model accepts 1–25 required plain-text single/multiple-choice questions with 2–6 options. Equal-weight exact answer/set grading uses fixed 80% pass threshold, three submitted Attempts per Assignment/AssessmentVersion and a 30-minute server-time delay after a failed submission. Integer correct/total points, percentage, factual PASSED/FAILED, grader identifier `EXACT_EQUAL_WEIGHT_V1` and the immutable submitted answer hash are stored.
- Staff explicitly Starts, Saves, resumes, Submits or Abandons. Passive assessment viewing writes no Attempt. One open Attempt per Assignment/AssessmentVersion; abandonment does not consume submitted allowance. No time limit or automatic expiry was added. New AssessmentVersion publication does not invalidate an earlier open Attempt; Assignment cancellation/supersession or exact CourseVersion/AssessmentVersion retirement blocks further answer/submission writes and appends a source-block event without deleting the Attempt.
- Submitted answers, result, exact IDs and audit events are immutable. Start, Save, Submit and Abandon have request-key replay checks; changed payloads fail. Concurrent starts serialize against the Assignment, current assessment pointer, exact source version and open Attempt; concurrent identical submissions return the one sealed result.
- Staff results expose attempt number, version, submission time, percentage, pass/fail, remaining allowance and earliest retake time when relevant. Staff question delivery excludes answer keys and item correctness. Training administrators can inspect restricted versions and minimum history for an exact Assignment ID. Operations has no assessment-result projection, search or leaderboard.
- The Staff assessment page and Office administration page use fieldsets/legends, labelled controls, visible focus, 44px targets and blue/graphite/neutral styling. They link from accepted My Learning and Training administration without changing the external TASK-11A shortcut.
- A PASSED Attempt creates no Course Completion, certificate, onboarding fulfilment, credential verification, candidate/eligibility change, Assignment state change or pay record. There is no `training_completions` table.

## Migration and security readback

The Supabase connector applied the following source-controlled migrations to **synthetic Dev only**. Its recorded remote versions were read back and filenames aligned to them:

| Version | Migration |
| --- | --- |
| `20260924221957` | `training_assessments_20d` |
| `20260924222218` | `training_assessment_choices_20d` |
| `20260924222411` | `training_assessment_retake_projection_20d` |
| `20260924222550` | `training_assessment_answer_validation_20d` |
| `20260924223436` | `training_assessment_guard_refinements_20d` |
| `20260924223814` | `training_assessment_start_lock_20d` |
| `20260924223901` | `training_assessment_algorithm_20d` |
| `20260924224338` | `training_assessment_start_source_lock_20d` |

Readback: all seven new assessment/attempt/evidence/request tables have RLS enabled and no direct authenticated SELECT or INSERT grants. All 17 public assessment RPCs have anonymous EXECUTE denied and authenticated EXECUTE granted with internal Person/role/action checks; private helpers are not callable by authenticated users. A privileged readback of recent published AssessmentVersions recalculated content hashes successfully. Synthetic cancellation appended `SOURCE_BLOCKED` with exact Attempt, actor and time; the open Attempt remained present. The browser-published synthetic v4 `0e6e33ef-e1ce-4e65-bd94-9b3ecde9ab26` was current for new attempts, and its stored hash matched recomputation. Both temporary Office assessment grants used for the final browser check were read back as revoked; final active assessment grant count was zero.

## Synthetic verification

`tests/training-20d.test.mjs` passed against literal Dev. It checked passive view creates no Attempt; exact Person/Assignment/CourseVersion/AssessmentVersion chain; concurrent Start to the same open ID; exact and changed request replays; draft save/resume; stale revision; invalid question and option IDs; another Staff and Operations denial; direct table denial; concurrent identical Submit; changed submitted payload denial; immutable result; failed immediate retake; abandonment without allowance consumption; v2 publication while v1 result remains v1; open v2 submission after v3 publication; independent version allowance; source cancellation blocking with retained open history; revoked Author denial; and Assigner-only denial of assessment history. Five-question fixtures gave **80% PASSED** and **60% FAILED**. Staff JSON contained no answer-key field. No Completion table exists.

After 20D, the serial focused regression command passed **7/7**: TASK-20B, TASK-20C, TASK-11A external shortcuts and TASK-03A onboarding. The final 20D focused test passed again after the Start source-lock and grading-boundary changes. A final `npm run build` passed compilation, TypeScript, page generation and route collection; targeted ESLint and `npx tsc --noEmit` passed. One earlier parallel `tsc` run failed because it raced a build rewriting `.next/types`; a separate run after the build passed.

## Authenticated browser evidence

The local production build was signed into with synthetic Office and Staff accounts through Playwright CLI. Staff A resumed an open exact-version Attempt, selected answers, saved them, saw the persisted selection, explicitly confirmed Submit and read back **100% PASSED** with two submitted attempts remaining. At 390px, document width equalled viewport width (390px), two question fieldsets had legends, and all measured Staff answer/action controls were 44px high. The browser HTML check found no answer-key field and the checked UI had no green status styling. Screenshots: [Staff desktop](../../output/playwright/task-20d-staff-desktop.png), [Staff 390px](../../output/playwright/task-20d-staff-390.png).

Office administration was inspected at desktop and genuine 390px; the 390px document width was 390px, and visible action targets measured at least 44px. The restricted published-version preview showed keys only to the granted Office administrator. Through the UI, the administrator created a replacement synthetic v4 draft, selected keyed answers, published it and read back sealed Published state and restricted preview. Screenshots: [Office desktop](../../output/playwright/task-20d-admin-desktop.png), [Office 390px](../../output/playwright/task-20d-admin-390.png), [published preview 390px](../../output/playwright/task-20d-admin-published-390.png). The later exact-Assignment administrative history field was build/type/lint checked but not separately exercised in the browser.

## Limits and stop

The test proved that an immediate retake after failure is blocked and the 30-minute earliest time is derived from the server submission timestamp. It did not wait 30 real minutes to exercise the later successful retake, nor accrue three submitted Attempts on one version through real intervals. The targeted browser check did not separately capture a Super Admin grant UI or screen-reader announcement. No broad shared regression suite, staging or production deployment was run while other approved lanes were changing the checkout.

The synthetic courses, Assignments, assessment versions and Attempt rows created for verification remain in Dev as labelled historical proof; temporary capability grants were revoked. Other lanes' dirty files and shared `STATUS.md`/`DECISIONS.md` were preserved.

## David's formal acceptance and close-out — 24 September 2026

David accepted the TASK-20D implementation and evidence in **synthetic Dev only**. The accepted boundary is factual assessment/Attempt results: `page viewed ≠ assessment attempted ≠ assessment passed ≠ course completed ≠ certificate issued ≠ credential verified ≠ deployment eligible`. A PASSED Attempt does not change the Training Assignment, create Completion or a certificate, satisfy onboarding, verify a credential, alter Event/Site Shift eligibility or candidate/allocation policy, or create pay/payroll state.

The TASK-20D lane is closed. This acceptance authorises no staging, production, real KSS learner data or external Training integration. **STOP after this acceptance commit. Do not begin TASK-20E automatically.**
