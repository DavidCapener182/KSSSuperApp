# TASK-UI14 record layout prototype

Status: bounded Event record prototype for David's visual review. No broader record-page rollout.

David's review boundary: Event implementation complete for review; visual acceptance pending; cross-record rollout not authorised. UI11 may proceed independently. Review UI11, UI12, UI13 and UI14 together once a shareable authenticated preview exists.

## Change

The existing `/events/[id]` detail now places a factual Event summary above a section selector and content. The summary shows the source status and type, Client, Site/Venue, and London Event window from the existing authorised Event response. At desktop widths, the section selector is a sticky left rail; at narrow widths it becomes a horizontally scrollable selector between the header and content. Existing Event context, operational actions, Staffing Plan, Attendance link, and immutable History retain their source workflows. Attendance and worked time remain distinct routes. No new data read, mutation, permission, or inferred readiness state was added.

## Record inventory for later review

The UI01 route inventory identifies long detail pages at `/crm/organisations/[id]`, `/crm/opportunities/[id]`, `/people/[id]`, `/onboarding/[id]`, `/incidents/[id]`, `/mobilisations/[id]`, `/service-delivery/[id]`, `/site-book/[serviceId]`, and `/sites/[siteId]/services/[serviceId]`, plus Event attendance/work-time details. These need individual source and role review before reuse of this layout. None was changed in UI14.

## Checks and limitations

- Read `AGENTS.md`, delivery `STATUS.md` and `DECISIONS.md`, UI01 route inventory/redesign roadmap, Event 06A/06C contracts, and installed Next 16.3.6 CSS/Link guidance from the saved project. This isolated worktree had no `node_modules`; a gitignored symlink to the saved project's installed dependencies was used for checks.
- `next typegen` and `tsc --noEmit` passed; targeted ESLint on `events-client.tsx` and `git diff --check` passed.
- The first dev-server visual attempt failed: it redirected to `Access check unavailable` and logged `cookies was called outside a request scope` from existing `src/lib/supabase/server.ts`. No UI14 code was changed for that unrelated error.
- The later clean Webpack production build passed with UI11 commit `88f2e34` cherry-picked into this isolated worktree for review. An authenticated synthetic Office Admin session opened `/events/1a796ac1-7df6-4ae4-878c-5f977014fb4b` at 1280px and genuine 390px. This was local production-preview mode against synthetic development data, not a hosted deployment.
- Saved browser screenshots: [desktop full page](evidence/ui14/event-office-1280.png), [desktop History with sticky rail](evidence/ui14/event-office-1280-history-rail.png), [390px full page](evidence/ui14/event-office-390.png), and [390px keyboard focus](evidence/ui14/event-office-390-focus.png).
- Browser DOM measurements: at 390px the document/body width was 390px; the section selector's 358px viewport held 376px of scrollable links without page overflow. Context, Staffing, Attendance and History links each measured 44px high. Keyboard Tab placed focus on Staffing with a computed 3px blue outline. At 1280px and `scrollY=902`, the sticky section rail remained 16px from the viewport top; document width equalled 1280px.
- The synthetic sample had a 29-character Event name and bounded Client/Site labels. They wrapped within the 390px view. This does not prove behavior for longer production names. Staffing had one requirement and History one entry, so dense/long-record scanning is only partly exercised.
- No live data, Supabase mutation, staging, deployment, or acceptance is claimed.

## Visual acceptance checklist

At desktop and a genuine 390px viewport, inspect the Event summary as a record header, width cost and long-page usefulness of the sticky section rail, content density, Staffing Plan and History scanning, and wrapping of long Event/Client/Site names. On mobile, check that the horizontal section selector is recognisable without resembling another app-level navigation bar, each target is at least 44px, focus is visible, and the document has no horizontal page overflow. Check the active section while following links and while scrolling through a long record.

The current section links are plain anchors. They move to a section but do **not** maintain an active/selected state as scrolling changes the visible section. This is an explicit prototype limitation to evaluate in visual review, not a verified interaction.

UI11's exact shell commit `88f2e34` was cherry-picked for the combined visual check. UI14 did not edit its shared shell or global CSS. UI12 and UI13 were not part of this preview; David's full UI11–UI14 combined review remains pending. The Event header reads as a second bordered surface below the page title and domain tabs in the captured view; whether that meets the intended record identity hierarchy is a visual decision for David. The rail occupies 10.5rem beside the content. The staffing and History sections remain visible and scannable in this short synthetic record, but the longer-record experience is not yet shown.
