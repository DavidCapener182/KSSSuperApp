# TFS source-backed workspace import — 27 September 2026

## Source and identity

- The saved local TFS board was exported as JSON on 27 September 2026. SHA-256: `3b99910b72c0d260aa91944f182c437b5553197620725def43aae15f7997caca`.
- The 27 exported issue IDs were unique and matched the local board source; no manual edits or extra saved cards were present in that export. The export is not committed to this repository.
- Imported into one Client workspace for The Fragrance Shop, slug `tfs`, ID `4d2bac99-360e-40a5-b8aa-dcafac2c44ce`. All 27 original issue IDs are held as stable source keys with import history and export checksum. A guarded transaction and readback confirmed 27 issues and 27 distinct source keys.
- The export reflects earlier Outlook-derived review, but its individual source claims and attachments have not all been independently checked. Do not present the import as a completed six-month Outlook reconciliation.

## Access and live workflow

- Super Admin has server-enforced VIEW across active Client workspaces. Mutation still requires an exact workspace grant.
- At David's explicit request, David Capener's KSS Person has an exact OPERATE grant for this TFS workspace. The grant and reason were read back. The scheduled review uses David's logged-in account; there is no independent agent identity.
- The deployed app accepted a new, closed historical Lewisham issue through its issue form and read back revision 1 with David's attribution. Its source notes cite the 28 March red and 1 June green Outlook messages. The missing-lines attachment was not reviewed.
- The daily 08:00 TFS review checks new Outlook mail since its last verified run, reconciles source keys, preserves edits, and writes only through the authorised app. The six-month lookback is a separate one-time historical import, still in progress. A scheduled future run is not evidence that the historical import is complete.
- Later board exports use the stable source key independently of the export checksum, so the same source card cannot be inserted twice under a newer file hash. Further mail review is additive: preserve current cards and manual edits, update the relevant existing issue for a later outcome at the same store, and keep separate issues at that store distinct. Older mail supplies context and does not itself justify a visit request.

## Remaining evidence

- The TFSLossPrevention Outlook group has thousands of messages. The six-month review is in progress; only sampled sequences have been checked directly in Outlook so far.
- The 27 original cards remain source-backed provisional records pending full mail, attachment, store-mapping, and later-outcome reconciliation. The local `RECONCILIATION-REVIEW.md` holds the detailed private gaps and conflicts.
- A 21 May red Chester stocktake had an August green follow-up; the missing-lines attachment was not reviewed. This should not be reported as an open theft allegation.
