import { getPrincipal, hasRole, isUuid } from "@/lib/auth/principal";
import { notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: RouteContext<"/api/sites/[id]">) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  if (!hasRole(principal, "SUPER_ADMIN")) {
    const { data: assignments, error } = await client.from("site_assignments")
      .select("effective_from,effective_until,revoked_at")
      .eq("person_id", principal.personId).eq("site_id", id);
    if (error || !assignments) return notFound();
    const now = Date.now();
    if (!assignments.some((a) => !a.revoked_at && Date.parse(a.effective_from) <= now && (!a.effective_until || Date.parse(a.effective_until) > now))) return notFound();
  }
  const { data, error } = await client.from("sites").select("id,name").eq("id", id).maybeSingle();
  if (error || !data) return notFound();
  return privateJson(data);
}
