import { getPrincipal, hasRole, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageSite, SITE_COLUMNS, type Site } from "@/lib/sites/policy";

type Assignment = { id: string; person_id: string; site_id: string; effective_from: string; effective_until: string | null; revoked_at: string | null; granted_by: string | null };

export async function PATCH(request: Request, { params }: RouteContext<"/api/access/sites/[id]">) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const superAdmin = hasRole(principal, "SUPER_ADMIN");
  if (!superAdmin && !hasRole(principal, "OFFICE_ADMIN")) return forbidden();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.reason !== "string" || !body.reason.trim() || body.reason.trim().length > 500 ||
    (body.revoke !== true && typeof body.effectiveUntil !== "string")) return privateJson({ error: "Invalid assignment change" }, 400);
  const { data: assignment, error: assignmentError } = await client.from("site_assignments")
    .select("id,person_id,site_id,effective_from,effective_until,revoked_at,granted_by")
    .eq("id", id).maybeSingle<Assignment>();
  if (assignmentError || !assignment) return notFound();
  if (assignment.revoked_at) return privateJson({ error: "Assignment is already revoked" }, 409);
  const { data: site, error: siteError } = await client.from("sites").select(SITE_COLUMNS)
    .eq("id", assignment.site_id).maybeSingle<Site>();
  if (siteError || !site) return notFound();
  if (!superAdmin && (!canManageSite(principal, site) || site.status !== "ACTIVE" ||
    assignment.granted_by !== principal.personId || assignment.person_id === principal.personId)) return forbidden();

  const reason = body.reason.trim();
  const change: { revoked_at?: string; effective_until?: string; change_reason: string } = { change_reason: reason };
  if (body.revoke === true) {
    change.revoked_at = new Date().toISOString();
  } else {
    const until = String(body.effectiveUntil);
    if (!Number.isFinite(Date.parse(until)) || Date.parse(until) <= Date.parse(assignment.effective_from))
      return privateJson({ error: "Invalid assignment period" }, 400);
    if (!superAdmin) {
      const { data: allowed, error: coverageError } = await client.rpc("can_delegate_site_assignment", {
        target_person: assignment.person_id, target_site: assignment.site_id,
        period_start: assignment.effective_from, period_end: until,
      });
      if (coverageError || !allowed) return forbidden();
    }
    change.effective_until = until;
  }
  const { data, error } = await client.from("site_assignments").update(change)
    .eq("id", id).is("revoked_at", null).select("id,effective_until,revoked_at").maybeSingle();
  if (error) return privateJson({ error: "Assignment could not be changed" }, 400);
  if (!data) return privateJson({ error: "Assignment changed; reload before editing" }, 409);
  return privateJson(data);
}
