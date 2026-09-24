# TASK-20C — Training Assignments & Staff Learning proposal

**Status:** Proposal for David's review, 24 September 2026. TASK-20B was accepted in synthetic Dev at `9ccfd88`. This document authorises no implementation, migration, seed, provider connection, staging or production change.

## Intended outcome

Give an active Security Staff Person an attributable assignment to one **exact published CourseVersion**, a due date and a reason. Let that Person resume the assigned package and explicitly record page-level learning position. Assignment and progress are factual learning records, not assessment, completion, qualification, induction fulfilment or deployment eligibility.

The identity chain is `Person → TrainingAssignment → CourseVersion → immutable ordered Module/Page manifest`. The Assignment has its own stable ID. A Course may publish v2 while a Person remains assigned to v1; v1 content, audience and progress remain exactly as they were. No publish, retire or catalogue action silently changes an Assignment.

## Contracts inherited from accepted 20B

- `training_courses.id` is the stable Course identity; `training_course_versions.id`, content hash, audience rule and ordered package are sealed after publication. The Course current-version pointer controls **new catalogue discovery**, not the version of an existing Assignment.
- An assigned learner's exact page can be identified by CourseVersion ID and one-based module/page ordinals. Those ordinals are stable within the immutable package and avoid rewriting existing published versions to add page IDs. Every progress write validates the ordinals against that package.
- `TRAINING_AUTHOR` and `TRAINING_PUBLISHER` remain separate from assignment authority. The external TASK-11A Training shortcut, Core KSS induction `NOT_CONNECTED`, controlled documents, credentials and staffing eligibility remain independent.

## Proposed bounded 20C data and lifecycle

1. **TrainingAssignment:** stable opaque ID; exact target Person, Course, CourseVersion; assigned-by Person, assigned-at server time, explicit due date, assignment reason, current state and revision. Only one active Assignment for one Person/Course at a time. A repeat or retake after cancellation/supersession gets a new ID; history is retained. No CourseVersion is copied or modified.
2. **Initial assignment:** named authorised Office Admin selects an active Security Staff Person and the Course's **current, published, unretired** version. The guarded transaction locks/rechecks the Course pointer and Person authority so a concurrent publish either leaves a valid v1 Assignment committed first or rejects a stale v1 selection. No automatic assignment to every Staff member when a course is published. Opening the catalogue does not enrol anyone.
3. **Due date and correction:** a Europe/London calendar due date is explicit at assignment. A later due-date change needs reason, expected revision and attributable history. “Past due” is derived display text only; it is not a compliance, pay or deployment decision. No reminders or shared Tasks in this slice.
4. **Cancellation:** reasoned `CANCELLED` transition stops new progress writes. Existing Assignment, exact version and page history remain readable to authorised Training administrators and the Person. Cancellation does not erase learning activity.
5. **Supersession:** one guarded, reasoned transaction marks the old Assignment `SUPERSEDED` and creates a new Assignment pinned to the then-current CourseVersion. It does **not** copy or convert the old page markers. The old and new Assignments remain linked by an explicit supersession event. Publishing v2 never invokes this transition automatically.
6. **Learning position and page markers:** an active assigned Person can explicitly **Save my place** at a valid page and **Mark page viewed**. Save-place supports resume; page markers support a factual “X of Y pages marked viewed” display and module navigation. Both actions record actor/server time against exact Assignment, CourseVersion and module/page ordinals. Repeating the same mark is idempotent. Opening or navigating a page alone still writes nothing. These markers do not assert that content was understood or a course was completed.
7. **Historical access:** an active v1 Assignment continues to open its exact v1 package after v2 becomes current. A cancelled/superseded Assignment becomes read-only history for that Person. Proposed safety default for an explicitly **retired** version is to suspend Staff page access and show “content retired—assignment needs review” without changing the Assignment automatically; an authorised assigner must cancel or supersede it. This retirement rule needs David's decision before implementation.

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

## Decisions requested before implementation

1. Confirm `TRAINING_ASSIGNER` as a separate finite grant and whether Super Admin alone may use override assignment actions, or also an active named assigner.
2. Confirm required Europe/London due date and whether due-date correction may move both earlier and later with a reason.
3. Confirm explicit Save-place plus Mark-page-viewed as the first progress actions, with no passive read tracking and no course-complete control.
4. Confirm the retirement rule: suspend access to a retired package pending explicit cancel/supersession, while superseded-but-not-retired versions remain accessible to their active assignees.
5. Confirm one active Assignment per Person/Course and manual individual assignment only in 20C; any bulk, audience-triggered or requirement-driven assignment remains later work.

**Stop point:** David reviews this proposal. Do not implement TASK-20C until he approves its bounded scope and decisions. 20D Assessment & Attempts, 20E Completion & Certificates, 20F Requirements & Matrix, and 20G external migration/import each remain separate future tasks.
