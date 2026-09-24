# TASK-20C — Training Assignments & Staff Learning

**Status: ACCEPTED — SYNTHETIC DEV.** David formally accepted TASK-20C on 24 September 2026. Implementation commit: `3755a7b`. The delivered evidence is in [TASK-20C-REPORT.md](TASK-20C-REPORT.md). No staging, production or live KSS Training approval is implied.

## Intended outcome

Give an active Security Staff Person an attributable assignment to one **exact published CourseVersion**, a due date and a reason. Let that Person resume the assigned package and explicitly record page-level learning position. Assignment and progress are factual learning records, not assessment, completion, qualification, induction fulfilment or deployment eligibility.

The identity chain is `Person → TrainingAssignment → CourseVersion → immutable ordered Module/Page manifest`. The Assignment has its own stable ID. A Course may publish v2 while a Person remains assigned to v1; v1 content, audience and progress remain exactly as they were. No publish, retire or catalogue action silently changes an Assignment.

## Contracts inherited from accepted 20B

- `training_courses.id` is the stable Course identity; `training_course_versions.id`, content hash, audience rule and ordered package are sealed after publication. The Course current-version pointer controls **new catalogue discovery**, not the version of an existing Assignment.
- An assigned learner's exact page can be identified by CourseVersion ID and one-based module/page ordinals. Those ordinals are stable within the immutable package and avoid rewriting existing published versions to add page IDs. Every progress write validates the ordinals against that package.
- `TRAINING_AUTHOR` and `TRAINING_PUBLISHER` remain separate from assignment authority. The external TASK-11A Training shortcut, Core KSS induction `NOT_CONNECTED`, controlled documents, credentials and staffing eligibility remain independent.

## Original bounded 20C proposal and delivered lifecycle

1. **TrainingAssignment:** stable opaque ID; exact target Person, Course, CourseVersion; assigned-by Person, assigned-at server time, explicit due date, assignment reason, current state and revision. Only one active Assignment for one Person/Course at a time. A repeat or retake after cancellation/supersession gets a new ID; history is retained. No CourseVersion is copied or modified.
2. **Initial assignment:** named authorised Office Admin selects an active Security Staff Person and the Course's **current, published, unretired** version. The guarded transaction locks/rechecks the Course pointer and Person authority so a concurrent publish either leaves a valid v1 Assignment committed first or rejects a stale v1 selection. No automatic assignment to every Staff member when a course is published. Opening the catalogue does not enrol anyone.
3. **Due date and correction:** a Europe/London calendar due date is explicit at assignment. A later due-date change needs reason, expected revision and attributable history. “Past due” is derived display text only; it is not a compliance, pay or deployment decision. No reminders or shared Tasks in this slice.
4. **Cancellation:** reasoned `CANCELLED` transition stops new progress writes. Existing Assignment, exact version and page history remain readable to authorised Training administrators and the Person. Cancellation does not erase learning activity.
5. **Supersession:** one guarded, reasoned transaction marks the old Assignment `SUPERSEDED` and creates a new Assignment pinned to the then-current CourseVersion. It does **not** copy or convert the old page markers. The old and new Assignments remain linked by an explicit supersession event. Publishing v2 never invokes this transition automatically.
6. **Learning position and page markers:** an active assigned Person can explicitly **Save my place** at a valid page and **Mark page viewed**. Save-place supports resume; page markers support a factual “X of Y pages marked viewed” display and module navigation. Both actions record actor/server time against exact Assignment, CourseVersion and module/page ordinals. Repeating the same mark is idempotent. Opening or navigating a page alone still writes nothing. These markers do not assert that content was understood or a course was completed.
7. **Historical access:** an active v1 Assignment continues to open its exact v1 package after v2 becomes current. A cancelled/superseded Assignment becomes read-only history for that Person. David approved suspending Staff page access to an explicitly **retired** version and showing “Content retired — assignment needs review” without changing the Assignment automatically; an authorised assigner must cancel or supersede it.

## Proposed authority and privacy

Introduce a separate finite `TRAINING_ASSIGNER` capability, granted/revoked by Super Admin to a named active Office Admin Person. Office membership, Author and Publisher capabilities alone do not grant assignment power. Super Admin retains attributable oversight. Operations receives no private Assignment/progress list in 20C; a future scoped operational projection needs its own decision. Staff sees only own Assignments and own exact-version learning state. A catalogue view alone does not reveal another Person's training activity.

Every action resolves AuthIdentity → Person and rechecks active role, named capability, action and record scope at the server and database. Guarded functions own writes; ordinary authenticated direct table writes remain denied. Search, counts, API JSON, guessed IDs and server-rendered HTML must follow the same bounds. Audit and event rows contain IDs, transitions, actor, time and reason, never copied course text or private personnel data.

## Staff and administrator journeys

- **Staff:** Training → My learning → assigned CourseVersion → Modules/Pages → Save my place / Mark page viewed → Resume. Show exact version, due date and factual page counts. Show an explicit statement that page markers are neither completion nor proof of understanding. The separate unassigned catalogue remains available under 20B rules.
- **Training administrator:** Training administration → Assignments → choose Person and current CourseVersion → set due date/reason → inspect exact history → change due date, cancel or explicitly supersede. Show v1 and v2 as separate Assignments when supersession occurs, including old progress and the linked reason.
- At 390px, retain single-column reading, clear current-page/resume navigation, 44px targets, visible focus, no horizontal overflow and the permanent blue/graphite/neutral no-green rule.

## Verification required if separately approved

- Literal target check for synthetic Dev `dnfhkmmnlbiabqypclqg` before each migration; staging `kwpgjbxepxuhwxxydaca` excluded. Read back exact Assignment/version, page events, due-date and supersession histories, RLS/privileges/function grants and request-key replay results.
- Prove v1 Assignment and page markers remain byte-for-byte associated with v1 after v2 publication; v2 does not auto-assign or inherit v1 progress. Test concurrent publish/assign and concurrent supersession; stale revision, duplicate active Assignment and changed-payload retry must fail without half-written history.
- Deny unauthenticated, unrelated Staff, Operations, ungranted Office, revoked assigner, wrong-version page indices, cancelled Assignment writes, and direct table/API/guessed-ID access. Prove a Staff member can reach a superseded published package only through their own still-active exact Assignment.
- Build and focused Training/20B/external-shortcut/onboarding regressions; authenticated Staff and administrator desktop/390px browser checks. Confirm no assessment, Attempt, score, Completion, certificate, matrix, onboarding result, credential verification or deployment policy is created.

## Original proposal decisions (resolved by David's approval below)

1. Confirm `TRAINING_ASSIGNER` as a separate finite grant and whether Super Admin alone may use override assignment actions, or also an active named assigner.
2. Confirm required Europe/London due date and whether due-date correction may move both earlier and later with a reason.
3. Confirm explicit Save-place plus Mark-page-viewed as the first progress actions, with no passive read tracking and no course-complete control.
4. Confirm the retirement rule: suspend access to a retired package pending explicit cancel/supersession, while superseded-but-not-retired versions remain accessible to their active assignees.
5. Confirm one active Assignment per Person/Course and manual individual assignment only in 20C; any bulk, audience-triggered or requirement-driven assignment remains later work.

**Proposal stop point:** David reviewed and approved this bounded 20C scope on 24 September 2026. 20D Assessment & Attempts, 20E Completion & Certificates, 20F Requirements & Matrix, and 20G external migration/import each remain separate future tasks.

## David's approved decisions — 24 September 2026

David approved `TRAINING_ASSIGNER` as an explicit, separately granted capability. Super Admin has grant/revocation and read-only oversight; the role alone does not perform assignment actions. An assigner must have an active named grant. Every assignment has an explicit Europe/London calendar due date; a reasoned, revision-checked correction may move it earlier or later. Learning actions are exactly **Save my place** and **Mark page viewed**. All pages marked viewed remains factual progress and creates no Completion. One active Assignment per Person and Course is allowed. Assignment, cancellation and version supersession are manual, individual and attributable. A retired exact version blocks Staff content and progress while preserving its Assignment; a merely superseded published version remains available to its active assignee. 20D and later Training work is not authorised.

## Formal acceptance and lane close-out — 24 September 2026

David accepted the exact CourseVersion-pinned Assignment, one active Person/Course constraint, individual manual assignment, separate finite `TRAINING_ASSIGNER` authority, explicit Europe/London due date and reasoned earlier/later correction, explicit Save my place and Mark page viewed, and the rule that passive navigation and even all pages viewed create no Completion or proof of understanding. Publication never migrates an Assignment. Reasoned explicit supersession creates a new Assignment with no inherited progress, while cancelled and superseded Assignments retain immutable history. Historical published versions remain tied to their exact Assignments; retirement suspends Staff content and progress access until an assigner explicitly cancels or supersedes. No publication, catalogue, onboarding or operational event automatically assigns learning.

The accepted proof is synthetic-Dev database, RLS, grant, concurrency, idempotency, lifecycle and negative-access readback; a production Webpack build; TypeScript and focused ESLint; 20B, TASK-11A external-shortcut, 03A onboarding and return-target regressions; and authenticated Staff, Office and Super Admin desktop/390px browser evidence. The complete shell test's expected-navigation mismatch is shared test drift after parallel lanes added `/management-reports` and `/operational-documents`; those routes must remain. Its expectation can be reconciled in a controlled integration/test-maintenance pass.

TASK-11A's external Training shortcut remains unchanged and Core KSS Induction remains `NOT_CONNECTED`. Acceptance excludes assessments, questions, answers, Attempts, scoring, pass/fail, Completion, certificates, Training requirements/matrix, onboarding fulfilment, credential verification, deployment eligibility, bulk or automatic assignment, reminders/notifications, external Training migration/sync, staging, production and real KSS Training data.

**Lane closed.** Maximum two active implementation threads at a time. Completion or acceptance of one task does not automatically authorise its successor. Do not begin TASK-20D without David's separate approval.
