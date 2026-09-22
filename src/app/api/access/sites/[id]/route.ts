import { getPrincipal, hasRole, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(_request: Request, { params }: RouteContext<"/api/access/sites/[id]">) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!hasRole(principal, "SUPER_ADMIN")) return forbidden();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const { data, error } = await client.from("site_assignments")
    .update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null)
    .select("id").maybeSingle();
  if (error || !data) return notFound();
  return privateJson({ id: data.id, revoked: true });
}
