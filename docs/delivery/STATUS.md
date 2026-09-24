# KSS build status

Updated: 24 September 2026
Current stage: TASK-06C Deployment & Staff Allocation accepted at `ce28b70`; TASK-07A Staff Availability implemented in synthetic development, pending David's review. TASK-03G protected synthetic staging remains unchanged; independent phone access and personal UX review remain pending credential handoff.
Current authorised work: TASK-07A only. Phase 07B Workforce Schedule / Rota requires separate approval.

Phase 00: planning reviewed. Phase 01: TASK-01A through TASK-01D accepted. Phase 02: TASK-02A through TASK-02C accepted. Phase 03: TASK-03A through TASK-03G accepted; synthetic Staff credential handoff is deferred until David is at his desktop. TASK-04A, TASK-04B, TASK-05A, TASK-05B, TASK-06A, TASK-06B and TASK-06C are accepted. 07A is implemented in development only.
First target: Phases 01–04 internal workflow, subject to Phase 00 decisions and release gate for live pilot.

## Most recent executed tests
See `TASK-07A-REPORT.md` for the clean install, Webpack build, focused availability checks and the precise regression/browser limitations. Webpack remains the build path.

## Current boundary
Development remains on dedicated Supabase project `dnfhkmmnlbiabqypclqg`. Separate `KSS Enterprise - Staging` project `kwpgjbxepxuhwxxydaca` has 39 source-controlled migration entries, four synthetic Auth/Person/role records and a clean synthetic Staff A V2 onboarding case. The separate Vercel project `kss-enterprise-staging` has Vercel Authentication on **All Deployments**, five staging-only environment variables, Next.js preset and GitHub `staging` branch deployment. Its stable alias `https://kss-enterprise-staging-capener182-gmailcoms-projects.vercel.app` redirects unauthenticated visitors to Vercel SSO. Staging Supabase Auth redirects and signed-in Staff, Office, Super Admin and Operations browser journeys were checked. Staging Staff A displays 5 of 6 after normal Personal Details, RTW, SIA, Identity Evidence and controlled Terms workflows. Induction remains `NOT_CONNECTED` and the case remains `IN_PROGRESS`. The existing `kss-super-app` project has no successful deployment. No live KSS data, Entra, SharePoint, LMS, SIA register or production app was added. See `TASK-03G-REPORT.md` for evidence, access handoff and remaining gates.

## Next recommended action
David reviews TASK-07A. The next separately approved slice should be Phase 07B Workforce Schedule / Rota, composing Event demand, allocations, Staff response and declared availability without inventing attendance or payroll. A separate test-engineering follow-up should reduce Supabase Auth throttling and investigate the controlled-document fixture denial. The synthetic Staff password handoff remains separate. The LMS provider/interface is still unknown. Onboarding and synthetic SIA staffing checks do not establish identity, legal compliance or live operational eligibility.
