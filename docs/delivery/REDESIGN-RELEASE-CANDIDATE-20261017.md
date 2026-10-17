# KSS Enterprise visual release candidate

David's latest clarification keeps the existing redesigned page layouts and exact original left navigation. The final correction changes only the sidebar background from #f1f4f9 to #e7e9ed, distinct from content #f5f7fb. No broader dashboard rearrangement was started.

Candidate is based on baff9dc1285cc06778dd2346d90424089c1d5ed3. GitHub main and production stable alias were independently read back at that exact commit before candidate preparation on 17 October. The original dirty checkout is preserved.

Included existing verified work: Home task composition and responsive styling, shared presentation refinements, restrained neutral sign-in composition/error hierarchy, and verified Duty selection/request freshness fix. enterprise-shell.tsx is byte-identical to baseline, retaining complete role-aware links, grouping, collapse and mobile Sheet. No API, RPC, schema, migration, auth function, credentials, grants or package changes.

Full V3 independent verification before this one-value CSS adjustment: production build, TypeScript, 182 local cases, built sign-in smoke pass; lint zero errors/one existing warning. Actual-component synthetic browser checks cover Home, Work, CRM, My Schedule and My Duty at 1440/390px, all four role navigation maps, collapse persistence, skip focus, mobile focus trap/Escape/return. Focused post-adjustment browser verifies computed sidebar rgb(231,233,237), content rgb(245,247,251), original left placement, 1440px without overflow and no JS errors. No other component/page source changed during the final correction.

Focused screenshot Library ID: libfile_c1a0a21ebcf88191bd22845c3b4c5df9, file ID file_00000000b40c81f5a29b8a3206d4523e. Synthetic preview: http://127.0.0.1:3108/app. The screenshot uses labelled synthetic data and does not establish hosted auth/RPC acceptance.

Publication is authorised only after the parent confirms that the screenshot has been shown to David. No push/deploy has occurred at candidate preparation. Hosted authenticated acceptance and Duty backend validation remain open under prior denied access; no retry or workaround was attempted. The isolated review candidate does not include unrelated dirty user edits or unpublished Duty backend proposals.
