import { getPrincipal, hasRole, isUuid } from "@/lib/auth/principal";
import { notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: RouteContext<"/api/people/[id]">) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const { id } = await params;
  if (!isUuid(id) || (id !== principal.personId && !hasRole(principal, "SUPER_ADMIN"))) return notFound();
  const { data, error } = await client.from("people").select("id,display_name").eq("id", id).maybeSingle();
  if (error || !data) return notFound();
  return privateJson({ id: data.id, displayName: data.display_name });
}
