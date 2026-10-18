# U04–U06 local synthetic browser checkpoint — 18 October 2026

Actual `/work`, `/work/[taskId]` and `/action-centre` pages/components rendered before and after the frozen Work/Inbox changes. Shared shell, global CSS, Sheet and dependencies come from the exact published milestone commit `67aad4c0f460cfa64371409ba15fc750d8b073df`. This deliberately holds shared presentation constant while comparing the frozen route family. No production source file or frozen source receipt was changed for these checks.

## Evidence

Task-root evidence folder: `ui-milestone-evidence/work-inbox-preview/`.

- `runtime-manifests.json`: 28 actual source dependencies and three synthetic boundaries for each stage, with SHA256 and source provenance. All hashes rechecked after rendering.
- `capture-results.json`: 40 successful records: 16 before route/view captures, 20 after route/view/dialog captures, four after interaction sets.
- `screenshot-hashes.json`: 36 final PNGs at 1440, 834, 390 and 320 pixels.
- `verification-receipt.json`: exact scripts, source/hash verification and result boundaries.
- `browser.log`: final `PASS 40 Work/Inbox capture and interaction records`; runner exit0, servers terminated.

Representative review images: `before-work-1440.png` / `after-work-1440.png`, `before-work-390.png` / `after-work-390.png`; same before/after naming for `task`, `inbox` and `calendar`. `after-task-dialog-{width}.png` captures the open native confirmation; these use full-page capture so the modal backdrop correctly covers the viewport, not the extra document below it. Prefer the nonmodal paired route images for delivery.

Inspected directly: after Work desktop/390, Task desktop/390, Inbox desktop/390, Calendar320 and Task dialog320, plus before Work390. No collision or clipped record/action was seen in those inspected images. Automated after captures established no document horizontal overflow at all four widths; this alone does not establish every content variant's visual quality.

## Actual browser checks

All four widths passed with no page errors and no external-origin requests:

- My Work source/status/search filters on the returned synthetic projection; exact returned count, clear/reset and covering document context; default list and existing deadline calendar.
- Calendar keyboard day movement with selected date and corresponding agenda heading; undated sources retain their own records.
- Work empty and unavailable states remain distinct and unavailable hides the old task list.
- CRM action native dialog opens on Cancel, Escape restores trigger focus, ambiguous London DST input disables reschedule.
- A synthetic accepted completion receipt with mismatching fresh readback gives unconfirmed feedback and hides the old actionable task. Matching synthetic completion/history becomes Done and removes reschedule.
- Actual server role guards deny Staff `/work` and `/work/[taskId]`, and deny Office-only `/action-centre`.
- Inbox ordinary notice expands with Enter. Exact Site-shift allocation link preserves `allocationId` plus `source=SITE_SHIFT`. Synthetic read and dismiss are confirmed through the component's existing exact readbacks; source allocation remains `ALLOCATED` and no allocation-response endpoint is called.
- Inbox empty/unavailable states; history context and notification actions remain separate from source work.

Only 16 browser writes occurred, all intercepted in memory: eight synthetic CRM actions and eight synthetic notification actions. Every other API response was mocked or denied; external origins were aborted. No real login, Auth/RPC/RLS validation, hosted persistence, company record access or production write occurred. No release action was performed in this lane.

## Harness corrections and limits

Initial launch stopped before browser creation because the inherited executable path omitted `.app/Contents/MacOS`; the verified installed path was used next (`launch-path-error.log`). The first interaction run then exposed test-fixture issues: broad `supplier` search also matched displayed source labels; the mocked `/api/me` role did not track the currently selected fixture role. The query now targets the exact task title and mock authority tracks the selected role. The partial run is retained under `attempt-1/`; final evidence is at the folder root. No product fix was needed.

These are synthetic actual-component/guard checks, not hosted acceptance or proof of every Work/Inbox race, pagination, mixed-role, source-retirement or historical variant. The previously documented existing Action Centre load concurrency/error-retention behavior remains unchanged. Source checkpoint remains `UI-WORK-INBOX-20261018.md`; final browser evidence is this separate report.
