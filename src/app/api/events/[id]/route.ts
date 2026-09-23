import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { londonDueToIso } from "@/lib/crm/due-time";

const operational = (roles: string[]) => roles.some((role) => ["SUPER_ADMIN","OFFICE_ADMIN","OPERATIONS"].includes(role));
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!operational(principal.roles)) return forbidden();
  const { id } = await params; if (!isUuid(id)) return notFound();
  const { data, error } = await client.rpc("operational_event_detail", { p_event: id });
  return error ? privateJson({ error: "Event unavailable" }, 503) : data ? privateJson({ event: data }) : notFound();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!operational(principal.roles)) return forbidden();
  const { id } = await params; if (!isUuid(id)) return notFound();
  const body = await request.json().catch(() => null);
  if (!body || !["STATUS","OWNER","DATES"].includes(body.action) ||
    (body.reason != null && (typeof body.reason !== "string" || body.reason.length > 500 || /[\x00-\x1f\x7f]/.test(body.reason))) ||
    (body.action === "STATUS" && !["CONFIRMED","LIVE","COMPLETED","CANCELLED"].includes(body.status)) ||
    (body.action === "OWNER" && !isUuid(body.ownerId))) return privateJson({ error: "Invalid Event change" }, 400);
  let start: string | null = null; let end: string | null = null;
  if (body.action === "DATES") {
    start = londonDueToIso(body.startLocal) ?? null; end = londonDueToIso(body.endLocal) ?? null;
    if (!start || !end || Date.parse(end) <= Date.parse(start)) return privateJson({ error: "Enter valid, unambiguous London Event times" }, 400);
  }
  const { error } = await client.rpc("operational_change_event", { p_event: id, p_action: body.action,
    p_status: body.action === "STATUS" ? body.status : null, p_owner: body.action === "OWNER" ? body.ownerId : null,
    p_starts: start, p_ends: end, p_reason: body.reason?.trim() || null });
  return error ? privateJson({ error: "Event change denied" }, 400) : privateJson({ ok: true });
}
