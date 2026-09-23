# TASK-03F — UI/UX polish and synthetic staging readiness

**Authorised:** David's TASK-03E acceptance and TASK-03F instruction, 23 September 2026. **Boundary:** this task may improve existing product UI, restore the Staff A synthetic fixture through normal Staff/Office application actions, and prepare a staging-readiness review. It may not add another major business module, change onboarding authority/RLS/business state, import live data, or deploy to Vercel.

## Accepted outcome

- Establish an iOS-inspired, shadcn/ui-based blue/graphite/neutral design system with no intentional green anywhere in product UI. Preserve accessible text statuses, role-scoped navigation, usable 390px Staff and Office journeys, and useful desktop information density.
- Apply the system to sign-in, Home, My Work, Office and Staff onboarding, case detail, Profile, Documents/review, controlled Terms and Sites. Capture representative mobile/desktop evidence and document the design standard.
- Restore the existing synthetic Staff A V2 case from the development-fixture 3-of-6 state by explicit Personal Details resubmission, fresh synthetic SIA credential/evidence review and separate Office SIA verification. Preserve immutable history; induction remains not connected and no compliance/deployability conclusion appears.
- Inventory staging environment/auth/headers/access/rollback requirements. Verify clean install, lint, Webpack build, smoke, critical regressions, mobile/browser sanity and staged secrets. Propose Vercel staging only for separate approval.

## Explicit exclusions

No Vercel project or deployment, real personnel data, LMS integration, new HR/module schema, fake completion, direct fixture SQL reset, Entra, SharePoint, SIA register, or production use. Any blocked checks are reported as blocked rather than claimed passed.
