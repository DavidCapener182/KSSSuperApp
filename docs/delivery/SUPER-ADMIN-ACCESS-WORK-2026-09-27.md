# Super Admin access work — 27 September 2026

David clarified that Super Admin should manage and view work across the app, while Staff personal attestations remain owner-only. This supersedes the first UI-only onboarding proposal, which was reverted before any push.

## Published reproduction

At `https://project-2hiwc.vercel.app/onboarding`, the signed-in David Capener Super Admin workspace showed “Start a starter case”. Clicking it opened `/onboarding/new`, which rendered the application's 404. The route exists in source: its server page denied anyone without `OFFICE_ADMIN`; the creation API and guarded database function also required Office Admin.

## Local onboarding change

The new page allows an active Super Admin. The create form requires an explicit onboarding team and active Office case owner. A separate guarded function creates the case with the Super Admin as attributable creator and the selected Office member as owner. It retains exact synthetic Site, active Staff SiteAssignment, active Staff role, published template, six requirements, idempotency and audit checks. The Office Admin path is unchanged. A narrow target-list function filters Staff by the selected Site. No Staff personal submission or acknowledgement action is delegated.

Focused ESLint and a Webpack production build with synthetic build-only environment placeholders passed. The source-controlled SQL parsed inside a rolled-back transaction on the synthetic Development Supabase project; readback confirmed the new function was absent afterward. No persistent migration has been applied. The published synthetic database currently has zero onboarding teams, zero active Office team owners and zero active `Synthetic Static Security Site` records, so a real case creation cannot be exercised without explicit synthetic setup.

## Wider access boundary

The current capability map already gives Super Admin most manager navigation. A source scan found additional Office-only checks in onboarding creation, credential evidence requests, some Asset holder/stock actions, controlled publication, and source-specific database functions. Self routes for profile submission, acknowledgement, attendance and worked time remain owner-only by David's instruction. A global role alias would blur those boundaries and has not been applied. Each manager read/write surface, RLS policy, Storage byte route and guarded function needs a domain-specific audit and negative proof before calling whole-app Super Admin access complete.

Examples verified in source: `POST /api/credentials` `requestEvidence` requires `OFFICE_ADMIN`; `GET /api/assets?holders=1` requires Office or Operations; `POST /api/assets` starts several management actions from an `office` boolean; `GET /api/operational-documents/context-status` requires Operations. Their database functions have independent guards, so changing route checks alone would not grant reliable access. These are inventory findings, not completed fixes.

No branch push, production deployment, or hosted postflight is recorded in this report.
