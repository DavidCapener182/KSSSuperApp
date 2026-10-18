# UI overhaul — milestone 2

People now separates existing staff, ongoing onboarding and draft starters in readable registers, with clearer record sections and restricted private information. Work retains the list/calendar workflow and original filters; task actions and Action Centre notices use focused controls, progressive detail and clearer source context.

This approved milestone covers U04–U06 and U45–U46 on published baseline `67aad4c0f460cfa64371409ba15fc750d8b073df`. David authorised milestone pushes to existing main on 18 October. The ten product files match the frozen implementation and actual browser runtime hashes. API, server policy, navigation, database, credentials and deployment configuration are unchanged. It is a checkpoint in the 77-route redesign, not whole-route or hosted acceptance.

## Verification

- 134explicit credential-free local tests passed, zero failures or skips; network guard active.
- Webpack production build, full source lint and standalone TypeScript passed using synthetic build configuration.
- Work/Inbox: 40 browser records and 36 screenshots at 1440/834/390/320; no page errors or external requests. Exact filters, calendar keyboard/date context, cancellation focus, London DST, matching and mismatching CRM readback, notification keyboard/read/dismiss and typed SiteShift destinations passed. Sixteen writes were in-memory test doubles only.
- People: 36 browser records and 32 screenshots at the same four widths; authorised directory and person views, private-section restrictions, Staff denials, search/return state, independent unavailable/draft sources and phone layouts passed. No writes attempted. The original before version has a recorded 834px overflow; the redesigned version has none.
- All 28Work/Inbox and 8People actual-source runtime entries exactly match this candidate. Identity/data/service boundaries are explicitly synthetic; these checks do not establish hosted Auth/RPC/RLS or durable acceptance.
- The original dirty checkout retained its HEAD, exact porcelain status and 51 saved file hashes.

## Reviewed images

- [Action Centre desktop before](https://chatgpt.com/api/library/files/libfile_4df8ecce51fc81919a2a6d0745b8945c/download) and [after](https://chatgpt.com/api/library/files/libfile_1a7417975ce8819182b7b833dbaf2bee/download).
- [Action Centre phone before](https://chatgpt.com/api/library/files/libfile_8fa446e639788191942f592f99ab708f/download) and [after](https://chatgpt.com/api/library/files/libfile_1ebc1b75bc7c819192e556b13827b572/download).
- [People directory desktop](https://chatgpt.com/api/library/files/libfile_bbe428b6c0b88191b47865bb617634b8/download), [phone](https://chatgpt.com/api/library/files/libfile_c136da005110819184f895635dfe6c35/download), and [restricted Operations person record](https://chatgpt.com/api/library/files/libfile_a1e3c516e0c88191a17190d0409b4cd7/download).

Source manifests, raw browser receipts and local check logs accompany this report. Later source families and Onboarding are excluded pending their own review. Git push and deployment outcomes must be recorded separately after publication.
