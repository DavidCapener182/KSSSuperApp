import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) return forbidden();
  const { id } = await params; const period = new URL(request.url).searchParams.get("periodId");
  if (!isUuid(id) || period === null || !isUuid(period)) return privateJson({ error: "Invalid exact review selection" }, 400);
  const { data, error } = await client.rpc("service_delivery_source_cards_21c", { p_delivery: id, p_period: period });
  return error ? privateJson({ error: "Source facts unavailable for this exact review" }, 404) : privateJson(data);
}
