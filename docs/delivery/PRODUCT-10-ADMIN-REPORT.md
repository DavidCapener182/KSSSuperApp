# PRODUCT-10 P1 — Person Access & Grant Review

Date: 27 September 2026

Environment: synthetic Development only

Status: implemented and locally verified; integration, protected preview deployment, and human acceptance remain with the Phase 1 coordinator.

## Delivered

- Super Admin-only `/access` Person search and `/access/people/[id]` read-only review.
- Stable Person identity; current and historical role and Site assignments; typed grants grouped by owning domain, with dates, recorded grantor and reason where the source provides them, revocation, source scope, and source navigation.
- Historical lists show three rows initially and offer 20-row browsing pages. The source query currently loads the complete Person history before presentation pagination.
- A dedicated read-only RPC composes existing grant sources. It creates no universal permissions table and changes no write path. Private implementation uses a fixed search path and verifies an active Super Admin and the exact Person before returning facts. Existing RLS protects direct Person, role, and Site reads.
- A link from the existing Super Admin Incident Reviewers page to the access landing page. The main Enterprise shell navigation is owned by the coordinator and still needs its `/access` entry.

The review displays recorded source facts, not an effective permission decision. Each owning module still enforces its role, resource, state, and file audience rules. No private evidence metadata or bytes, Credential reference value, or HR case content is returned.

## Development database change

One migration was applied to the synthetic Development project `dnfhkmmnlbiabqypclqg` before the coordinator's migration hold: `20260927163512_person_access_grant_review_10.sql`. SHA-256: `bb58c125ab19fbdcbbd3652a1f160f13b3d1337d087eb8e1de49bd2ce9488a39`. The migration list readback reported version `20260927163512`; catalog readback confirmed the private security-definer function, public security-invoker wrapper, empty search paths, no anonymous EXECUTE, and authenticated EXECUTE guarded in-function. No later database changes were made.

## Checks performed

- Next.js 16.3.6 production build, TypeScript, and focused lint passed.
- Direct synthetic Development RPC test passed: Super Admin received typed facts; Office, Operations, Staff, anonymous, and a guessed Person were denied. Role and Site history were present.
- Browser readback in local production mode: Super Admin Person search and Staff A review loaded; the review showed current and historical source facts. Direct review URLs returned 404 for Office, Operations, and Staff; anonymous access redirected to sign-in; a guessed Person returned 404.
- Desktop and 390px mobile screenshots were visually inspected. At 390px, document width remained 390px, with no horizontal overflow.

## Integration limits

- Coordinator should add `/access` to the Super Admin Enterprise shell navigation after integrating the owned route. This branch deliberately leaves `src/components/enterprise-shell.tsx` and `src/lib/auth/capabilities.ts` untouched.
- Source records can be historical, incomplete, or independently constrained. A grant's displayed date status is a review aid, not a live authorization result.
- The UI paginates history display, while the server currently reads the full Person history. Larger real datasets would need source pagination and measured performance before any live-source approval.
- This is local and synthetic Development evidence. It does not establish protected preview acceptance or production readiness.
