# TASK-20F-A — Training Requirement Foundation & Matrix Pilot

**27 September 2026 · synthetic Development implementation · pending David's product acceptance**

## Approved pilot policy

David explicitly approved these seven starting rules for this synthetic pilot: stable operational duty-role IDs; additive Site and Service applicability; exact CourseVersion matching; Completion is sufficient without a CertificateIssue; no renewal rule; separate named Author, Publisher and Viewer grants; and an earlier Completion counts only when that published requirement opts in. These are **pilot rules, not live KSS policy**.

## Built

- Versioned Training requirements with immutable published rule content and SHA-256 content hash. A reasoned, separately recorded effective end permits a later published version while retaining the earlier bytes and dated interpretation. Drafts do not appear in the matrix. Publishing rejects overlapping intervals.
- Super Admin grants time-limited named Author, Publisher and Service-scoped Viewer access. An Office role alone cannot act; a Super Admin role alone cannot author or publish. Grant/revocation and policy decisions retain actor, time and reason. Base tables have RLS and no direct `anon` or `authenticated` access; guarded authenticated RPCs own reads and writes.
- Staff own-context and named Viewer matrix reads for allocated planned Site Shifts. Rows distinguish `NOT_ASSIGNED`, `ASSIGNED_IN_PROGRESS` and `COMPLETED`, with exact Assignment, Completion, rule-version and optional CertificateIssue references. Completion is the evidence; a certificate is displayed separately. An empty row set means `NOT_APPLICABLE`. The matrix makes no deployability or credential-verification decision.
- Staff and Training Administration pages, plus an authenticated API, to read matrix evidence and manage the pilot versions and grants. The Completion link opens its existing guarded manager route only for an actor with Completion review access.

## Development evidence

Only the dedicated synthetic Development Supabase project `dnfhkmmnlbiabqypclqg` was changed. Applied and read back in its migration ledger:

| Ledger version | Migration | Local SQL SHA-256 |
|---|---|---|
| `20260927162521` | `training_requirement_20fa` | `cc3dc14a625bc2b372f4cda2dc0290ff461b40325a6c894e860a09b1002e0270` |
| `20260927163028` | `training_requirement_asof_20fa` | `e0ef27c1a862218eb0a2472202f4cc774deaaa91709decff3b95da498da1e598` |
| `20260927164001` | `training_requirement_end_20fa` | `6d8fe945b4c2f8b09acf9041bcfab70aa9832197769e29adccec8d88dd6a9fe5` |

Focused authenticated test: **1/1 passed** with Super Admin, Office, two Staff and Operations. It proves draft exclusion, three evidence statuses, exact version, Staff peer and Operations denial, role-only publication denial, grant revocation, effective end, successor publication and earlier-date version stability. It reuses existing synthetic Training evidence and adds no Assignment, Attempt, Completion or CertificateIssue fixture.

Final Dev readback: 10 synthetic requirements, 11 versions, one ended version, 47 events, five RLS-enabled pilot tables, **zero active pilot grants**. Repeated test runs created retained synthetic policy history; counts are evidence of that history, not production content. Type generation, TypeScript, focused lint, Webpack production build and `git diff --check` passed. The new routes appeared in the build. A signed-in Super Admin browser inspection checked the administration page at 390px with no horizontal overflow and 44px buttons before the final end-action addition; the final end-action UI has build and authenticated RPC proof but no second browser readback.

## Boundary and remaining review

Contexts are currently bounded to existing planned Site Shift allocations and a short pilot window. There is no Event requirement context. A past matrix date is evaluated against currently retained allocation state; if that source allocation is later cancelled or removed, this pilot does not reconstruct the former historical context. The rule itself and Completion/Assignment facts are date-aware, but this is not a complete historical eligibility record. No live source, staging, production, LMS connection, renewal policy, credential verification or deployment decision was added. Human acceptance and any wider policy remain separate.
