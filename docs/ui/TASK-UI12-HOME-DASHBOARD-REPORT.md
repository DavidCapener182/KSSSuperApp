# UI12 Home dashboard prototype report

## Prototype scope

The Home page has a role-aware welcome, Europe/London date, three compact shortcuts, a visually distinct link to the existing `/work` Task service for Office, and shorter Delivery, People and administration, Staff duty, and Staff requests and evidence groups. The previous repeated Operations cards and "More authorised areas" directory were removed; the accepted UI11 sidebar carries comprehensive navigation. Secondary destinations use compact rows or learning links rather than another grid of equal cards. Home still derives links from the existing principal, `navigationFor` and training capability checks. Source routes own their records, status and actions. No counts, deadlines, recent-use claims, combined Task state, new data read or backend change were added.

David directly lifted the prototype freeze for bounded edits and evidence capture. This isolated branch includes the UI11 shell implementation commits `88f2e34` and `5d77727` by cherry-pick; UI12 did not author or alter their shell files. Four authenticated synthetic screenshots against the final UI11 shell are saved in `docs/ui/evidence/ui12/`:

| Persona | Desktop | Mobile |
|---|---|---|
| Office Admin | `office-home-final-1440.png` | `office-home-final-390.png` |
| Security Staff A | `staff-home-final-1440.png` | `staff-home-final-390.png` |

The older `office-home-1440.png` and `office-home-390-initial.png` show the first UI12 draft before the navigation reduction. The `*-ui11-*` captures were taken against UI11's earlier prototype before its final shell delta. Only the four `*-final-*` files represent the current combined review.

## Checks and limits

- Clean named worktree and starting snapshot checked before edits. AGENTS, STATUS, DECISIONS, UI10 report, navigation/Task contracts and Next 16.3.6 page and Link docs read.
- `next typegen`, `tsc --noEmit --incremental false`, focused ESLint, `git diff --check` and the production Webpack build passed.
- The initial Webpack development preview hit the existing `/api/me` request-scope `cookies()` error. The production-build preview at 127.0.0.1:3212 worked for both existing synthetic personas. No source data, role or grant changed.
- Genuine 390px viewport and 1440px checks measured document width equal to viewport width for both personas. The smallest Home link target measured 44px. The resolved body font was the system sans-serif stack. Keyboard Tab focused a Home link with `:focus-visible` and a solid 3px outline.
- Authenticated Office Home showed 12 Home links, including `/work` only in the distinct Assigned Tasks panel. Staff Home showed 13 authorised links; it did not display `/work`. Staff attendance and credentials entry points retain their separate route checks. The screenshots and accessibility trees showed no status count, deadline, universal Task or cross-module verdict.
- Activating the Office Assigned Tasks link reached `/work`, where the existing Task service settled from its loading state to source-backed document review and CRM follow-up records. Home did not read or reproduce those rows.

## Acceptance — 25 September 2026

David directly accepted the four final Office and Staff Home screenshots and the bounded UI12 hierarchy after reviewing the images. **TASK-UI12 is accepted for the synthetic Development Home direction.** The accepted branch snapshot before this close-out is `ba71b6f`; UI12 Home code is in `61d7ce0` and `d3b1908`, with UI11's accepted shell implementation cherry-picked for combined evidence. The screenshots above are the visual acceptance evidence.

This acceptance covers the Home presentation and its existing authorised links. The source modules and `/work` retain their separate authority and state. It does not approve UI13 adoption, a new dashboard read contract, staging, production, live data, or deployment. No shared integration or deployment was performed in this UI12 lane.
