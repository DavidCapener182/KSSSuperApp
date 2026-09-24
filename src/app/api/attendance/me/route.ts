import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const params = new URL(request.url).searchParams;
  const offset = Number(params.get("offset") ?? "0");
  const allocationId = params.get("allocationId");
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000 ||
    (allocationId !== null && (!isUuid(allocationId) || offset !== 0))) {
    return privateJson({ error: "Invalid attendance selection" }, 400);
  }
  const { data, error } = await client.rpc("my_event_attendance", {
    p_offset: offset, p_limit: 25, p_allocation_id: allocationId,
  });
  return error ? privateJson({ error: "Attendance unavailable" }, 503) : privateJson({ attendance: data });
}
