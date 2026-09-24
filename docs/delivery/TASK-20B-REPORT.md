# TASK-20B delivery report — Native Training Catalogue & Course Versioning

**Status:** Accepted by David in synthetic Dev on 24 September 2026 at commit `9ccfd88`. No staging or production changes. TASK-20B is closed; TASK-20C is proposal preparation only.

## Scope delivered

- Stable `training_courses.id` and Course title/summary; version rows contain their own title, summary, audience rule, ordered module/page manifest, SHA-256 content hash, attributable publication and retirement fields. The Course's `current_version_id` alone controls Staff discovery. Publishing v2 does not edit v1. Retirement clears the pointer while preserving the sealed version.
- Separate named `TRAINING_AUTHOR` and `TRAINING_PUBLISHER` grants for active Office Admin Persons. Super Admin grants/revokes and can read attributable grant history. Office membership alone has no Training capability. Guarded operations resolve AuthIdentity → Person and recheck active role/grant.
- Strict block representation (`heading`, `paragraph`, `bullet`, `numbered`, `emphasis`, `callout`), with up to 20 modules, 30 pages/module, 60 blocks/page, 1,500 characters/block, 16,000 bytes/page and 240,000 bytes/package. Published content is React-rendered as text and semantic lists, with no arbitrary HTML or external media.
- Native home entry, Staff catalogue/reader, administrator courses/versions/editor/preview/publish/retire/history, and Super Admin grant controls. External TASK-11A shortcut remains a separate unchanged component. Reading and page navigation make no Training write.
- Clearly synthetic three-module, six-page `KSS Enterprise — Introduction to Event & Site Security` fixture. It is not approved training, qualification, induction or compliance material.

## Target and migration readback

The literal target was checked with `get_project`: **`dnfhkmmnlbiabqypclqg`**, active/healthy in `eu-west-1`. Protected staging `kwpgjbxepxuhwxxydaca` was not accessed or migrated. The Supabase connector recorded the following Dev migrations, with matching source-controlled filenames:

| Remote version | Migration | Result |
| --- | --- | --- |
| `20260924193618` | `training_catalogue_20b` | No-op connector probe, `select 1` |
| `20260924193642` | `training_catalogue_20b_schema` | Course/version/grant/event tables and guarded functions |
| `20260924193719` | `training_synthetic_fixture_20b` | Named synthetic grants and example course |
| `20260924193855` | `training_grant_readback_20b` | Grant oversight and revocation reason |
| `20260924194309` | `training_active_identity_grant_20b` | Active AuthIdentity required for grantee |
| `20260924194753` | `training_course_identity_20b` | Stable Course title/summary and admin projection |

Direct SQL readback showed all four `training_*` tables have RLS enabled, no row policies and no `authenticated` SELECT/INSERT/UPDATE privileges. All 13 public `training_*` functions have `anon` EXECUTE **false**, `authenticated` EXECUTE **true**, and apply role/action checks internally. Supabase's security advisor reported the four no-policy tables as informational and the 13 guarded security-definer functions as warnings; these are the intentional deny-direct-table/guarded-RPC pattern. The functions use fixed empty search paths and database authority helpers.

The fixture readback was Course `a1281dad-af8d-4ec0-af19-dad8f43eea7c`, current v1 `439b4d86-a348-40aa-841b-f757a340fd8a`, 3 modules/6 pages, audience `ACTIVE_SECURITY_STAFF_V1`, hash `f3c359a82734cef99d990b59dd255f06e171fd0a4e7372dbc2ac238ef2edf4ec`. Recalculated database SHA-256 matched. A direct privileged SQL attempt to update the published title failed with `Published version immutable`; subsequent title/hash readback was unchanged.

## Behaviour and negative-access checks

`node --env-file=.env.local --env-file=.env.test.local --test tests/training-20b.test.mjs` passed (1/1). It covered unauthenticated denial; Staff and Office direct table denial; Staff/Operations/ungranted Office administration denial; Staff/Operations draft invisibility; finite Author-only grant versus Publisher denial; Super Admin grant/revocation readback and immediate revoked-author denial; invalid block and oversized page rejection; stale edit/publish rejection; parallel publish with exactly one winner; repeat publish rejection with one publication event; v1 content/hash/time unchanged after v2; one current Staff version; reasoned retirement with historical readback; and guessed course ID yielding an empty catalogue. A separate browser-created draft was explicitly abandoned and read back as `ABANDONED`.

A failed publish or edit produced no half-published version. Publication/supersession/retirement events contain actor, time, version and small metadata, without copied page content. Historical Staff access tied to future assignments/attempts remains for 20C+.

## Build and regression

An isolated copy under `/tmp/kss-task-20b-preview` was built with the installed Node and Next.js 16.3.6 using `node node_modules/next/dist/bin/next build --webpack`: compilation, TypeScript, page generation and route collection passed; `/training`, `/training/[courseId]`, `/training-admin` and `/api/training` were present. The build was repeated after the final text-list renderer change and passed. Targeted ESLint for 20B source passed. `tests/external-apps.test.mjs` passed 4/4; the return-target case in `tests/shell.test.mjs` passed 1/1, including the new Training paths. The external shortcut's source/configuration was not modified. Direct readback of both Core KSS Induction requirement definitions remained `NOT_CONNECTED`. No TrainingAssignment, enrolment, progress, Attempt, score, Completion, certificate, training matrix, credential or eligibility table/function was created.

The shared checkout's ordinary `tsc --noEmit` encountered duplicate generated `.next/types` files while parallel lanes ran builds; a temporary source-only TypeScript config passed before unrelated in-progress 22B files appeared. Subsequent source-only TypeScript reported missing/incomplete 22B files, while the isolated final production build passed. The temporary config was removed. A broad regression suite was not run against the shared Dev fixture while other approved lanes were active; the focused Training, external shortcut and return-target checks above are the actual executed regressions. David accepted this as a known evidence limitation; it does not reopen the accepted 20B architecture.

## Authenticated browser evidence

An isolated local production server was checked with synthetic credentials through Playwright. Screenshots are stored under `output/playwright`:

| Persona / viewport | Observed |
| --- | --- |
| [Staff desktop](../../output/playwright/task-20b-staff-desktop.png) | Synthetic Staff B saw only the current published example course in the catalogue. |
| [Staff 390px](../../output/playwright/task-20b-staff-390.png) | Single-column page content preceded the module outline; 390px document/viewport widths matched, page targets measured 44–45px, and focus styling is defined. |
| [Office desktop](../../output/playwright/task-20b-admin-desktop.png) | Synthetic Office Admin saw versions, exact hash, draft/editor/history controls and the stable Course label. |
| [Office 390px](../../output/playwright/task-20b-admin-390.png) | Admin page rendered without horizontal overflow (390px document/viewport). |

The Office browser created a v3 draft, showed the draft editor and preview; it was later abandoned through the guarded RPC. Staff direct `/training-admin` showed “Access unavailable” with no draft title/content or editor. The Home browser showed the separate native learning cards and the existing external Training card still labelled “Link not configured”. No green styling was introduced in 20B-owned UI.

## Tooling and acceptance boundary

`/usr/bin/git` invoked the local Xcode licence check. All Git work used `/Library/Developer/CommandLineTools/usr/bin/git`; Node/npm/npx were available under `/Users/davidcapener/.local/bin`. No Xcode licence, installation, global developer directory or machine configuration was changed. An isolated preview build avoided the shared `.next` directory.

No live KSS data, external Training provider, SSO, import, controlled DocumentVersion link, Staff learning result, staging or production deployment was added. David accepted TASK-20B only. Assignment, progress, assessment, completion and all later Training work require separate bounded approval.
