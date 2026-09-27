# PRODUCT-08 bounded implementation report

Date: 27 September 2026
Branch: `doc-01-document-handoff`
Base: `1bafa6464f3ae549b8c3b5c1f4ce7b70cf24bc31` (`origin/main` when the isolated worktree was created)
Environment checked: synthetic Development only (`dnfhkmmnlbiabqypclqg`)

## Implemented in source

- DOC-01: `/operational-documents` is an exact safe local post-login return target. Mobilisation `DOCUMENT_VERSION` links resolve the exact linked personnel `document_versions` row to its guarded personnel request, with the version in the destination URL. The accepted Mobilisation contract is personnel evidence; it is not treated as a 19A operational document. Unknown or restricted links do not resolve.
- DOC-03: Site, Site Service and Event entry points show an exact-context operational document status card. Operations uses the guarded 19A context-status read. An Assigner uses the guarded manager list and per-assignment status reads. The card returns titles, version, required flag, counts and as-of time. It returns no file key, document bytes or recipient identities; PDF access remains a separate guarded action.
- DOC-04: assignment and Operations status flows use named, grant-checked document/version and context choices with minimum two-character search and bounded pages. The assignment form calls a proposed count-only preview, shows zero recipients as a valid factual state, flags an existing exact-target assignment, and requires a matching preview less than 60 seconds old before submitting through the existing 19A assignment route. The existing guarded write remains authoritative.

## Deliberately unresolved

- DOC-02 exact duty entry is not implemented. `operational_document_my_list` is Person-scoped and does not prove applicability to one allocation. A server-side allocation-to-current-19A-applicability read contract and self-only negative tests are still required before adding a Today's Duty tile.
- `20260927172000_product_08_document_preview.sql` is source-controlled but **not applied** to synthetic Development. The coordinator required the exact file/hash/target before an apply. Cross-task handoff through the app was rejected by automatic approval review, so the prerequisite was not met. The preview route consequently returns a guarded unavailable/conflict response until this migration is coordinated and applied.
- No real operational documents, production/staging deployment, SharePoint integration, or governance decision is included. DOC-GOV-01 remains required before real-document rollout.

## Verification

- Next.js production build and TypeScript passed on Next 16.3.6 after the choice-query change. Focused ESLint and `git diff --check` passed before the final role-context correction; repeat at integration.
- Focused shell return-target test passed, including the operational-documents route and query target. The full shell test was avoided because it writes synthetic role assignments.
- Authenticated synthetic API readback: Super Admin and Operations received allowed named Site choices and exact Site context-card responses; ungranted Office and Staff received 403 for those reads; anonymous choices received 401. A forged Mobilisation link returned 404 for all tested personas. No assignment or document write was submitted.
- Authenticated 390px browser readback showed the named published-version picker, assignment preview action and exact Site status card, with no horizontal overflow (`scrollWidth=390`). Named version and Site searches returned choices. The form was not submitted; the preview SQL has not been applied.

The checks above establish local source and read-path behaviour only. They do not establish that the preview RPC works in Development, that the exact duty contract exists, or that this work is accepted for deployment.
