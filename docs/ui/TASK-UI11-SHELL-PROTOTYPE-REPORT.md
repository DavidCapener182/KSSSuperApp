# TASK-UI11 application shell and navigation

Status: David visually accepted the UI11 direction for broad enterprise-shell rollout in synthetic Development on 25 September 2026 after reviewing the five saved screenshots. The shared shell refinements and representative route checks are complete in this isolated worktree. No staging or production deployment is authorised. This worktree starts at combined local UI03–UI10 snapshot `be3fb185249ecb10259d3bc944a1258131834341`; it is not canonical main.

The desktop header menu is presented as a persistent left sidebar. The sidebar retains the existing role-derived `navigationFor` links and the existing extra Site Book links, grouped under their current headings. It can collapse to icon buttons with accessible labels and a saved local browser preference. The mobile menu opens as a left drawer. The breadcrumb shows the authorised section plus nested route context; UUID segments are labelled `Record` rather than exposing an opaque identifier as a visual title. Existing route and record gates remain authoritative.

The content begins below a compact 70px header and a quiet breadcrumb. Shell styling uses the existing system font and blue/graphite/neutral tokens. The drawer and collapsed buttons have at least 44px targets and retain the shared focus ring. The section labels were strengthened slightly. The sidebar navigation now scrolls independently of the stable KSS identity and scrolls the current destination into view. Every collapsed icon has a Radix hover/keyboard-focus tooltip as well as an accessible name. No new navigation destination or role rule was introduced.

Checks: read AGENTS.md, STATUS, DECISIONS, UI02/UI08 reports, accepted capability map, and Next 16.3.6 local linking, usePathname and CSS docs. After the final refinements, Next type generation, TypeScript, focused ESLint, `git diff --check` and a clean production Webpack build passed. The initial development preview exposed a `/api/me` request-scope error during refresh, so browser checks used the production build. No Supabase write or business action was submitted.

Final browser evidence from the final production build at `127.0.0.1:3272`, with existing synthetic Office Admin credentials and no business writes:

| Requested view | Saved file |
| --- | --- |
| Office Home, 1280px, expanded | [office-home-expanded-1280.png](evidence/ui11/office-home-expanded-1280.png) |
| Management Reports, 1280px, collapsed | [management-reports-collapsed-1280.png](evidence/ui11/management-reports-collapsed-1280.png) |
| Office Home, 390×844, drawer closed | [office-home-drawer-closed-390.png](evidence/ui11/office-home-drawer-closed-390.png) |
| Office Home, 390×844, drawer open | [office-home-drawer-open-390.png](evidence/ui11/office-home-drawer-open-390.png) |
| Workforce, 1440px, expanded | [workforce-expanded-1440.png](evidence/ui11/workforce-expanded-1440.png) |

The files were recaptured from the refined build after page data and drawer animation settled. Measured [capture checks](evidence/ui11/capture-checks.json): document width equals viewport width at 1280px, 390px and 1440px; desktop expanded sidebar 258px, collapsed sidebar 76px; header 70px on desktop and 64px mobile; context 51px desktop and 48px mobile. Content starts at 121px desktop and 112px mobile, without a second large horizontal band. The selected section was visible on each desktop screen. Expanded labels were readable in the screenshot, and the collapsed 17 links each had an accessible name. The open drawer showed the same 17 Office destinations, 48px minimum link height, and a 44px trigger. Escape closed it and focus returned to the trigger. Body font resolved to system sans-serif, with no condensed or decorative font in the captured shell.

Workforce at 1440px retained a 1180px main area beside the expanded sidebar and the seven day row and seven column matrix were visible. Main scroll width was 1180px, equal to its rendered width. The screenshot shows the accepted planner without a shell-created overflow or hidden day. No route-specific collapse behaviour or UI03 presentation change was made.

## Accepted shell rollout checks

The enterprise route group has 57 page files under one server-authenticated layout, so this shell is applied consistently at that shared boundary. The [rollout check readback](evidence/ui11/rollout-checks.json) records authenticated synthetic Office, Operations, Staff and Super Admin routes. Office `/app`, `/management-reports` and `/workforce`; Operations `/app` and `/workforce`; Staff `/app` and `/my-schedule`; Super Admin `/app` and `/access/incident-reviewers` all returned 200 without horizontal page overflow. Operations `/crm` and Staff `/people` returned 404. This representative sample does not claim individual visual inspection of all 57 routes or a formal accessibility audit.

At 1280px and 1440px, Workforce retained all seven day columns and its right-aligned week and Refresh controls ended inside the viewport. The sidebar caused no page overflow; no UI03 behaviour or presentation semantics were changed. At 700px desktop height, the sidebar navigation had 880px scroll height in a 587px viewport and scrolled while the KSS identity and page scroll position stayed fixed. On route navigation the current sidebar item was visible. Collapsed icon labels were present for all 17 Office links; both keyboard focus and hover displayed the tooltip. The genuine 390px drawer retained 17 authorised destinations, a 44px trigger and 48px links; Escape closed it and returned focus.

David accepted the visual direction and authorised this shared-shell rollout. UI12, UI13 and UI14 retain their page/component/record ownership. No account-menu redesign, route-specific automatic collapse, backend feature, live data, Supabase change, staging or production deployment was added.
