import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const operational = ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"];
const administrative = ["SUPER_ADMIN", "OFFICE_ADMIN"];
const serviceTypes = ["STATIC_GUARDING", "GATEHOUSE", "RETAIL_SECURITY", "PATROL", "RECEPTION_SECURITY", "OTHER"];
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const plain = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);

export async function GET(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((role) => operational.includes(role))) return forbidden();
  const site = new URL(request.url).searchParams.get("site");
  if (!site || !isUuid(site)) return privateJson({ error: "Invalid Site" }, 400);
  const { data, error } = await client.rpc("site_services_list", { p_site: site });
  return error ? privateJson({ error: "Services unavailable" }, 503) : privateJson({ services: data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((role) => administrative.includes(role))) return forbidden();
  const body = await request.json().catch(() => null);
  if (!body || !isUuid(body.siteId) || !isUuid(body.ownerId) || !plain(body.name, 180) ||
    !serviceTypes.includes(body.type) || !date(body.effectiveFrom))
    return privateJson({ error: "Invalid Service" }, 400);
  const { data, error } = await client.rpc("site_service_create", { p_site: body.siteId, p_name: body.name.trim(),
    p_type: body.type, p_effective_from: body.effectiveFrom, p_owner: body.ownerId });
  return error ? privateJson({ error: "Service could not be created" }, 400) : privateJson({ id: data }, 201);
}
