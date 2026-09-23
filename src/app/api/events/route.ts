import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { londonDueToIso } from "@/lib/crm/due-time";

const types = new Set(["FOOTBALL_MATCH","FESTIVAL","CONCERT","PARADE","CONFERENCE","CORPORATE_EVENT","OTHER"]);
const states = new Set(["UPCOMING","PLANNING","CONFIRMED","LIVE","COMPLETED","CANCELLED"]);
const uuidOrNull = (value: string | null) => !value || isUuid(value);
const isoOrNull = (value: string | null) => !value || (!Number.isNaN(Date.parse(value)) && /Z$/.test(value));
const operational = (roles: string[]) => roles.some((role) => ["SUPER_ADMIN","OFFICE_ADMIN","OPERATIONS"].includes(role));
const dateBoundary = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? londonDueToIso(`${value}T00:00`) : value ? undefined : null;

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!operational(principal.roles)) return forbidden();
  const q = new URL(request.url).searchParams;
  const search = q.get("search")?.trim() ?? "";
  const organisation = q.get("organisation"); const site = q.get("site"); const owner = q.get("owner");
  const status = q.get("status"); const type = q.get("type");
  const from = dateBoundary(q.get("fromDate"));
  const rawUntil = q.get("untilDate");
  const dayAfter = rawUntil && /^\d{4}-\d{2}-\d{2}$/.test(rawUntil) && !Number.isNaN(Date.parse(`${rawUntil}T00:00:00Z`))
    ? new Date(Date.parse(`${rawUntil}T00:00:00Z`) + 86_400_000).toISOString().slice(0,10) : rawUntil;
  const nextMidnight = dateBoundary(dayAfter);
  const until = nextMidnight ? new Date(Date.parse(nextMidnight) - 1).toISOString() : nextMidnight;
  const offset = Number(q.get("offset") ?? 0);
  if (search.length > 80 || /[\x00-\x1f\x7f]/.test(search) || !uuidOrNull(organisation) || !uuidOrNull(site) || !uuidOrNull(owner) ||
    (status && !states.has(status)) || (type && !types.has(type)) || from === undefined || until === undefined || !isoOrNull(from) || !isoOrNull(until) ||
    !Number.isInteger(offset) || offset < 0 || offset > 10000) return privateJson({ error: "Invalid Event filter" }, 400);
  const { data, error } = await client.rpc("operational_events_list", { p_search: search, p_organisation: organisation || null,
    p_site: site || null, p_owner: owner || null, p_status: status || null, p_type: type || null,
    p_from: from || null, p_until: until || null, p_offset: offset, p_limit: 25 });
  return error ? privateJson({ error: "Events unavailable" }, 503) : privateJson(data);
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((role) => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) return forbidden();
  const body = await request.json().catch(() => null);
  if (!body || !isUuid(body.siteId) || !isUuid(body.organisationId) || !isUuid(body.ownerId) ||
    (body.contactId && !isUuid(body.contactId)) || (body.opportunityId && !isUuid(body.opportunityId)) ||
    typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 180 || /[\x00-\x1f\x7f]/.test(body.name) ||
    !types.has(body.type)) return privateJson({ error: "Invalid Event" }, 400);
  const start = londonDueToIso(body.startLocal); const end = londonDueToIso(body.endLocal);
  if (!start || !end || Date.parse(end) <= Date.parse(start)) return privateJson({ error: "Enter valid, unambiguous London Event times" }, 400);
  const { data, error } = await client.rpc("operational_create_event", { p_site: body.siteId, p_organisation: body.organisationId,
    p_name: body.name.trim(), p_type: body.type, p_starts: start, p_ends: end, p_owner: body.ownerId,
    p_contact: body.contactId || null, p_opportunity: body.opportunityId || null });
  return error ? privateJson({ error: "Event could not be created" }, 400) : privateJson({ id: data }, 201);
}
