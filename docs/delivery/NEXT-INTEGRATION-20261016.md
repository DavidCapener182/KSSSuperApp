# Unpublished next integration candidate —16 October2026

Baseline13cce15060f0c561e43e71cfcf9aeecc7094ba16, isolated `/tmp/kss-next-integration-20261016`, branch `codex/next-integration-20261016`. At the initial candidate snapshot there was no new commit, push or deployment. Original checkout and published release checkout are unchanged. Locked679 dependencies installed offline with scripts disabled; no .env copied.

## Reporting reviewed and integrated

The Reporting worker explicitly froze its source/test/report/evidence snapshot. Verified all seven final hashes before copy and again after independent checks. Reviewed the five source files: the dedicated report-only validator; report client; report page; Event page; SiteService page. Only reporting URL parsing/serialization, custom inclusive-to-exclusive date conversion, context-preserving exact source links/return links, and stale report-response clearing changed. Existing metric definitions/API/RPC/permissions and ControlRoom/Workforce returns remain. No source/auth/global CSS/package/migration edits outside those five files. Read the finished helper, client and source-page diff; no release-blocking regression found.

Malformed/duplicate query and unsafe return values are rejected, typed exact UUID/source links are validated, page offsets remain30-aligned and bounded, selected measure stays a UI focus rather than new RPC meaning, and abort plus sequence guards prevent older response bodies replacing current report facts. Valid UUID filters remain subject to the unchanged server source scope; the URL is not authority.

Worker report: [REPORT-CONTEXT-20261016.md](REPORT-CONTEXT-20261016.md). Coordinator independently ran Reporting36 + document30 + Staff7 + TFS20 + capability5: **98/98 passed**. Independently ran both Reporting and full-shell Schedule browser specs: **6/6 passed**, Reporting10 + Schedule7 captures. Production Webpack build passed with76 pages, serial TypeScript passed, full lint passed with one existing unrelated officeId warning, localhost smoke1/1 and diff check passed. Reviewed the integrated390px report screenshot. Integration evidence directories now contain coordinator browser captures; worker-original frozen evidence remains separately available.

## Other scope and limits

Added only the separately completed shell/Schedule spec, report and synthetic evidence. It changes no product source. DUTY-02-CONTRACT-20261016.md is a proposed contract, not implementation or acceptance; it records the analyst refinements and currently unapplied future read-RPC dependency. My Work frozen commit e36fd9301cbd242d42ad40b0d47bd06b6f40a3fc has now been independently reviewed and copied. It adds only source/status/title-and-visible-label search over the existing returned projection, a dedicated CSS module, two tests, its report and synthetic evidence. Exact task/TFS links, TFS ordering and covering/history remain. No filter-driven request, new completion action or task domain.

All browser identities/API/source detail boundaries are explicit local simulations. These checks prove component navigation/layout and application-boundary handling, not database/RLS, real historical facts, live sessions, remote file/ack authority or human acceptance. No new auth attempts, resets, grants, policy changes, remote records or deployments.

Raw generated compiler/test logs are retained locally in evidence; the review patch excludes raw .log files because compiler-emitted whitespace is not source formatting. Exact JSON/hash/PNG evidence is included. No authenticated acceptance gate is closed.

## Final combined Reporting + My Work checks

After exact-copy verification of all18 My Work committed files, reran the combined local suite: **102/102 passed**, zero failed/skipped. Independently reran My Work Chromium: **4/4 passed** (three journeys plus parent), nine captures without page/control overflow. Reporting and shell browser specs previously passed independently in this same integration checkout:6/6,17 captures; their source hashes remain unchanged after the disjoint My Work addition. Across these completed browser runs:10 Node test results including parent suites and26 responsive captures. These are simulated component journeys, not authenticated acceptance.

Fresh combined production build passed with76 pages, followed serially by TypeScript; full lint has zero errors and the same existing unrelated warning; built localhost smoke1/1 and diff check passed. Visually inspected integrated My Work390px all-work screenshot. Reporting exact identity/return scope and My Work projection/search restrictions have no integration collision. Product changes total seven files: Reporting’s five source files plus WorkClient and its new CSS module.

My Work worker source commit is retained independently; this integration was locally verified before its separate publication authorization. The backend duty-read worker is separately preparing its approved six new files and unapplied RPC proposal; none are part of this UI candidate yet. Live DB, grants, policies, file/ack changes and deployment remain blocked. Contract proposals are explicitly labelled; no broader Trello card is complete.

## Publication authorization

David subsequently approved publishing Reporting and My Work to the live app after disclosure of incomplete signed-in acceptance. Final preflight confirmed remote main remains13cce15060f0c561e43e71cfcf9aeecc7094ba16 and open PR search returned none. The scoped release includes only the seven reviewed product files, their focused tests/reports and synthetic evidence, plus completed shell/Schedule verification. Duty-document source, contract and proposed migration are excluded. No DB/permission/security changes accompany this release. Actual remote SHA and deployment outcome will be recorded after publication, without inferring CI success from local checks.
