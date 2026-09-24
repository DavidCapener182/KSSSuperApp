# KSS build status

Updated: 24 September 2026
Current stage: TASK-07A Staff Availability accepted at `7f46f1b`; TASK-07B Workforce Schedule / Rota implemented in synthetic development, pending David's review. TASK-03G protected synthetic staging remains unchanged; independent phone access and personal UX review remain pending credential handoff.
Current authorised work: TASK-07B only. A later workforce or product-review task requires separate approval.

Phase 00: planning reviewed. Phase 01: TASK-01A through TASK-01D accepted. Phase 02: TASK-02A through TASK-02C accepted. Phase 03: TASK-03A through TASK-03G accepted; synthetic Staff credential handoff is deferred until David is at his desktop. TASK-04A, TASK-04B, TASK-05A, TASK-05B, TASK-06A, TASK-06B, TASK-06C and TASK-07A are accepted. 07B is implemented in development only.
First target: Phases 01–04 internal workflow, subject to Phase 00 decisions and release gate for live pilot.

## Most recent executed tests
See `TASK-07B-REPORT.md` for the Webpack build, focused workforce checks and the precise regression/browser result. Webpack remains the build path.

## Current boundary
Development remains on dedicated Supabase project `dnfhkmmnlbiabqypclqg`. Separate `KSS Enterprise - Staging` project `kwpgjbxepxuhwxxydaca` has 39 source-controlled migration entries, four synthetic Auth/Person/role records and a clean synthetic Staff A V2 onboarding case. The separate Vercel project `kss-enterprise-staging` has Vercel Authentication on **All Deployments**, five staging-only environment variables, Next.js preset and GitHub `staging` branch deployment. Its stable alias `https://kss-enterprise-staging-capener182-gmailcoms-projects.vercel.app` redirects unauthenticated visitors to Vercel SSO. Staging Supabase Auth redirects and signed-in Staff, Office, Super Admin and Operations browser journeys were checked. Staging Staff A displays 5 of 6 after normal Personal Details, RTW, SIA, Identity Evidence and controlled Terms workflows. Induction remains `NOT_CONNECTED` and the case remains `IN_PROGRESS`. The existing `kss-super-app` project has no successful deployment. No live KSS data, Entra, SharePoint, LMS, SIA register or production app was added. See `TASK-03G-REPORT.md` for evidence, access handoff and remaining gates.

## Next recommended action
David reviews TASK-07B, then a bounded end-to-end product walkthrough should assess CRM → Client → Site → Event → Staffing Plan → Allocation → Availability → Workforce → Staff self-service before choosing another build stream. The synthetic Staff password handoff remains separate. The LMS provider/interface is still unknown. Onboarding and synthetic SIA staffing checks do not establish identity, legal compliance or live operational eligibility.

## TASK-15A acceptance

David accepted the Asset, Stock & Custody foundation in synthetic Dev on 24 September 2026 at `45f75f1`. See [TASK-15A-REPORT.md](TASK-15A-REPORT.md). The accepted ledger remains independent of attendance, worked time, payroll and fault findings. Pagination, uniform picker, kits, scanning and narrow Mobilisation/Site Book/Control Room links are backlog; no staging, production or real KSS asset import is authorised.
