# PEOPLE-01 — Onboarding workspace and starter journey

**Revised for David's product review, 25 September 2026. Synthetic Development presentation only. No human acceptance, live data, deployment or production readiness is claimed.** Work was isolated on `people-01-onboarding-journey` from frozen Candidate 1 `4d38aa4cf4457fa90743e0bfc969520d3655b6b5`. The earlier requirement-card implementation was rejected as a product direction; this revision supersedes its presentation conclusions.

## Research to KSS interaction

The [design mapping](../product-review/PEOPLE-01-DESIGN-MAPPING.md) was recorded before the revision. The public vendor pages are workflow comparators, not hands-on vendor tests.

| Research pattern | KSS implementation | Deliberate boundary |
|---|---|---|
| BambooHR visible onboarding tasks and progress | Workspace queue lanes, exact verified/total count, sequenced journey | No inferred readiness or automated completion |
| HiBob person-led context | Starter, role, Site, owner and start date lead the case | Private case access remains case-scoped |
| Rippling clear handoff | Source next actor/action is prominent in board, queue and case | No new task engine or derived case stage |
| Credentially evidence workflow | Protected evidence link plus separate evidence acceptance and requirement verification facts | No legal, identity or current credential conclusion |

## What changed

- `/onboarding` opens on a **factual queue board**: Needs Office, Waiting for Staff, Blocked and My cases. Each lane is an independently guarded existing queue view, previewing at most three records. Counts and full-queue links are source totals, not additive pipeline stages. People and Needs action expose the existing paginated, searchable queue. Active, Office, Staff and blocked counts are separate source facts. Templates are absent because this slice has no supported template browse contract.
- The full queue uses responsive starter cards. The primary action is **Open case**; **Manage case** reveals guarded reassignment and finite cover. On 390px the actions stack, each at least 44px high. The old three small inline controls are gone.
- `/onboarding/[id]` leads with the starter, role, Site, named owner, started/created date and exact verified count. A section selector navigates Overview, Journey, Evidence, Training, Documents and Personal details. The six source requirements stay in immutable order, grouped for reading into Getting started, Evidence checks, and Terms and learning. Group labels are presentation only.
- Current handoffs distinguish Office, Staff and external/source dependencies. Each requirement shows its source state, actor and action. Document evidence state, exact accepted version and separate requirement verification remain distinct. Private submitted details stay in a closed disclosure by default; protected document links retain their independent server checks.
- The legacy induction copy is replaced in presentation: **native KSS Training exists, but this onboarding case has no authorised person-specific Training read or linkage**. No Training result is inferred. The exact future read needs case/person scope, source assignment and version identity, dates/status, and Training permissions before any case linkage. Controlled onboarding terms are described as an exact assigned version; 19A operational documents do not substitute. An attributable activity timeline is absent from the read, so only source timestamps are shown.

No backend, RPC, policy, role, API contract, fixture or business-write logic changed. Existing guarded actions and readback remain the source of truth.

## Review evidence

The Development queue returned HTTP **503** for the real authorised Office queue and its four preview reads during this final check. Accordingly, the varied design review uses **static synthetic browser responses** to the existing client API, with no database write. The case page's existing server access guard was left active and opened an already-authorised synthetic Development case route; the case API response shown in these screenshots is still static synthetic review data. These captures prove rendering and interaction layout only, not source acceptance or live queue correctness.

| Requested view | Static synthetic capture |
|---|---|
| Workspace / factual queue board, 1440px | [Board](../product-review/people-01-evidence/kss-people-01-scenario-board-1440.png) |
| Needs Office | [Needs Office](../product-review/people-01-evidence/kss-people-01-scenario-needs-office-1440.png) |
| Waiting for Staff | [Waiting for Staff](../product-review/people-01-evidence/kss-people-01-scenario-waiting-staff-1440.png) |
| Exact row actions, desktop and 390px | [Desktop](../product-review/people-01-evidence/kss-people-01-scenario-row-actions-1440.png) · [390px](../product-review/people-01-evidence/kss-people-01-scenario-row-actions-390.png) |
| Starter overview, journey, Training and terms | [Case 1440px](../product-review/people-01-evidence/kss-people-01-scenario-case-1440.png) |
| Evidence separation | [Evidence](../product-review/people-01-evidence/kss-people-01-scenario-evidence-1440.png) |
| Workspace and case, genuine 390px | [Board 390px](../product-review/people-01-evidence/kss-people-01-scenario-board-390.png) · [Case 390px](../product-review/people-01-evidence/kss-people-01-scenario-case-390.png) |

The static scenario varied nine starter names, owners, progress counts and next actors. It included an Office review, Staff work, verified SIA requirement, exact terms acknowledgement, Training case-link gap and blocked external dependency. The four board lanes rendered 3, 3, 2 and 3 preview cards respectively, with source-view totals 4, 3, 2 and 9. The case rendered six requirements plus three presentation group headings. At 1440px and 390px, document width equalled viewport width. The 390px Open case and Manage case controls each measured 44px; a focused case section link had a 3px outline.

Focused ESLint, `npm run build` (Next 16.3.6 Webpack compile, TypeScript and static page generation) and `git diff --check` passed. Browser checks used installed Chrome against a local production preview at `127.0.0.1:4175`. The old shared `127.0.0.1:3312` preview has not been updated by this isolated branch. Earlier real-data synthetic browser checks on the previous presentation had shown Staff/Office case access and direct 404 denial for unrelated Office and Operations plus protected document API/file; this revision did not repeat those denial checks during the 503 source period.

## Remaining source gaps

The queue has a last-activity **timestamp** but no attributable event description. The case has no true activity/history feed, no native case-specific Training projection, and no authoritative stage or ready-to-close state. A future contract must specify scoped reads and source-owned status before those can be shown. The 503 source response must recover and be read back before any real queue acceptance. No compliance, pay, deployment or eligibility decision follows from these visuals.
