# Local integration candidate — 16 October 2026

Scope: finish the existing local edits by selecting only still-applicable changes on current main, and incorporate the completed local document-audience lane. The later approved mobile Workforce/Attendance verification and reproduced four-line CSS repair are also incorporated. No new product phase, live service mutation, credential change, deployment or publication is included.

## Candidate and preservation

- Baseline: GitHub-confirmed main `ec463382352fb2bb56eed2d7873eedbd694f9ad6`.
- Checkout: `/tmp/kss-local-integration-20261016`; local branch `codex/local-edits-integration-20261016`. It was populated from the exact committed archive and initialized with an index referencing that existing commit. Source repository Git metadata/worktree registrations were not modified. A scoped local release commit is authorized as of the later 16 October publication request; remote publication status is recorded below.
- Original dirty checkout remains at `e8922da9b18effb25c3a525a2d4391c6ff92ccdc`. Its edits and all 99 pre-existing untracked paths remain preserved there, as recorded in its `LOCAL-EDITS-RECONCILIATION-20261016.md` and filename inventory. None were reset, stashed, deleted, renamed or replaced with current main.
- Installed the candidate's own locked dependencies offline with scripts disabled: 679 packages. Its newer PDF dependencies were retained; the older checkout's dependency tree was not reused as candidate evidence. No package or lockfile change.

## Hunk decisions

| Existing edit | Decision on newer main |
| --- | --- |
| Staff My Schedule single-day mobile agenda and exact action links | Reconciled with current `initialWeek`/validated server prop, `returnWeek`, and Today's Duty links. All stay. Added the existing scoped CSS module; desktop continues to render all days. The returned week's date control/selected day now begins inside that week. Failed reads clear stale schedule content. |
| Staff response confirmation | Current main already checks refreshed allocation status. Kept that guard and return navigation. Added the existing pilot's explicit exact ID/source readback before refresh, pending announcement, primary attendance link, and clear-on-read-failure behavior. Success remains dependent on both exact readback and final list status; a later cancellation does not receive a success confirmation. |
| Availability fixture robustness | Main already has broader pagination, clean-window selection and a Time Away separation assertion. Kept all of those. Added only the local exact fixture cleanup after existing assertions. |
| Workforce fixture robustness | Main already checks both Staff availability and approved Time Away. Kept that selection. Added only paginated lookup and cleanup of exact newly-created fixture facts. |
| Staffing catalogue | Main already expects nine roles. Selected the existing local explicit nine-code assertion rather than reverting to the old count of eight. |
| Onboarding queue test | Its current committed file matched the old baseline. Selected exact-case team lookup, exact newly-created case cleanup, unused-variable correction and guaranteed membership/server teardown. Existing source and permission assertions remain. |
| Removed Time Away/Service Delivery capabilities | Already correct in current main. No capability, authentication or server-policy change was applied; only the five-case local entry-scope regression was added. |
| TASK-17C proposal/pending-acceptance wording | Superseded: current main records formal synthetic acceptance on 25 September. Preserved that entire current brief and its no-override policy; no old pending-acceptance text was copied. |
| Historical STATUS/DECISIONS additions and untracked planning/artifact collection | Kept in the original checkout and accounted for there. Did not import the older status snapshot, missing-reference architecture brief set, duplicate TSX/credential handoff, cleanup script, screenshots or generated PDFs into this source candidate. This avoids replacing newer acceptance/source records with old planning statements. Added only this candidate note to STATUS. |
| Document worker result | Copied exactly `tests/document-audience-local.test.mjs` and `docs/delivery/DOC-AUDIENCE-20261016.md` after the worker's final verified handoff. No source defect was reproduced; no document route, policy, RLS, migration or private-file permission change. |

## Local checks

- Document worker reported 30/30 local checks. Independently reran those production-route/policy checks with the 12 pure local role/date/state checks: **42/42 passed**. RPC/query/storage boundaries are explicit synthetic test doubles, not evidence of deployed RLS or persisted audit history.
- Added seven local production-client-handler checks in `tests/staff-shift-entry-local.test.mjs`: pending until PATCH/exact source readback/list refresh; rejection retains prior state; wrong-source/unavailable readback denial; cancellation after readback prevents confirmation; read failure removes stale cards/totals; retained initial/return week and exact duty/source handoffs. **7/7 passed**. Hook/element/network boundaries are local test doubles; this is not browser layout evidence.
- Candidate Webpack build passed: Next 16.3.6 compile, TypeScript, generation of 76 pages and trace collection. Dummy URL `http://127.0.0.1:9`, synthetic publishable key, `VERCEL=0`, telemetry disabled; no `.env` copied into this checkout.
- Earlier combined execution before TFS: **49 passed, zero failed/skipped**; final combined Node result including TFS is **69/69**, recorded below.
- Ordinary post-build `tsc --noEmit --pretty false` passed.
- Full ESLint passed with zero errors and one pre-existing unrelated unused `officeId` warning in `tests/site-horizon-maintenance.test.mjs`. Focused checks cover all added/changed test and component files.
- Current-main smoke initially failed: it expected removed September sign-in text. Read current `sign-in-entry.tsx` and confirmed the deliberate newer authorised-account/integration guidance. Corrected only `tests/smoke.test.mjs` to assert the current shell, retaining HTTP 200/platform/no-starter checks. Local-loopback smoke then passed **1/1** with the dummy service settings. No sign-in or remote access was performed.
- Modified integration fixture tests pass Node syntax checks. They were not executed against remote databases or roles.
- `git diff --check` passed. No secret files or credentials are included in the patch.

## Coordination and remaining gates

Supported registry reads now show document/mobile thread `01a14626-7066-721c-a7db-fbdfad3200e3` assigned to **KSS Enterprise App**, project ID `8b97db78-cf8d-4a64-8db1-b4e09c06e54f`, host `durable`, KSSSuperApp working-directory context. Its earlier move attempt returned a generic cancelled/unsupported/failed result; current membership is confirmed by readback, with no relocation or attachment mutation by this coordinator. No current project-membership blocker is observed.

After its document handoff, the same second worker was allocated local mobile Workforce/Attendance verification. Its exclusive files are `tests/workforce-attendance-mobile-local.spec.mjs`, `docs/delivery/MOBILE-WORKFORCE-ATTENDANCE-20261016.md` and its evidence directory. Shared source, My Schedule/My Deployments, capabilities, package files, global CSS and migrations remain coordinator-owned. No nested workers. After failing contrast/overlap reproduction, exclusive ownership of `src/components/workforce-planner.module.css` was approved for that worker. Its final four deliverables are reviewed and incorporated; ownership has returned to the coordinator and the second worker is idle.

Open acceptance gates: real synthetic RLS/RPC/Storage/audit persistence, role-loss/revocation under authenticated sessions, signed-in Staff/Office/Super/out-of-scope document journeys and browser preview/download, plus human acceptance of any newly combined UI candidate. Local mocks do not close the Trello audience/open gates. No live credentials/roles/records should be changed to make tests pass.

The bounded TFS test-only lane is now incorporated: [TFS-PERSON-LOCAL-20261016.md](TFS-PERSON-LOCAL-20261016.md) records 20 passing application-boundary/static-source checks and their exact limits. The final combined local Node suite after that addition passed **69/69**, zero failed/skipped. TFS production code and migrations are unchanged. Authenticated persisted assignment/reassignment/clear/refresh/history and no-access-grant readback remains open; no real Dumfries mutation, grant or automatic assignment is permitted. David subsequently authorized publication to main; independent deployment, database or permission changes remain outside scope.

## Final integrated mobile verification

Incorporated exactly the worker-owned Workforce CSS, portable browser spec, report and synthetic evidence folder. The CSS restores the portalled panel’s scoped text/border tokens and reserves header space for Close. No Attendance TSX, global CSS, auth, package or migration change was added. Before-fix contrast was 1.102:1; after-fix is 5.827:1 at 390px and 1280px, with no title/close overlap.

Independently ran `KSS_PLAYWRIGHT_MODULE=/Users/davidcapener/.npm/_npx/e41f203b7505f1fb/node_modules/playwright node --test tests/workforce-attendance-mobile-local.spec.mjs` inside this candidate, leaving `KSS_MOBILE_STAFF_ROOT` unset to exercise the repaired same-root CSS-copy condition: **12 passed, zero failed/skipped**. All 39 layout captures match their viewport widths; every recorded production source hash matches this candidate. Reviewed the 390px dialog screenshot. The integration-owned evidence folder now contains that independent run; before-fix evidence remains the worker’s original reproduction.

After the CSS repair: production build passed with 76 pages; combined local Node checks passed 69/69; full lint passed with the single existing unrelated warning; post-build TypeScript, localhost smoke 1/1 and diff whitespace checks passed. No remote fixture tests were run. See [MOBILE-WORKFORCE-ATTENDANCE-20261016.md](MOBILE-WORKFORCE-ATTENDANCE-20261016.md) for journey coverage and limitations.

One worker rerun was denied before execution by automatic approval review because handoff ownership was frozen. A subsequent explicit instruction reopened that run; its single retry was accepted and passed. The coordinator separately ran the integration-owned copy successfully. There is no pending or uncertain execution from the denied attempt.

## Exact access needed for service acceptance

David must identify/approve the synthetic target environment and disposable synthetic records, and provide usable approved Staff, Office, Super Admin and out-of-scope sessions through the normal secure access handoff. Document checks need existing scoped audience records, exact versions and audit/history/Storage readback; Attendance needs approved Event/Site Shift allocations and permission to create disposable synthetic observed facts, including retry/revocation cases. TFS needs a usable synthetic actor with an existing exact workspace OPERATE grant and approved disposable issue/Person pairs for assignment, reassignment, clear and persisted history refresh. The prior report records invalid stored Office credentials; no credential reset or new grant is authorized. Confirm browser access to the authenticated shell for 390px/desktop review and David’s human acceptance. These are outstanding acceptance dependencies, not requests to use real Dumfries data or expand permissions.

## Publication preflight — subsequent authorization

David authorized pushing the finished bounded candidate to main. The coordinator is sole publication owner and the second worker froze all handed-off files. A fresh independent read-only review found no new blocking regression; it identifies whole-shell MySchedule browser coverage as the next bounded local check, separately from this release.

Fresh GitHub connector and normal `git ls-remote` agree main remains `ec463382352fb2bb56eed2d7873eedbd694f9ad6`; open PR search returned none. This baseline has no `.github/workflows` directory, so no repository-defined Actions pipeline can be claimed. The GitHub CLI is not logged in; normal Git read access works. No force push or branch-protection bypass is authorized.

Vercel readback materially supersedes the September staging name: project `prj_4jIvF5zewGzJqWKRukfqr4i7gwU1` is now named `kss-enterprise`, linked to `DavidCapener182/KSSSuperApp`; current Git deployment `dpl_FoHFPwcuEzWNGJWJPxzqT5CZMoRJ` is Ready, `target=production`, ref main and SHA ec46338. Its aliases include `kss-enterprise.vercel.app`; SSO remains enabled on all deployments. A main push therefore triggers an application deployment beyond ordinary CI. Holding the remote ref update pending explicit confirmation that this existing Git-triggered Production-target deployment is included in the push authorization. No deployment/security settings were changed.

Read-only Supabase project metadata (canonical `dnfhkmmnlbiabqypclqg` and former staging `kwpgjbxepxuhwxxydaca`) and staging migration-list requests were denied by the connector with “You do not have permission to perform this action”. No SQL read/mutation or permission workaround was attempted. Existing original-root `.env.local` targets the canonical project; `.env.test.local` has nonempty synthetic example.test persona credential fields. Values were not printed or copied. No reusable auth/session JSON handoff was located; the existing helper caches sessions only within a running Node process. The candidate contains no environment file.

Original tracked edits are individually dispositioned in the hunk table and original reconciliation report. All 99 original untracked paths were rechecked present; original HEAD remains e8922da. Older proposal/status/architecture notes and generated artifacts remain in place rather than being silently published as current acceptance. No unrelated source, secret or duplicate TSX is included.

Recommended next genuinely unbuilt feature candidate from the second worker: the existing Trello tasks/workflow MVP (`https://trello.com/c/fBFJ2II7`) can begin with My Work source/status/search filters over the existing authorized `/api/tasks` projection. Existing document/CRM/TFS source composition must be retained. Bound ownership to `work-client.tsx`, a dedicated CSS module, local test and delivery report; verify counts/search only over returned visible records, exact source links, empty/error/clear filters and 390px/desktop keyboard use. No manual document-task completion, new permissions, migrations, automation or HR-02 is implied. Parent owns Trello selection and updates.

The raw generated fixture compiler log remains available locally in the evidence directory, excluded from the source commit because its compiler-emitted indentation fails the repository whitespace check. Screenshots, measurements and source manifests remain included unchanged.

Existing-authorized sign-in availability check: the coordinator attempted canonical-project synthetic Office and Staff A once each, using only existing example.test credentials and the publishable client with in-memory session persistence disabled. Both returned HTTP 400 `invalid_credentials`; no session was established, no credential was retried/reset, and no application record/grant was read or mutated. Authenticated checks are blocked on secure usable synthetic credential/session handoff, independently of the management-connector denial.
