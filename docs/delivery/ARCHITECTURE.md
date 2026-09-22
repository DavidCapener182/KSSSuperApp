# Phase 00 architecture recommendation

Status: updated 22 September 2026. TASK-01B now implements the identity and scoped access proof in the dedicated development Supabase project. Wider platform architecture remains a recommendation.

## Repository facts

- The GitHub repository was empty when cloned. The local tree now contains a default Next.js 16.3.6 App Router, React 19.2.8, TypeScript and Tailwind 4 starter, with npm dependencies installed.
- `src/app/page.tsx` is a synthetic sign-in/access proof. The six-table TASK-01B schema, API routes, RLS policies and access tests are recorded in `TASK-01B-REPORT.md`.
- The TASK-01A shell has a committed baseline. No live KSS data or production deployment is connected.

## Recommended shape

Keep Next.js/TypeScript. Vercel is the preferred hosting platform, Supabase PostgreSQL the preferred structured store, Supabase private Storage the preferred new application file store, and Supabase Auth the preferred frontline/staff identity foundation. Office Entra sign-in remains an option. These are approved directions, not provisioned services. Keep Person separate from AuthIdentity, with stable Person IDs when an authentication provider changes. Put authorisation in a shared server policy layer, enforce it again at database/file boundaries, and audit consequential actions. Reuse shared client, staff, site and event records across modules.

Use explicit adapter contracts for SharePoint/documents, the existing LMS, PARiM/rostering, Footasylum Audits, MagSecure and finance systems. A launch link can precede integration only when its owner and URL are verified. Each adapter needs a source-of-truth decision, stable external IDs, freshness, retry and reconciliation handling. Do not copy private source data into the starter app to accelerate UI work.

## Trust and data boundaries

| Boundary | Required rule | First proof |
|---|---|---|
| Browser to server | Authenticate each request; never trust route IDs or hidden navigation | Anonymous and altered-ID denial |
| Server to records | Role + action + scope, dated assignments, deny by default | Office versus employee record tests |
| Records to files | Classify and authorise each version at retrieval; link does not grant access | Private HR file linked to site stays private |
| Server to integrations | Server-held credentials, approved fields/direction, provenance and stale state | Synthetic adapter contract test before live access |
| Records to search/export/AI | Apply source permissions before indexing/retrieval and before output | Cross-site and cross-client denial |
| Operations to finance | Keep attendance, approved payable and approved billable values separate | Reproducible approved-hours example later |

## Decisions and dependencies

Immediate Phase 01 decisions: pilot users/roles and scope, identity provider and account ownership, relational data store/hosting, and an accountable owner for access review. Document storage is needed before Phase 02. LMS provider/capability is needed for Phase 03; manual status may be a labelled interim route if approved. PARiM/rostering and finance providers can wait for their respective phases. Retention, legal eligibility and payroll rules need KSS policy owners before implementation; none are inferred here.

Phase 11 release evidence applies to the selected early pilot as well as later releases. A local runnable app is not a release gate.
