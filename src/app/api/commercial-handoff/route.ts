import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) return forbidden();
  const params = new URL(request.url).searchParams;
  const organisationId = params.get("organisationId");
  const opportunityId = params.get("opportunityId");
  if (!organisationId || !isUuid(organisationId) || (opportunityId && !isUuid(opportunityId)))
    return privateJson({ error: "Invalid commercial context" }, 400);
  const { data, error } = await client.rpc("commercial_handoff", {
    p_organisation: organisationId, p_opportunity: opportunityId || null,
  });
  return error ? privateJson({ error: "Commercial context unavailable" }, 503) : privateJson(data);
}
