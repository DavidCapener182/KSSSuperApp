# TASK-UI11 shell navigation prototype

Status: bounded local visual prototype, awaiting David's visual review before broad rollout. David approved the navigation architecture and requested final screenshots; that is not visual acceptance. This worktree starts at combined local UI03–UI10 snapshot `be3fb185249ecb10259d3bc944a1258131834341`. It is not canonical main or a hosted deployment.

The desktop header menu is presented as a persistent left sidebar. The sidebar retains the existing role-derived `navigationFor` links and the existing extra Site Book links, grouped under their current headings. It can collapse to icon buttons with accessible labels and a saved local browser preference. The mobile menu opens as a left drawer. The breadcrumb shows the authorised section plus nested route context; UUID segments are labelled `Record` rather than exposing an opaque identifier as a visual title. Existing route and record gates remain authoritative.

The content begins below a compact 70px header and breadcrumb. Shell styling uses the existing system font and blue/graphite/neutral tokens. The drawer and collapsed buttons have at least 44px targets and retain the shared focus ring. No new navigation destination or role rule was introduced.

Checks: read AGENTS.md, STATUS, DECISIONS, UI02/UI08 reports, accepted capability map, and Next 16.3.6 local linking, usePathname and CSS docs. Next type generation, TypeScript, focused ESLint and `git diff --check` passed after the prototype edit. A clean production Webpack build passed. The initial development preview exposed a `/api/me` request-scope error during refresh, so it was stopped. The built local app rendered successfully under the existing synthetic Office Admin session; no Supabase write or business action was submitted.

Final browser evidence from the final production build at `127.0.0.1:3272`, with existing synthetic Office Admin credentials and no business writes:

| Requested view | Saved file |
| --- | --- |
| Office Home, 1280px, expanded | [office-home-expanded-1280.png](evidence/ui11/office-home-expanded-1280.png) |
| Management Reports, 1280px, collapsed | [management-reports-collapsed-1280.png](evidence/ui11/management-reports-collapsed-1280.png) |
| Office Home, 390×844, drawer closed | [office-home-drawer-closed-390.png](evidence/ui11/office-home-drawer-closed-390.png) |
| Office Home, 390×844, drawer open | [office-home-drawer-open-390.png](evidence/ui11/office-home-drawer-open-390.png) |
| Workforce, 1440px, expanded | [workforce-expanded-1440.png](evidence/ui11/workforce-expanded-1440.png) |

The files were recaptured after the portal-width correction, page data loaded, and drawer animation settled. Measured [capture checks](evidence/ui11/capture-checks.json): document width equals viewport width at 1280px, 390px and 1440px; desktop expanded sidebar 258px, collapsed sidebar 76px; header 70px on desktop and 64px mobile; context 51px desktop and 48px mobile. Content starts at 121px desktop and 112px mobile, without a second large horizontal band. The selected section was visible on each desktop screen. Expanded labels were readable in the screenshot, and the collapsed 17 links each had an accessible name. The open drawer showed the same 17 Office destinations, 48px minimum link height, and a 44px trigger. Escape closed it and focus returned to the trigger. Body font resolved to system sans-serif, with no condensed or decorative font in the captured shell.

Workforce at 1440px retained a 1180px main area beside the expanded sidebar and the seven day row and seven column matrix were visible. Main scroll width was 1180px, equal to its rendered width. The screenshot shows the accepted planner without a shell-created overflow or hidden day. No route-specific collapse behaviour or UI03 presentation change was made.

Visual review gate: David inspects the five saved final screenshots. The shell prototype is locally complete and technically checked, while the visual decision and broad rollout remain pending.
