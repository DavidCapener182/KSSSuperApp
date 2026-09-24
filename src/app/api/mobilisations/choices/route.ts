import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) return forbidden();
  const organisation = new URL(request.url).searchParams.get("organisationId");
  if (organisation && !isUuid(organisation)) return privateJson({ error: "Invalid Client" }, 400);
  const { data, error } = await client.rpc("mobilisation_choices", { p_organisation: organisation || null });
  return error ? privateJson({ error: "Mobilisation choices unavailable" }, 503) : privateJson(data);
}
