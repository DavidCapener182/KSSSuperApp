import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageSite, SITE_COLUMNS, type Site } from "@/lib/sites/policy";

export async function GET(_request: Request, { params }: RouteContext<"/api/sites/[id]/history">) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const { data: site, error } = await client.from("sites").select(SITE_COLUMNS).eq("id", id).maybeSingle<Site>();
  if (error || !site) return notFound();
  if (!canManageSite(principal, site)) return forbidden();
  const { data, error: historyError } = await client.from("audit_events")
    .select("id,actor_person_id,entity_type,entity_id,action,before_value,after_value,reason,occurred_at")
    .eq("site_id", id).order("occurred_at", { ascending: false });
  if (historyError) return privateJson({ error: "Unable to load history" }, 500);
  return privateJson({ events: data });
}
