# UI overhaul — milestone 3

Onboarding now leads with the current case, next actions and source-backed journey; Office queues and case actions use focused views and panels. Documents separates request registers, exact-version evidence and permitted decisions. Controlled operational reading groups exact versions by context, while catalogue/assignment views keep finite Publisher and Assigner responsibilities separate.

This milestone covers U31–U33 and U47–U49, based on published `2e03e030638e0be8ef9a763cd69c3df8eea4ac0d`. It continues David's authorised full overhaul and normal tested milestone pushes to existing main. Eight product files change; all 402 non-owned published source files remain exact, including APIs, principal/capability rules, navigation and shared components. No SQL, dependency, configuration, credential or permission changes are included.

## Behaviour and provenance

Browser-proven local fixes bind the Onboarding action Sheet to its actual visible title, suppress a false empty Staff case list after a failed read, and put denied document-creation feedback inside the open form. Existing Onboarding and document request/review handlers remain exact.

Controlled reading also includes the already-planned client acknowledgement guard: success requires an acknowledgement receipt and a current independent readback matching the exact assignment/document/version, without conflict and with a valid acknowledgement timestamp. Uncertain outcomes clear confirmation and require a fresh read; no automatic write retry occurs. This functional prerequisite was present in the frozen pre-UI component but was absent from the older published component, and is explicitly recorded in the product manifest. The published API already returns acknowledgementId and remains unchanged. Negative/positive actual-source local tests cover missing receipts, stale or mismatched versions/documents, revoked/conflicting records, invalid timestamps and exact successful readback.

## Verification

- 209 explicit local checks passed, zero failed/skipped, with the local network guard.
- Webpack production build, full source lint, standalone TypeScript and diff whitespace checks passed with synthetic build configuration.
- Onboarding: 52 records / 60 screenshots at 1440/834/390/320; exact source/role/terms/evidence boundaries, failed-state feedback, Sheet naming and keyboard focus passed.
- Documents requests/evidence: 36 records / 32 screenshots at the same widths; exact historical/current versions, Staff restrictions, denied exact create/review payloads, retained drafts, error accessibility and focus return passed.
- Controlled operational documents: 52 records / 48 screenshots; independent finite rights, role denials, reader search/status/history/conflict boundaries, exact context status and denied acknowledgement/create handling passed.
- All 23 Onboarding, 14 Documents and 14 Operational Documents runtime source entries match the candidate. 402 non-owned source hashes and all 51 original dirty-checkout hashes/status/HEAD are unchanged.

Browser data and identities were explicitly synthetic. All operational/document writes were intercepted and denied; Onboarding used four denied creations and four in-memory terms acknowledgements. No real writes or external browser requests occurred. These checks establish representative local behaviour, not hosted Auth/RPC/RLS, durable file access, whole-route variant or human acceptance. The remaining route families stay local pending their own verification. Git push/deployment outcomes are recorded separately after publication.

## Reviewed images

- [Onboarding desktop before](https://chatgpt.com/api/library/files/libfile_dddd592a9b3c819187ed98a5e0690752/download) / [after](https://chatgpt.com/api/library/files/libfile_f8ef32c7acd48191b947f9122c664c88/download).
- [Onboarding phone before](https://chatgpt.com/api/library/files/libfile_2ed7ad4c0fe08191837a6ab376cd8a5b/download) / [after](https://chatgpt.com/api/library/files/libfile_45fda78bea8c8191b5ec0bbb015f0eb8/download).
- [Documents desktop before](https://chatgpt.com/api/library/files/libfile_b12f973b0ee48191b345f25dcd14c46e/download) / [after](https://chatgpt.com/api/library/files/libfile_bdde4094e8b881918d5265609e785edd/download).
- [Documents phone before](https://chatgpt.com/api/library/files/libfile_e30f128f23fc81919e7df4b47177bbed/download) / [after](https://chatgpt.com/api/library/files/libfile_a164eae948f481918224b716ca06842d/download).
