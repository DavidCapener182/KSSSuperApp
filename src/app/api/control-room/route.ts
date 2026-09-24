import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((role) => ["OPERATIONS", "OFFICE_ADMIN", "SUPER_ADMIN"].includes(role))) return forbidden();
  const params = new URL(request.url).searchParams;
  const source = params.get("source") || null;
  const site = params.get("site") || null;
  const offset = Number(params.get("offset") ?? 0);
  if ((source && !["EVENT", "SITE_SHIFT"].includes(source)) || (site && !isUuid(site)) ||
      !Number.isInteger(offset) || offset < 0 || offset > 1000) return privateJson({ error: "Invalid Control Room filter" }, 400);
  const { data, error } = await client.rpc("control_room_snapshot_13a", {
    p_source: source, p_site: site, p_offset: offset, p_limit: 30,
  });
  return error ? privateJson({ error: "Control Room unavailable" }, 503) : privateJson({ snapshot: data });
}
