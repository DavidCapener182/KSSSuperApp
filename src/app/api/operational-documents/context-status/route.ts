import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("OPERATIONS")) return forbidden();
  const query = new URL(request.url).searchParams;
  const kind = query.get("kind"), id = query.get("id");
  if (!kind || !["SITE", "SITE_SERVICE", "EVENT"].includes(kind) || !id || !isUuid(id))
    return privateJson({ error: "Invalid exact context" }, 400);
  const { data, error } = await client.rpc("operational_document_context_status", { p_kind: kind, p_id: id });
  return error ? privateJson({ error: "Context status unavailable" }, 403) : privateJson(data);
}
