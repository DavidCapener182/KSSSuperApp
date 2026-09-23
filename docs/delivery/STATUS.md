# KSS build status

Updated: 23 September 2026
Current stage: TASK-04A People Directory accepted at `d245116`; TASK-04B unified Staff Record implemented and development-verified, pending David's review. TASK-03G protected synthetic staging is accepted; independent phone access and personal UX review remain pending credential handoff.
Current authorised work: TASK-04B only. TASK-05A CRM remains a proposal and requires separate approval. TASK-03E was accepted at `b4b372d`; Phase 02 is closed at `b08b142`.

Phase 00: planning reviewed. Phase 01: TASK-01A through TASK-01D accepted. Phase 02: TASK-02A through TASK-02C accepted. Phase 03: TASK-03A through TASK-03G accepted; synthetic Staff credential handoff is deferred until David is at his desktop. TASK-04A is accepted and TASK-04B implemented in development only; Phase 05 has not started.
First target: Phases 01–04 internal workflow, subject to Phase 00 decisions and release gate for live pilot.

## Most recent executed tests
See `TASK-04B-REPORT.md` for the clean install, Webpack build, Staff Record access checks, Phase 01–04A regressions and browser evidence. Webpack remains the build path; the earlier Turbopack bind issue remains technical debt.

## Current boundary
Development remains on dedicated Supabase project `dnfhkmmnlbiabqypclqg`. Separate `KSS Enterprise - Staging` project `kwpgjbxepxuhwxxydaca` has 39 source-controlled migration entries, four synthetic Auth/Person/role records and a clean synthetic Staff A V2 onboarding case. The separate Vercel project `kss-enterprise-staging` has Vercel Authentication on **All Deployments**, five staging-only environment variables, Next.js preset and GitHub `staging` branch deployment. Its stable alias `https://kss-enterprise-staging-capener182-gmailcoms-projects.vercel.app` redirects unauthenticated visitors to Vercel SSO. Staging Supabase Auth redirects and signed-in Staff, Office, Super Admin and Operations browser journeys were checked. Staging Staff A displays 5 of 6 after normal Personal Details, RTW, SIA, Identity Evidence and controlled Terms workflows. Induction remains `NOT_CONNECTED` and the case remains `IN_PROGRESS`. The existing `kss-super-app` project has no successful deployment. No live KSS data, Entra, SharePoint, LMS, SIA register or production app was added. See `TASK-03G-REPORT.md` for evidence, access handoff and remaining gates.

## Next recommended action
David reviews the TASK-04B implementation and report. The master plan remains the product reference; the agreed next build stream is 05A/05B CRM, then Clients/Sites/Events, each separately approved. The synthetic Staff password handoff is scheduled for a separate return when David is at his desktop. The staging-only temporary `/staging-access` page requires an unissued recovery code and remains behind Vercel Authentication; remove it after handoff. The LMS provider/interface is still unknown. Onboarding does not establish identity, legal RTW/SIA compliance or operational eligibility.
