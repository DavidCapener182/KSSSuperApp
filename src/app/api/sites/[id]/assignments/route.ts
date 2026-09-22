import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageSite, SITE_COLUMNS, type Site } from "@/lib/sites/policy";

export async function GET(_request: Request, { params }: RouteContext<"/api/sites/[id]/assignments">) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const { data: site, error } = await client.from("sites").select(SITE_COLUMNS).eq("id", id).maybeSingle<Site>();
  if (error || !site) return notFound();
  if (!canManageSite(principal, site)) return forbidden();
  const { data, error: assignmentError } = await client.from("site_assignments")
    .select("id,person_id,effective_from,effective_until,revoked_at,granted_by,change_reason")
    .eq("site_id", id).order("created_at", { ascending: false });
  if (assignmentError) return privateJson({ error: "Unable to load assignments" }, 500);
  return privateJson({ assignments: data });
}
