# Real starter and Site setup — 27 September 2026

David asked for real Site and new-starter entry, with a local preview before application deployment. This work replaces the two-step synthetic starter form with one Super Admin action that creates a Person, Security Staff role and draft onboarding case in one database transaction. A Site is optional company-onboarding context; it does not grant Staff Site access. A Super Admin can attach an active Site while the case is a draft and then start the case. Personal submissions remain Staff-owned, and the checklist still does not perform statutory Right to Work, SIA register or deployment checks.

## Source and database

- Forward migration `20260927204828_real_staff_starter_registration.sql` is applied to the Development Supabase project `dnfhkmmnlbiabqypclqg` as remote version `20260927204828`. It adds a deny-by-default idempotency table; audited Super Admin team ownership; transactional starter and case registration; a one-time draft Site-context attachment; and removal of the fixed synthetic Site-name restriction from case creation. Existing Office-owned case gates remain.
- Existing Site create/activate APIs and RLS already support Super Admin. No Site schema change was needed. The current database contains zero Sites, zero onboarding cases and zero onboarding teams; it contains only the existing Super Admin Person. No real Person or Site was created by this task.
- The local application uses this database and runs at `http://127.0.0.1:3000`. Application code and copy remain on the local `codex/super-admin-manager-access` branch for David's review. No application deployment was made.

## Verification

- A single rolled-back authenticated Super Admin transaction created an active test Site, created an idempotent company-onboarding case, attached the Site to the draft, started that case, and created another case with Site context at registration. All six checklist requirements were present and `get_onboarding_case_access` returned the correct starter and company-onboarding context.
- A rolled-back authenticated request without an Enterprise Person was denied. `anon` has no execute privilege on the starter RPC, and authenticated users have no direct read privilege on the idempotency table.
- Post-rollback readback: zero Sites, zero onboarding cases, zero starter requests and zero onboarding teams; one pre-existing Person.
- Security advisor readback showed the new idempotency table as RLS enabled with no policy, intentionally denying direct table access. Other advisor findings predate this migration.
- Next.js 16.3.6 Webpack production build, TypeScript, focused ESLint and `git diff --check` passed. Signed-in local browser readback showed **Add to onboarding** with one name field and optional Site context, and **Add a Site** with the draft form. No persistent browser write was made.

## Remaining boundary

The draft case can be managed by Super Admin. Giving a new starter their own sign-in requires an explicit AuthIdentity connection and credential handoff; this action does not send an invitation or complete a personal attestation. Existing evidence and verification actions retain their own source-specific rules and must be reviewed before live compliance use. David has not yet accepted or requested application deployment of this preview.
