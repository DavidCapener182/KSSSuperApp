# TASK-11A — External App Shortcuts

**Status:** approved by David for implementation on 24 September 2026. See [TASK-11A-REPORT.md](TASK-11A-REPORT.md) for implementation and verification evidence. External URLs remain unconfigured pending owner confirmation.

## Evidence and current state

- The current shell is `src/components/enterprise-shell.tsx`; `/app` Home links are generated from the server-owned role capability map in `src/lib/auth/capabilities.ts`.
- Existing role codes are `SUPER_ADMIN`, `OFFICE_ADMIN`, `OPERATIONS` and `SECURITY_STAFF`. Navigation is a presentation of current capabilities; server-side route and data policies remain authoritative.
- TASK-01D explicitly deferred Apps links until each destination URL, owner, audience/site scope and authentication mode are verified. No verified URL or app-link schema/catalogue was found in this checkout.
- Training remains `NOT_CONNECTED` in the product. A shortcut must not imply course status or completion.
- The current delivery status lists TASK-07B review as the authorised work. This document does not supersede that gate; implementation requires explicit approval and an updated task boundary.

## Proposed outcome

Add a compact **External apps** section to authenticated `/app` Home with three shortcut cards: **MagSecure**, **Footasylum Audits**, and **Training**. Keep the shell navigation unchanged. Each card is a launch link only and is shown only to a role audience approved for that app. Do not create app routes, proxies, provider integrations, or app-specific status in KSS Enterprise.

### Role visibility proposal

| Shortcut | Show to these active Enterprise roles | Notes |
|---|---|---|
| MagSecure | `SUPER_ADMIN`, `OFFICE_ADMIN`, `OPERATIONS`, `SECURITY_STAFF` | Visibility does not grant MagSecure access; the destination remains responsible for its own sign-in and permissions. |
| Footasylum Audits | `SUPER_ADMIN`, `OFFICE_ADMIN`, `OPERATIONS` | Do not expose the audit shortcut to `SECURITY_STAFF` by default. A business owner may explicitly approve a broader audience. |
| Training | `SUPER_ADMIN`, `OFFICE_ADMIN`, `OPERATIONS`, `SECURITY_STAFF` | Shortcut only. Do not display enrolment, completion, certificate, compliance, or eligibility state. |

For multi-role accounts, use the union of the approved app audiences. Resolve active roles on the server for each Home request; never trust browser role claims. The role matrix is a proposal for David/KSS owner review, not a change to current capabilities or access policy. External app access is not equivalent to Enterprise shortcut visibility.

## Destinations and configuration ownership

- Before enabling a shortcut, the named app owner must provide and verify its canonical HTTPS landing URL, intended role audience, destination authentication expectations, and verification date/source. The project/platform owner maintains the approved URL configuration for each deployment.
- Store URLs in server-only environment configuration, one explicit variable per app and deployment. Do not hard-code production URLs, copy URLs from other projects, expose environment values to browser bundles, or accept URLs from query parameters, forms, or user records. No database table or configuration UI is proposed.
- Validate configured values on the server as absolute HTTPS URLs with a syntactically valid DNS hostname; reject credentials, unexpected ports, fragments, and query strings. The centrally controlled URL itself is the approved destination. Do not append Person IDs, site IDs, email addresses, auth tokens, or other context. Configuration must not turn a shortcut into SSO or a data hand-off.
- An absent, invalid, or unverified destination renders a non-interactive card labelled **Link not configured** with neutral help text such as “Ask your KSS administrator.” Do not render an empty anchor, guess a URL, or expose raw configuration/errors. Log no secret or full sensitive URL.

## Link behaviour and privacy

- Render approved links as native anchors that open a new tab/window with `target="_blank"` and `rel="noopener noreferrer"`. Include a visible external-link icon and accessible text such as “Opens MagSecure in a new tab”; preserve keyboard focus and a clear focus indicator.
- Do not proxy requests, inject credentials, forward cookies, read destination state, synchronize records, or pass tokens, identifiers, referrers, or query parameters. `noreferrer` suppresses the browser referrer. No completion/status is consumed from any destination.
- Keep error/loading behaviour local to the card. A destination outage or sign-in requirement must not affect KSS authentication or claim that access succeeded.

## Explicit exclusions

- **MagSecure and Footasylum Audits are standalone applications.** No API, sync, database/record/site mapping, completion/status consumption, copied data, or recreation of patrol, audit, inspection, or incident features.
- No edits to MagSecure, Footasylum Audits, or any other app; no provider/plugin integration, SSO, embedded web view, shared session, background request, live data, staging access, import, deployment, migration, or new paid service.
- Training remains shortcut-only in 11A. A native training rebuild or provider integration is future work requiring its own approved proposal.

## Layout and accessibility

- Follow the existing iOS-inspired shadcn/ui blue, graphite, and neutral design; use no green. Keep the section below current role-permitted internal Home links, visually separated with a heading and concise “External sign-in may be required” note.
- At desktop widths, use a restrained three-column card grid where space permits. At 390px, stack cards in one column with comfortable spacing and at least 44px interactive height; do not introduce horizontal page overflow.
- Each card has a clear app name, a short purpose label only if supplied by its owner, a text external-link cue, visible keyboard focus, and sufficient contrast. Do not use logos or destination branding assets without owner-supplied approval.
- Ensure unavailable cards are announced as status text, not disabled links. Maintain logical heading order and meaningful accessible names for icon-only decoration.

## Proposed implementation checks and acceptance

If separately approved, acceptance requires evidence for:

1. Exact role visibility for each single-role account and multi-role unions; inactive/expired roles do not retain a shortcut, and a forged browser role cannot reveal one.
2. Missing, malformed, non-HTTPS, credential-bearing, query-bearing, fragment-bearing, and unapproved-host URLs fail closed without a clickable link or raw configuration disclosure.
3. Approved links use the expected canonical destination, open a separate context with `noopener noreferrer`, expose the external destination cue to assistive technology, and carry no tokens, query data, user/site identifiers, or referrer.
4. Anonymous, unmapped, and expired-role users do not receive Home or shortcut data; existing route and server-authorisation behaviour remains unchanged.
5. Desktop and 390px authenticated browser review confirms usable spacing, focus, contrast, status messaging, and no horizontal overflow. Include relevant shell/Home regressions and distinguish automated checks from browser evidence.
6. No API calls or writes are made to external apps; no schema/migration, provider integration, training state, or changed external app is present.

Record only checks actually run in a future delivery report. This proposal itself claims no implementation, test, external URL verification, human acceptance, or production readiness.

## Approval gate

Stop here for David's approval. Before implementation, David/KSS must confirm the role matrix and named owners must verify the three canonical HTTPS URLs and authentication expectations. Any audience or configuration change outside this proposal needs a revised task approval.
