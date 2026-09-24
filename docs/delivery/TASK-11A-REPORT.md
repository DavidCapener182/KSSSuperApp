# TASK-11A delivery report — External App Shortcuts

**Date:** 24 September 2026
**Status:** implemented in local synthetic development; awaiting David's acceptance. No external destination is enabled.

## Delivered

- Added a compact External apps section below internal destinations on authenticated Home. Enterprise navigation is unchanged.
- Implemented the approved active-role matrix. Shortcut visibility uses the server-resolved current principal; multiple roles combine by union. A shortcut grants no permissions inside the destination.
- Added MagSecure, Footasylum Audits, and Training cards. They are link-only and have no API, sync, identity mapping, completion/status retrieval, SSO, embedding, shared authentication, or recreated app functionality. Training remains shortcut-only.
- Added server-side URL configuration through `KSS_MAGSECURE_URL`, `KSS_FOOTASYLUM_AUDITS_URL`, and `KSS_TRAINING_URL`. Values are centrally controlled, optional, and not prefixed `NEXT_PUBLIC_`. The validator requires an absolute HTTPS URL with a valid DNS hostname and rejects credentials, explicit ports, queries, and fragments. Missing or malformed values produce a non-interactive **Link not configured** card.
- Added external-link cues and `target="_blank" rel="noopener noreferrer"` for configured links. The cards use Lucide icons, existing blue/graphite/neutral tokens, three columns on desktop, and a one-column layout below 560px.

## Destination verification

Repository and project configuration review found no verified canonical launch URL for any of the three applications. The public Moodle references in planning material are articles, not a confirmed KSS Training login destination, and were not used. The development and test environment has no destination variables set. Production cards therefore remain unavailable and fail closed.

To activate shortcuts later, David/KSS must supply and verify:

- MagSecure canonical HTTPS landing URL.
- Footasylum Audits canonical HTTPS landing URL.
- The existing Training platform's canonical HTTPS sign-in URL.

No candidate destination was guessed or opened.

## Verification

- Passed: `npm run build` using the repository's Webpack build path.
- Passed: `npm run test:shell` (2/2), including authenticated Home access, anonymous/unmapped denial, current navigation, configured synthetic link attributes, Staff versus Office role union, and a naturally expiring temporary Office role that removes Footasylum Audits while preserving the Staff shortcuts. Temporary grants use the existing Super Admin API; no direct role-table writes were added.
- Passed: `node --test tests/external-apps.test.mjs` (4/4), covering every role, multi-role union, empty roles, absent/malformed values, and valid HTTPS destinations.
- Passed: targeted ESLint on Home, shortcut code, and the two affected test files.
- Passed: `git diff --check`.
- Not verified: visual authenticated browser review at desktop and 390px. The Playwright CLI wrapper could not install because `registry.npmjs.org` was unreachable (`ENOTFOUND`). The local app opened to its sign-in screen; no credentials were entered through the browser. Automated authenticated production-shell checks passed, and the responsive breakpoint is implemented, but this does not replace screenshot/browser evidence.

## Scope and limits

No schema, migration, API/provider integration, staging access, external app change, or deployment was made. MagSecure and Footasylum Audits remain standalone applications. All three Home cards show **Link not configured** until an owner-confirmed URL is set centrally. Visual browser evidence remains an acceptance gap; no production readiness or human acceptance is claimed.
