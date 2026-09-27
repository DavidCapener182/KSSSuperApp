import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) return forbidden();
  const { id } = await params;
  const changeId = new URL(request.url).searchParams.get("changeId");
  if (!isUuid(id) || !changeId || !isUuid(changeId)) return privateJson({ error: "Invalid exact change" }, 400);
  const { data, error } = await client.rpc("service_change_application_candidate", { p_delivery: id, p_change: changeId });
  return error ? privateJson({ error: "Candidate source event unavailable or access denied" }, 404) : privateJson(data);
}
