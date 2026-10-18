# Training administration U69–U72 browser acceptance

Final result: 60 actual-source browser records and 56 screenshots pass at widths 1440, 834, 390 and 320. Both before and after use published 3c8ba25 shared shell, globals, primitives and workflow dialogs. Before uses immutable pre-overhaul administration source; after uses the frozen revision-2 family plus the separately receipted certificate current-access revision 3. No global, API, schema, grant policy or other product family changed.

## Evidence

Task-root directory: ui-milestone-evidence/training-administration-preview/. runtime-manifests.json identifies exact copied source and three synthetic identity/server/browser boundaries per runtime. evidence-hashes.json verifies all 48 source/boundary copies and all 56 final screenshots. capture-results.json and browser.log record final exit 0 with zero page errors and zero external requests. External origins abort. 44 in-memory mock actions exercised existing endpoints, and zero real writes occurred. Both preview servers on ports 3130/3131 stopped after the runner exited.

Paired views at each width: selected course draft, selected assignment, assessment draft, selected completion/certificate evidence, publisher-only course view, Super-only assigner oversight, and Super-only completion oversight. Images explicitly label synthetic records and mock authentication/RPC boundaries. Visual review inspected course desktop 1440 and phone 390, assessment 390, completion evidence 1440, final assignment 320, and before-course 390. No observed horizontal page overflow or panel/footer overlay in the final reviewed images. This is not a universal contrast or accessibility claim.

## Exercised flows

Course editing initialises from the exact returned draft and focuses one page using keyboard outline selection. Publication stages the saved version/revision, cancels with Escape and returns focus, then sends the exact staged payload only on confirmation. Accepted save plus denied readback shows no success. Published content has no editable draft controls.

Assignments select the exact learner/version/revision and load attributable history. Due change submits that exact assignment/revision and reports denied readback. Manual assignment uses one returned Staff Person and the supplied current published version; no bulk assignment was added.

Assessment authoring focuses one question, keeps keyed answers inside restricted author preview, stages saved version/revision for publication and requires confirmation. Exact Assignment attempt history remains separate. Published assessment content is sealed. Named author/publisher and Super oversight do not acquire each other’s authoring rights through the UI.

Completion review remains necessary before evaluation. Exact rule/course/assessment IDs and evidence retain their distinctions. Controlled void stages the exact completion and reason and can be cancelled. Certificate revocation uses its separate dialog with Escape/focus return. Revoked issues lose the private-PDF link; reissue receipt with mismatched history is unconfirmed, then matching history confirms a new immutable issue. Completion void invalidates current access while preserving history. A publisher can send the existing exact completion-rule payload without manager review controls. Super-only oversight exposes grant administration without assignment, completion or certificate-issue actions. No grant operation was submitted.

## Bounded correction and verification limits

A separate actual-source regression proved that a newly voided completion could still expose cached current certificate PDF/revoke controls and its staged revocation. Two presentation/confirmation conditions were corrected in training-certificate-admin.tsx; history/effect/submit/readback functions and API payloads remain byte-identical. See UI-TRAINING-CERTIFICATE-ACCESS-20261018.md and output/ui-training-administration-20261018/certificate-access-revision-3/ for immutable before bytes, red/green proofs, old/new hashes and review patch. Earlier manifests remain unchanged.

Exact offline command: node --test tests/training-certificate-current-access-local.test.mjs tests/ui-training-administration-local.test.mjs tests/ui-training-requirements-local.test.mjs tests/training-admin-readback-local.test.mjs tests/training-requirement-evidence-local.test.mjs tests/ui-training-learners-local.test.mjs. Result: 95 passed, 0 failed/skipped. TypeScript and focused ESLint pass. Current source hashes and test hash are frozen in the revision-3 directory.

The browser does not prove real authentication, finite database grants, RPC/RLS, persisted learning decisions, private PDF content or hosted publication. Template publication, fresh initial certificate issue, assessment retirement and grant mutations were not activated in this browser run; relevant source tests cover some such branches. These remaining cases are not inferred from screenshots. Full 77-route acceptance remains separate.

Initial attempts 1/2 preserve fixture-only exact-label failures against a populated wrapped textarea; no product fault was inferred. The successful revision-2 run and the first revision-3 run remain in separate directories. Final captures explicitly wait for assignment/certificate history and settled layout after an earlier capture caught a changing page height. Final evidence-hashes.json covers only the current 56 screenshots, excluding the retained failure.png.

Suggested delivery pairs: before/after-courses-1440.png and 390.png; before/after-assessments-390.png; before/after-assignments-320.png; before/after-completions-1440.png. Coordinator owns delivery and integration/publication.
