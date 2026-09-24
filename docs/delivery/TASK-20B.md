# TASK-20B — Native Training Catalogue & Course Versioning

**Status:** Accepted by David in synthetic Dev on 24 September 2026 at commit `9ccfd88`. Synthetic Dev project `dnfhkmmnlbiabqypclqg` only; protected staging `kwpgjbxepxuhwxxydaca` remains excluded. TASK-20B implementation is closed. The next Training work is the TASK-20C proposal only.

## Outcome

Course is the permanent identity. Each published CourseVersion is an immutable exact learning package. One current published version per Course is discoverable for new Staff. Publishing a later version changes only the Course current-version pointer; previous versions retain exact content, publication time, audience rule and hash. Explicit retirement clears current discovery and retains history. Draft edits use optimistic revision; abandonment is an explicit attributable transition. No hard deletion of published versions.

## Authority

KSS Office/Admin owns the first catalogue. Named active Office Admin Persons may receive separate finite `TRAINING_AUTHOR` and `TRAINING_PUBLISHER` grants from Super Admin. One synthetic Person may hold both. Office membership alone grants neither. Super Admin has attributable oversight. Operations and Security Staff cannot author, publish, retire or edit. Every guarded operation resolves the current AuthIdentity to Person and rechecks active roles and grants in the database. Direct authenticated table writes are denied.

## First audience and content

The only audience rule is `ACTIVE_SECURITY_STAFF_V1`, captured on each published version. The first catalogue is company-wide active Security Staff; Operations may see a safe read-only catalogue. No Site, Event, Client or operational-role targeting. Native content uses ordered modules, ordered pages and bounded blocks of heading, paragraph, bullet, numbered, emphasis and informational callout text. Server validation limits size and types. React renders block text without arbitrary HTML. No scripts, embed, remote media, video, uploaded course media, assessment or widget.

Controlled DocumentVersion links are excluded. A future reviewed adapter may add exact controlled-version references without changing an already published CourseVersion. Course visibility never grants document access.

## UI and fixture

Staff: native learning catalogue → Course → ordered modules/pages. Reading and page navigation record no progress or result. Training administration: Courses → versions → draft editor → preview → publish/retire → history, with named grant oversight for Super Admin. Responsive 390px rendering uses blue, graphite and neutral styling, visible focus and 44px page targets.

The fixture `KSS Enterprise — Introduction to Event & Site Security` is synthetic example content only. It is not approved KSS training, qualification, induction or compliance material.

## Preserved boundaries

TASK-11A's external Training shortcut and its unverified provider URL remain unchanged. No SSO, API sync, import, provider replacement or completion mapping. Core KSS induction stays `NOT_CONNECTED`. This task creates no assignment, enrolment, progress, attempt, score, pass/fail, completion, certificate, training matrix, onboarding fulfilment, credential verification or deployment eligibility. Historical Staff access bound to a future assignment/attempt is a 20C+ decision.

## Evidence and stop point

See `TASK-20B-REPORT.md` for actual migration/RLS/function readback, immutability, concurrent publication and retry, negative access, build/regression, and authenticated desktop/390px browser evidence. David accepted that evidence, including the recorded broad-regression limitation. No staging, production or real KSS training data is authorised.
