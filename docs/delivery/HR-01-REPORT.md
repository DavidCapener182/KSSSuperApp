# HR-01 — HR Hub and Self-Service

## Scope and source

- Starting canonical `main` HEAD: `e8922da9b18effb25c3a525a2d4391c6ff92ccdc`.
- Isolated branch/worktree: `hr-01-hub` at `/private/tmp/kss-hr-01`.
- David accepted the PRODUCT-HR visual direction on 25 September 2026. This implements only the bounded HR-01 entry point and source-supported self-service navigation. It is not acceptance of HR policy publishing, employee relations cases, case permissions, evidence, or deployment.

## Delivered

- Added a guarded `/hr` route and HR navigation under People & Administration.
- Added My HR, Handbook & policies, Forms, and My requests views in the accepted blue, graphite and neutral design language.
- Linked self-service actions only to existing guarded Profile, Time Away, Documents, Training and Credentials routes when the current principal's role or capability permits the link. Each source reauthorises independently.
- Made the unconnected policy and forms catalogues explicit empty states. No example policy is presented as a real KSS policy, and no fake download or acknowledgement is offered.
- Kept private Employee Relations, Disciplinary, investigation, evidence and case administration out of HR-01.

## Owned paths

- `src/app/(enterprise)/hr/page.tsx`
- `src/app/(enterprise)/hr/hr.css`
- `src/lib/auth/capabilities.ts` — HR Hub capability and navigation only
- `src/lib/auth/return-target.ts` — `/hr` only
- `src/components/enterprise-shell.tsx` — HR icon only
- `src/app/(enterprise)/app/page.tsx` — HR entry card only
- `docs/delivery/HR-01-REPORT.md`

No global CSS, Supabase schema, migration, Storage, Auth user, deployment or other task-owned files changed.

## Verification

- `npm run build` passed on Next 16.3.6, including TypeScript and the dynamic `/hr` route.
- Scoped ESLint on changed TypeScript/TSX files passed.
- `git diff --check` passed.
- Authenticated Super Admin browser readback loaded `/hr` on the isolated production build at `http://127.0.0.1:3315/hr`; HR navigation, tabs and self-service links were present.
- Genuine 390px viewport browser readback showed the mobile shell, HR tabs, hero and service cards without visible page overflow. The tab strip scrolls horizontally within its own navigation region.

## Remaining contracts and limits

- Current HR policy/version and approved form catalogues need a separate bounded publisher, audience, exact-version and private-file read contract before any real content appears.
- Office HR dashboard, private cases, named authority, evidence and disciplinary workflow belong to later HR slices and need explicit security design and approval.
- No human acceptance or protected hosted deployment is claimed for this implementation.
