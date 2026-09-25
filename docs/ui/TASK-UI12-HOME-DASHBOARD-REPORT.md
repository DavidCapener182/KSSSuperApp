# UI12 Home dashboard prototype report

## Prototype scope

The Home page now has a role-aware welcome, Europe/London date, compact authorised shortcuts, a clearly labelled link to the existing `/work` Task service for Office, and separate Operations, Delivery, People and administration, Staff duty, and Staff requests and evidence sections. It reuses the existing principal, `navigationFor` and training capability checks. The source routes still own their records, status and actions. No counts, deadlines, recent-use claims, combined Task state, new data read or backend change were added.

The screenshot review gate has **not** been met. The isolated local preview initially exposed an authenticated Office Home in the accessibility tree, but the synthetic Development access check then became unavailable and redirected to the sign-in page before a usable Office screenshot could be captured. Retry remained unavailable. Staff was not reached. Therefore there are no genuine Office or Staff desktop/390px screenshots for review, and no visual acceptance claim. Stop here before broad rollout.

## Checks and limits

- Clean named worktree and starting snapshot checked before edits. AGENTS, STATUS, DECISIONS, UI10 report, navigation/Task contracts and Next 16.3.6 page and Link docs read.
- `next typegen`, `tsc --noEmit --incremental false`, focused ESLint and `git diff --check` passed.
- Local Webpack dev server started on 127.0.0.1:3212 using the existing synthetic Development environment. The access check failed during screenshot capture. Server output showed `/api/me` returning 500 because `cookies()` was called outside a request scope in the existing `createServerSupabase` path. This was not changed in UI12. No data was written and no role or grant changed.
- Responsive rules specify a single column at 390px, visible focus outline and 44px minimum shortcut/Task action targets. These remain code checks pending actual viewport evidence.

This is a review-stage visual prototype, not an accepted rollout or production readiness claim.
