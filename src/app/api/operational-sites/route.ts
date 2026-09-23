import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((role) => ["SUPER_ADMIN","OFFICE_ADMIN","OPERATIONS"].includes(role))) return forbidden();
  const q = new URL(request.url).searchParams; const search = q.get("search")?.trim() ?? "";
  const organisation = q.get("organisation"); const type = q.get("type"); const status = q.get("status");
  const offset = Number(q.get("offset") ?? 0);
  if (search.length > 80 || /[\x00-\x1f\x7f]/.test(search) || (organisation && !isUuid(organisation)) ||
    (type && !["STADIUM","VENUE","RETAIL","WAREHOUSE","OFFICE","FESTIVAL_SITE","STATIC_SITE","OTHER"].includes(type)) ||
    (status && !["DRAFT","ACTIVE","RETIRED"].includes(status)) || !Number.isInteger(offset) || offset < 0 || offset > 10000)
    return privateJson({ error: "Invalid Site filter" }, 400);
  const { data, error } = await client.rpc("operational_sites", { p_search: search, p_organisation: organisation || null,
    p_type: type || null, p_status: status || null, p_offset: offset, p_limit: 25 });
  return error ? privateJson({ error: "Operational Sites unavailable" }, 503) : privateJson(data);
}
