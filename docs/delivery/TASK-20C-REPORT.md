# TASK-20C delivery report — Training Assignments & Staff Learning

**Status:** Implemented for David's acceptance review in synthetic Dev on 24 September 2026. No staging, production, live KSS training data or TASK-20D work was changed.

## Delivered boundary

`TrainingAssignment` links one active Security Staff Person to one exact immutable `training_course_versions.id`, its stable Course, an explicit Europe/London calendar due date and an attributable reason. A partial unique index enforces one `ACTIVE` Assignment per Person/Course. Historical `CANCELLED` and `SUPERSEDED` rows retain their exact version, reason, due history and progress. The only learner writes are explicit **Save my place** and **Mark page viewed**. Navigation does not write. The displayed page count is factual learning progress and never a Completion.

`TRAINING_ASSIGNER` is a distinct named, effective-dated grant to an active Office Admin Person, with reasoned Super Admin grant/revocation and append-only events. Super Admin role alone cannot assign. Publisher, Author and Office membership alone cannot assign. Assignment, due-date change, cancellation and supersession use guarded, revision-checked RPCs and request keys. Exact-request replay returns the original result; changed-payload replay is denied. Course-row locking serialises publish/assign selection, and assignment-row locking plus the active uniqueness index protects supersession and duplicate assignment. No action silently switches the requested version.

Explicit retirement of a historical published version was added to the 20B retirement function so a still-active v1 Assignment can be put into review after v2 publication. Retiring a historical version leaves the Course current pointer unchanged; retiring the current version clears it. Staff content and progress RPCs deny a retired exact version while keeping Assignment and markers. A newer published version alone does not block an active older-version assignment.

The Staff area adds **Training → My Learning → exact-version reader / assignment history** beside the existing catalogue. The administrator area adds **Training administration → Assignments** for manual assignment, factual progress, due-date correction, cancellation, explicit supersession, history and Super Admin grant oversight. Office assignment controls only appear with a current assigner grant. The TASK-11A external Training shortcut remains a separate unchanged component. Core KSS Induction remains outside Training and `NOT_CONNECTED`.

## Migration, authority and database readback

The connected project readback showed literal project ID **`dnfhkmmnlbiabqypclqg`**, active/healthy in `eu-west-1`, before **each** 20C migration application. Protected staging `kwpgjbxepxuhwxxydaca` was not accessed. Supabase recorded:

| Version | Name | Applied result |
| --- | --- | --- |
| `20260924201143` | `training_assignments_20c` | Assignment/grant/progress/request tables, guarded RPCs, historical retirement extension |
| `20260924201750` | `training_assignment_guards_20c` | Append-only evidence/identity triggers, grant candidates, publication-aware history |

SQL readback found RLS enabled on all eight new `training_*` tables; `authenticated` had no direct SELECT, INSERT or UPDATE privilege on them. Direct Staff table read and Office table insert attempts returned errors. Thirteen checked public 20C functions had `anon` EXECUTE false and `authenticated` EXECUTE true, with in-function action and record checks. Trigger readback included seals for assigner grant events/grants, assignment events/identity, learning events and page markers, alongside the accepted 20B published-version seal. The two migration filenames match the Dev migration history. The local Supabase CLI was unavailable; migrations were applied with the connected migration tool after literal project-ID checks.

No assessment, attempt, completion, certificate, credential, matrix or eligibility table/function was added. SQL name readback found **zero** `training_*` completion, assessment or certificate relations. Assignment events carry IDs, reason, date and transition metadata, without copied course page content. Published CourseVersion content/hash identity stays under the accepted 20B seal.

## Focused lifecycle and negative-access proof

`node --env-file=.env.local --env-file=.env.test.local --test tests/training-20c.test.mjs` passed after the final guard migration and the expanded negative-access assertions (1/1). It exercised authenticated synthetic Super Admin, Office Admin, ungranted Office Admin, Operations, Staff A, Staff B, Staff with zero sites and anonymous sessions:

- Super Admin and Office Admin could not assign without an active named grant. Super Admin granted one with effective date and reason; grant readback was attributable; revocation immediately blocked further assignment action. Ungranted Office could not list assignments or grant candidates.
- Staff A received an exact v1 Assignment, saved place and explicitly marked one page. Opening the content and repeating a mark did not add a marker. v2 publication left Staff A on v1 with one marker. Staff B's new Assignment selected v2. A stale v1 request after publication was denied. Explicit Staff A supersession linked old v1 and new v2 Assignment, left old progress at one page and started new v2 at zero. Two concurrent supersession calls produced one winner.
- A remaining active v1 Assignment was preserved when historical v1 was retired; Staff content and progress calls for that Assignment were denied. Staff A's active v2 content remained accessible. Cancellation retained Staff B's two-of-two page markers in history and blocked later progress writes. Two-of-two markers did not create a Completion object.
- Due date moved earlier, then later, using expected revisions. Immutable history retained `2026-11-10 → 2026-10-20 → 2026-12-20` with reasons. Concurrent assignment calls for the same Person/Course produced one active winner. Parallel publish/assign either pinned the exact requested version before publication or rejected the stale request; no version switch occurred.
- Exact request replay returned one Assignment ID; replaying the key with a changed due date was denied. Other Staff, Operations, ungranted Office and anonymous users could not read another Person's assignment content/history; other Staff could not write its markers. Direct table read/write and invalid page ordinal were denied. Superseded and cancelled Assignments rejected further markers.

Synthetic proof courses and historical Assignment rows remain in Dev deliberately; they are labelled synthetic and were not promoted to approved KSS training. Browser evidence used these synthetic rows. Temporary browser and test assigner grants were explicitly revoked after verification.

## Build and regression

An isolated copy under `/tmp/kss-task-20c-preview` passed `node node_modules/next/dist/bin/next build --webpack` after the final UI changes. Compilation, TypeScript, page generation and route collection passed, including `/training/my-learning`, exact-version reader, Staff assignment history, `/training-admin/assignments` and `/api/training-learning`. Shared-tree `tsc --noEmit` and targeted ESLint for 20C source passed. The focused 20B integration test and TASK-11A external-shortcut tests passed; the 03A onboarding test passed. The shell return-target test passed. The complete shell test had one unrelated navigation expected-list failure because parallel lanes added `/management-reports` and `/operational-documents` to the shared shell while its expected array remained older. No broad shared regression suite was run while parallel approved lanes were actively changing the checkout and Dev fixture.

## Authenticated browser evidence

The isolated production server was opened through real synthetic sign-in with Playwright CLI. Screenshots:

| Persona / viewport | Observed |
| --- | --- |
| [Staff desktop](../../output/playwright/task-20c-staff-desktop.png) | Assigned v2 reader showed exact version, page count, content and two explicit progress actions. |
| [Staff 390px](../../output/playwright/task-20c-staff-390.png) | Single-column reader; document width 390px for 390px viewport; action buttons 44px. Explicit Mark page viewed updated 0/2 to 1/2 and disabled repeated mark. |
| [Staff history desktop](../../output/playwright/task-20c-staff-history-desktop.png) | A historical v1 Assignment showed the original due date, both reasoned due changes, later publication without assignment migration, and explicit supersession. |
| [Office desktop](../../output/playwright/task-20c-admin-desktop.png) | Active assigner saw individual assignment form, exact current version, Staff/version/due/progress/state list, retired warning, and reasoned due/cancel/supersede controls with history. |
| [Office 390px](../../output/playwright/task-20c-admin-390.png) | Single-column administration, 390px document and viewport widths, minimum action target 44px. |

The authenticated Super Admin browser showed read-only Assignment oversight and a finite grant form. It granted the Office Admin for the browser check; the temporary grant was revoked with an attributable reason afterward. The focused CSS uses blue, graphite and neutral values, with visible focus outline and no green styling. The Staff screenshot and computed widths showed no horizontal overflow.

## Limits and acceptance stop

20C writes no assignment from publication, catalogue reading, onboarding, operational allocation, credentials or controlled documents. It adds no reminders, bulk assignment, assessment, answer, Attempt, score, pass/fail, Completion, certificate, training matrix, onboarding fulfilment, credential verification, deployment result, provider sync or external Training replacement. A past due date is display state only. The broad shared regression suite and any staging/production deployment are outside this evidence. David's acceptance is still required; no 20D work is authorised.

All Git operations for this task used `/Library/Developer/CommandLineTools/usr/bin/git`, bypassing the macOS Xcode shim without accepting the Xcode licence or changing machine configuration. Parallel checkout changes were left untouched; the 20C commit stages only 20C-owned paths.
