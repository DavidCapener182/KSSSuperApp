# TASK-UI10 Home and My Work report

## Scope and result

Implemented a role-specific Home using the existing server-derived principal and `navigationFor` permissions. Staff see duty, deployment, attendance, worked-time, availability, requests, evidence, credential, equipment and learning entry points. Office and Operations see their existing operational and coordination destinations. A final section keeps other authorised navigation routes reachable. The source screen remains responsible for its own records, state, actions and permission check. Home claims no combined task state or cleared-work result.

The existing `/work` route remains the narrower Task service for assigned document reviews and CRM follow-ups. Its description and empty states now explicitly name that scope. No Task rows or source records are changed.

## Contracts and permission boundaries

Home derives primary links from `navigationFor(principal)`. Attendance and credentials are exposed to Security Staff through their existing route guards; credentials also performs its own scoped read. Learning links retain the existing training capability RPC checks. No summary counts, private record fields, new reads, backend aggregate, notification source, or cross-domain action was added. Entry descriptions distinguish allocation, attendance, worked time, evidence and verification. Training page reading is not represented as completion.

A permission-aware cross-module read is still needed for a real “needs action now” feed with source, age and safe next action. It should be specified per source with record-scope checks and independent errors; current Home deliberately has no such feed. Notification data was not found as an authorised Home read contract in this baseline.

## Checks

- Base HEAD and clean worktree verified before edits; branch `task-ui10-home-work`.
- Read AGENTS, status, decisions, UI01 product inventory, competitive research, journey audit, design-system audit and roadmap, Next 16 layouts/pages and Link guides, and existing navigation/Task contracts.
- `next typegen` passed; `tsc --noEmit` passed after generation; focused ESLint passed; `git diff --check` passed.
- Smoke test could not start its local server: sandbox returned `listen EPERM` on `127.0.0.1`. No authenticated desktop, 390px or keyboard browser claim is made. CSS has a one-column rule at 480px, minimum 44px card target, wrapping text and focus-visible outline, but these remain implementation checks, not observed browser evidence.

## Limitations

No live or synthetic data was written. UI02 shell, navigation and shared components remain unchanged. The accepted source routes retain their own loading, empty, error and server readback behaviour; this UI-only Home does not restate those states. Authenticated desktop/390px/keyboard review is required in an environment that permits a local server or a deployed synthetic preview. No production readiness or human acceptance is claimed.

## Authenticated production-build browser close-out — 25 September 2026

David approved final verification only. No implementation files were changed in this close-out. The production Webpack build passed and `next start` served the built app on localhost with the existing synthetic Development configuration. Four existing synthetic personas signed in through the normal browser form; no role or grant was changed. Screenshots are retained under `docs/ui/evidence/ui10/`.

| Persona | 1440px Home | 390px Home | Route/authority check |
|---|---|---|---|
| Security Staff A | “My day” shows Schedule, Deployments, Attendance, Worked Time, Availability, Action Centre, Time Away, Onboarding, Documents, Credentials, Equipment and learning links where available. | One-column cards; 390px document width; 120px smallest Home card height. | Enter on My Attendance card reached `/my-attendance` without a not-found screen. Direct `/crm` denied with 404. |
| Office Admin | Operational and coordination sections include Workforce, Events, Time Away, assigned Task work, Mobilisations, Service Delivery, Onboarding and Documents; more authorised areas include People, CRM, Sites, reports and Assets. | One-column cards; 390px document width; 120px smallest Home card height. | Enter on Workforce card reached its independently authorised route. `/work` loaded source-backed document reviews and CRM follow-ups. |
| Operations | Control Room, Workforce, Events, Time Away and other permitted operational links appear; CRM, Mobilisations, Service Delivery, Documents, Office Work and training administration do not appear. | One-column cards; 390px document width; 120px smallest Home card height. | Enter on Control Room card reached its independently authorised route. Direct `/crm` denied with 404. |
| Super Admin | Broad authorised operational and coordination destinations, including reports, review and training administration, appear. | One-column cards; 390px document width; 120px smallest Home card height. | Enter on Management Reports card reached its independently authorised route. `/work` loaded source-backed document reviews and CRM follow-ups. |

The browser reported no horizontal document overflow at 1440px or 390px for each Home; Office and Super Admin `/work` also had no overflow at 390px. Home used the system font stack. Keyboard Tab focused a link with a solid visible outline, and Enter activated representative Home cards for all four personas. The full Home card was the link; measured minimum card height was 152px at desktop and about 120px at 390px. Long text wrapped within card width. Screenshots show blue, graphite and neutral styling without green status treatment. The integration base used for this batch did not contain UI02's accepted shared shell changes; UI10 did not edit shared UI.

`/work` remained a separate Task-service view with explicit wording for document reviews and CRM follow-ups. Office and Super Admin synthetic fixtures were populated (269 and 244 visible cards respectively on this read). The existing fixtures did not provide an empty Task state for these personas, so empty-state wording was code-reviewed but not authenticated-browser observed. Work's loading skeleton and settled populated view were observed separately; no source action was performed. These fixture volumes make the page long, but changing pagination or Task data is outside this verification-only close-out.

Staff Home wording keeps deployment response, attendance, worked time, availability, Time Away, document evidence, credential verification and training progress distinct. It makes no due, complete, overdue, cleared or eligibility claim. Each source route retains its own authority and current readback. The UI does not combine their state.

### Deferred read contract — separate architecture/security approval required

A future “Needs attention” layer could consume individual permission-aware source projections containing typed source, stable source record ID, safe label/context, factual action required, relevant source-recorded/effective time, safe next-action link, current actor scope, and an independent unavailable/error state per source. It must not infer urgency, priority, risk or completion from UI labels or create a universal Task ledger. It must exclude private Incident narrative, Time Away reasons, contact values, credential evidence and other restricted fields. UI10 does not implement this feed.

## Formal acceptance and close-out

**TASK-UI10 — ACCEPTED AND CLOSED — SYNTHETIC DEVELOPMENT — 25 September 2026.** David accepted the bounded implementation and authenticated browser close-out. The unavailable `/work` empty-state browser fixture is an accepted evidence limitation, not a passing test; no Task records were created or deleted to manufacture it. The populated Office and Super Admin views were observed against existing source-backed Tasks.

Home remains an authorised doorway into existing source workflows. It is not a universal Task ledger and does not infer due, overdue, complete, urgent or cleared state. `/work` remains the narrower source-backed Task service for its actual Task types. Deployment response, attendance and worked time remain distinct; availability differs from Time Away; document evidence differs from credential verification; training progress or completion does not establish credential verification or deployment eligibility.

The cross-module “Needs attention” feed remains deferred and requires separate architecture and security approval for a permission-aware source composition contract. UI10 is closed. No staging, production, live-data or subsequent Home/Task feature is authorised by this decision.
