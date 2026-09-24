import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const allocationId = new URL(request.url).searchParams.get("allocationId");
  if (allocationId && !isUuid(allocationId)) return privateJson({ error: "Invalid worked-time selection" }, 400);
  const { data, error } = await client.rpc("event_work_time_self_read", { p_allocation: allocationId ?? null });
  return error ? privateJson({ error: "Worked-time records unavailable" }, 503) : privateJson({ workTime: data });
}
