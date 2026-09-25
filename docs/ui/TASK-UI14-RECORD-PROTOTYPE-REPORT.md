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
- Desktop and genuine 390px screenshots are **not captured**. The existing Chrome session timed out. An isolated local Next preview was then started at `127.0.0.1:3104` and opened in the in-app browser, but the app redirected to `Access check unavailable`. The dev server logged `cookies was called outside a request scope` from existing `src/lib/supabase/server.ts` through `/api/me` and Event routes. Retrying the access check did not recover it. The server was stopped. A source inspection and responsive CSS rule are not a browser readback. Authenticated visual hierarchy, overflow, and focus must be reviewed before broad rollout.
- No live data, Supabase mutation, staging, deployment, or acceptance is claimed.

## Visual acceptance checklist

At desktop and a genuine 390px viewport, inspect the Event summary as a record header, width cost and long-page usefulness of the sticky section rail, content density, Staffing Plan and History scanning, and wrapping of long Event/Client/Site names. On mobile, check that the horizontal section selector is recognisable without resembling another app-level navigation bar, each target is at least 44px, focus is visible, and the document has no horizontal page overflow. Check the active section while following links and while scrolling through a long record.

The current section links are plain anchors. They move to a section but do **not** maintain an active/selected state as scrolling changes the visible section. This is an explicit prototype limitation to evaluate in visual review, not a verified interaction.

On 25 September, UI11's shell implementation and screenshots existed only as uncommitted work in its isolated worktree. A combined UI11/UI14 authenticated preview was therefore not available for this lane's readback. UI14 did not copy UI11's shared shell or global CSS into this worktree.
