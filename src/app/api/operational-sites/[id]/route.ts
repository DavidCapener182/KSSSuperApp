import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((role) => ["SUPER_ADMIN","OFFICE_ADMIN","OPERATIONS"].includes(role))) return forbidden();
  const { id } = await params; if (!isUuid(id)) return notFound();
  const { data, error } = await client.rpc("operational_site_detail", { p_site: id });
  return error ? privateJson({ error: "Operational Site unavailable" }, 503) : data ? privateJson({ site: data }) : notFound();
}
