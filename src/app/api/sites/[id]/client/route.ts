import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((role) => role === "SUPER_ADMIN" || role === "OFFICE_ADMIN")) return forbidden();
  const { id } = await params; const body = await request.json().catch(() => null);
  if (!isUuid(id) || !body || !isUuid(body.organisationId)) return notFound();
  const { data, error } = await client.rpc("operational_link_site", { p_site: id, p_organisation: body.organisationId });
  return error ? privateJson({ error: "Site Client link denied" }, 400) : privateJson({ linkId: data }, 201);
}
