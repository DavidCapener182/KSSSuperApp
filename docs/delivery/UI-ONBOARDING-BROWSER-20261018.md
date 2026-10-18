# U47–U49 actual-component synthetic browser checkpoint — 18 October 2026

Final source revision3 passed the local browser runner: **52 result records, 60 screenshots at 1440/834/390/320; zero page errors, zero external-origin requests**. Both loopback servers3130/3131 were terminated by the successful runner. No production release was performed by this worker.

## Source and evidence

Task-root `ui-milestone-evidence/onboarding-preview/` contains `runtime-manifests.json`, `capture-results.json`, `screenshot-hashes.json`, `verification-receipt.json` and final `browser.log`. Both runtimes have23 actual source dependencies plus three explicit synthetic Auth/Supabase boundaries, all hashes rechecked after rendering. Shared shell/global CSS/Sheet dependencies are exact published milestone67aad4c. Before source is the batch's exact seven-file baseline; after uses the four-file current `frozen-source-hashes-revision-3.json`.

Captured paired views: Office register, Office new-case form, Super new-Person form, Office selected-case Overview, Staff entry and Staff exact terms, each at all four widths. Additional after captures show Journey, Evidence and named finite-cover Sheet at each width. Before/after files are named `{before|after}-{office-register|office-new|super-new|case|staff-entry|staff-terms}-{width}.png`; additional files are `after-{journey|evidence|cover-sheet}-{width}.png`.

Review images inspected directly include Office register/case desktop; Office new form834; selected case/Evidence390; cover Sheet834. Default paired case/register images are the preferred delivery set. Evidence images preserve keyboard interaction state and may show the visible Skip to content focus affordance. Automated no-document-overflow checks passed all default after views plus Journey/Evidence at all four widths; this is not a claim of complete visual acceptance for every possible record.

## Passed interaction boundaries at every width

- Actual source route guards: Operations cannot enter the register/case; Staff cannot use new-case; an unrelated synthetic Staff principal cannot read the selected case.
- Office People register search and factual empty query result; restricted Site excluded from case-creation choices. Creation uses the exact selected existing Staff/Site and is synthetically denied, with existing failure feedback.
- Finite-cover Sheet has the correct accessible name, selected person/current owner, excludes the owner from recipients, leaves submit disabled without required selections/reason/date, and restores trigger focus after Escape. No cover or permission write was submitted.
- Case Overview excludes private profile facts. Journey starts with one first-incomplete requirement, retains all steps and supports Enter disclosure. Evidence preserves the exact Document Request/version URL and separate authorised requirement-decision controls; no evidence decision was submitted.
- Training case connection stays explicitly unavailable rather than inferring induction outcome.
- Staff exact terms link remains pinned to the selected case. Acknowledgement controls are absent before recorded access, disabled before explicit checkbox confirmation, and then use the existing acknowledgement action/readback with a synthetic in-memory response. Office verification is absent in Staff context.
- Previous cases remain available; empty and unavailable reads are exercised independently. Final unavailable assertions specifically prove there is no false “No onboarding cases” message.

Eight browser writes were all locally intercepted: four denied synthetic case creations and four synthetic terms acknowledgements. No real record, grant, cover, evidence verification, legal check, readiness decision, real document download, hosted Auth/RPC/RLS or production write was involved. Server policy/guards run against minimal synthetic case tables; richer client records are independently mocked. This does not prove hosted projection parity or persistence.

## Red/green corrections and audit trail

Initial browser failure was a real accessible-name defect: the visible Sheet's generated `aria-labelledby` referred to a missing element while its title used a custom ID. `cover-name-red-probe.json` and PNG show that exact DOM state. Revision2 explicitly binds SheetContent to the existing title ID; source red/green tests and actual four-width browser checks pass. Its earlier all-green52-record run is preserved under `revision-2-browser/`; `runtime-manifests-revision-2.json` preserves those source bytes.

The source-only unavailable test then reproduced simultaneous failed-list and empty-list claims. Revision3 only suppresses the empty branch on error; original loaded-record retention, readers and action handlers stay unchanged. `unavailable-empty-red-proof.tap` and final `revision-3-offline-results.tap` document the correction; the final browser repeats it at each width. All named functions/effects and all three server route files remain byte-identical to the original batch baseline.

One intermediate fixture selector used an exact wrapped Site label that includes dynamic option text; the fixture now selects the existing combobox by its stable label prefix. No product labelling change was needed for that selector. Failed partial runs remain under `attempt-1/` and `attempt-2/`. Original source receipts were not rewritten.

Current source details and exact62-test offline command are in `UI-ONBOARDING-20261018.md`. Use `frozen-source-hashes-revision-3.json`, `review-revision-3.patch`, `test-hashes-revision-3.json`, `accessible-name-revision-2.json` and `unavailable-revision-3.json` for integration. TypeScript and focused lint passed. Browser results are synthetic; authenticated acceptance remains separate.
