# TASK-UI12 Home dashboard close-out

**Status: ACCEPTED AND CLOSED — SYNTHETIC DEVELOPMENT — 25 September 2026.**

David visually accepted the bounded UI12 Home hierarchy for synthetic Development on 25 September 2026 after reviewing the four final Office and Staff screenshots. The isolated `task-ui12-home-dashboard` branch starts from the combined local preview snapshot `be3fb18` and includes the accepted UI11 shell implementation for the combined visual check. This is not a staging or production deployment.

Home now presents role-aware welcome/date context, three role-specific shortcuts, a distinct Office entry to the existing `/work` Task service, and compact secondary groups. It no longer repeats the shortcut destinations in another card grid or shows the prior "More authorised areas" directory. The UI11 sidebar remains the comprehensive navigation surface. Staff sees schedule/deployment/Action Centre shortcuts plus separate attendance, worked time, availability, Time Away, evidence, credential, equipment and learning entry points. No count, deadline, recent activity, cross-module status, universal Task, backend read or Supabase change was added.

Next route type generation, TypeScript, focused ESLint, production Webpack build and `git diff --check` passed. Authenticated synthetic Office and Staff production-preview captures at 1440px and genuine 390px showed no page overflow, system sans-serif and minimum 44px Home links. A Home link received a visible 3px keyboard-focus outline. The Office Assigned Tasks link opened `/work`, where the existing source-backed document-review and CRM-follow-up records loaded. See [the UI12 report](../ui/TASK-UI12-HOME-DASHBOARD-REPORT.md) and [four final screenshots](../ui/evidence/ui12/).

No shared integration, staging, production, live data or deployment was performed in this lane. Future UI13 visual primitives or a cross-module Home feed require their own compatibility and authority review.

The accepted split is: UI11 provides comprehensive authorised navigation; Home provides prioritised role-specific starting points; `/work` remains the source-backed Task service. A cross-module attention feed needs a separate product and permission-aware read-contract decision. The next visual programme step is a separate integration wave for accepted UI13/UI14 patterns across suitable routes, followed by one whole-product route-tracker reconciliation. UI11/UI12 remain stable during that work.
