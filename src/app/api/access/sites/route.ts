import { parseAssignment } from "@/lib/auth/assignment";
import { getPrincipal, hasRole } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageSite, SITE_COLUMNS, type Site } from "@/lib/sites/policy";

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const superAdmin = hasRole(principal, "SUPER_ADMIN");
  if (!superAdmin && !hasRole(principal, "OFFICE_ADMIN")) return forbidden();
  const input = parseAssignment(await request.json().catch(() => null), "site");
  if (!input) return privateJson({ error: "Invalid assignment" }, 400);
  const { data: site, error: siteError } = await client.from("sites").select(SITE_COLUMNS)
    .eq("id", input.siteId!).maybeSingle<Site>();
  if (siteError || !site) return notFound();
  if (site.status !== "ACTIVE") return privateJson({ error: "Site is not active" }, 400);
  if (!superAdmin) {
    if (!canManageSite(principal, site) || input.personId === principal.personId) return forbidden();
    const { data: allowed, error: coverageError } = await client.rpc("can_delegate_site_assignment", {
      target_person: input.personId, target_site: input.siteId,
      period_start: input.effectiveFrom, period_end: input.effectiveUntil,
    });
    if (coverageError || !allowed) return forbidden();
  }
  const { data, error } = await client.from("site_assignments").insert({
    person_id: input.personId, site_id: input.siteId,
    effective_from: input.effectiveFrom, effective_until: input.effectiveUntil,
    granted_by: principal.personId, change_reason: input.reason,
  }).select("id").single();
  if (error) return privateJson({ error: "Assignment could not be saved" }, 400);
  return privateJson({ id: data.id }, 201);
}
