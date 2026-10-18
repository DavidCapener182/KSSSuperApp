# My Deployments scoped repair — U56

Local synthetic acceptance only. Controlled rendering baseline d958b0047d566e9cf981d819cd0364f132e17843f754edcfb0bf0d88f6c19d4f preserved as the starting point.

Focused reads enforce exact allocation and source (omitted source retains the existing EVENT default). Reads and mutations retire with the current view. Denied authority clears old facts and the decline action. A synchronous lock prevents duplicate writes. Confirmation requires the existing integer next-revision receipt, an exact source read and a fresh page containing the same status/revision. Failed readback and interrupted requests remain uncertain; no automatic write retry. Explicit 400/409 rejection refreshes read-only facts while preserving the same decline draft; changed revision disables stale submission. Fields lock while pending. Existing pagination, returnWeek, role/API/RPC contracts and accepted/history presentation remain unchanged.

Evidence: 19 actual-source tests: unchanged source 4 passed/15 failed; repaired 19 passed. Independent Chromium 22/22, four widths 1440/834/390/320, 28 captures/56 PNGs including focus restoration, keyboard containment, retained draft, exact Site accept, exact Event decline, stale revision, denial, unmount and synthetic Office denial. Scoped lint and TypeScript pass after local Next route type generation. 410 non-owned tracked source files byte-preserved.

Existing deployment_respond/site_shift_respond return integer revision; my_deployments_08c exposes exact identity/status/revision. This confirms current visible state, not an unreadable audit-event reason. No hosted auth/RPC/RLS/persistence verification, live records or model/network services. External browser requests aborted; unmatched writes denied.
