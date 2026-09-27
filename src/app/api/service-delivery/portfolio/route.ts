import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const views = new Set(["all", "mine", "reviews_due", "actions_overdue", "meetings_upcoming", "changes_awaiting"]);
const states = new Set(["PROPOSED", "ACTIVE", "CLOSING", "CLOSED", "CANCELLED"]);
const date = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) return forbidden();
  const q = new URL(request.url).searchParams;
  const view = q.get("view") || "all";
  const owner = q.get("owner") || null;
  const state = q.get("state") || null;
  const from = q.get("from") || null;
  const to = q.get("to") || null;
  const offset = Number(q.get("offset") || "0");
  const clientName = q.get("client")?.trim() || null;
  const siteName = q.get("site")?.trim() || null;
  const serviceName = q.get("service")?.trim() || null;
  if (!views.has(view) || (owner && !isUuid(owner)) || (state && !states.has(state)) ||
    (from && !date.test(from)) || (to && !date.test(to)) || (from && to && from > to) ||
    !Number.isInteger(offset) || offset < 0 || offset > 10000 ||
    [clientName, siteName, serviceName].some(value => value && value.length > 80))
    return privateJson({ error: "Invalid portfolio selection" }, 400);
  const { data, error } = await client.rpc("service_delivery_portfolio", {
    p_view: view, p_client: clientName, p_site: siteName, p_service: serviceName,
    p_owner: owner, p_state: state, p_date_from: from, p_date_to: to,
    p_offset: offset, p_limit: 25,
  });
  return error ? privateJson({ error: "Service Delivery portfolio unavailable" }, 503) : privateJson(data);
}
