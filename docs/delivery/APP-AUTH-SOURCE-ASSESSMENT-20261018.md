# Application authentication source assessment

Reviewed published commit 7d8b3d2432943a57f17fdf175e7ae3f916ef2f21, read-only; no hosted request, setting change or credentials used.

The normal application entry is `/`: src/app/page.tsx:4–6 delegates to SignInEntry after safe local return-target validation. SignInEntry:21–38 calls Supabase auth.getUser/signInWithPassword and requires successful /api/me before entering /app or the validated requested route. The Vercel account login is upstream and is not the app login.

EnterpriseLayout (src/app/(enterprise)/layout.tsx:11–17) rejects non-active access and redirects to local sign-in. getEnterpriseAccess (src/lib/auth/principal.ts:13–47) validates auth.getUser, active provider-to-Person mapping, database-authoritative current/unrevoked recognised roles, and an existing Person. Unmapped/no-role/unavailable conditions do not produce a principal. Reviewer rights are separately projected by incident_current_access. JWT user metadata is not the role authority.

Static enumeration found 75 business page files, each with getPrincipal/getEnterpriseAccess or the guarded workspaceClient helper, and 144 API routes containing 193 exported HTTP functions. Every function has a direct principal/access call and a principal/access-state conditional guard. This is a source inventory, not proof of every control-flow or role/scope branch. /api/me:7–10 returns401 without authentication and403 without active Enterprise access. Example report role gate: api/management-reports/route.ts:9–12; Super management: api/client-workspaces/manage/route.ts:5–6. Workspace/issue scope is delegated to existing cw_* RPCs after principal validation (client-workspaces/server.ts:7–29; issue PATCH:5–13). File examples require principal plus publisher/owner or assignment access before storage download. Server/browser Supabase factories use the public publishable key plus cookie session; no service-role key usage was found in src.

Limits before exposing the normal production entry:
- The proxy refreshes sessions; it is not a universal deny gate (src/proxy.ts:32–55). Page/API guards and database permissions remain necessary.
- Hosted RPC/RLS/Storage policies and session behavior have not been revalidated; previous denials remain. Authenticated hosted acceptance is still open.
- `/staging-access` is a separate publicly rendered synthetic recovery utility. Its actions require the dedicated environment/project, a valid recovery code and exact synthetic account session; the environment check itself is client-side. It should not be mistaken for normal sign-in. No bypass code or password is embedded.
- CSP and robots/noindex are conditional on the internal staging flag (proxy:6–25, next.config.ts:10–12, app/robots.ts). This labeling fix leaves those safety behaviors and all deployment/database configuration unchanged.

No full security acceptance, permission audit or approval to alter protection is asserted. The parent owns the separately authorised production-only Vercel protection scope change.
