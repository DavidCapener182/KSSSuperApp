import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const uuid = (value: unknown): value is string => typeof value === "string" && isUuid(value);
const optionalUuid = (value: unknown) => value == null || uuid(value);
const actionNames = new Set(["CREATE_TEAM", "SET_TEAM_ACTIVE", "ADD_MEMBER", "REVOKE_MEMBER", "GRANT_APPROVER", "REVOKE_APPROVER"]);

export async function GET(request: Request) {
  const client = await createServerSupabase();
  if (!await getPrincipal(client)) return unauthorised();
  const query = new URL(request.url).searchParams;
  const mode = query.get("mode") ?? "authority";
  if (mode === "authority") {
    const { data, error } = await client.rpc("time_away_authority");
    return error ? privateJson({ error: "Time Away unavailable" }, 503) : privateJson(data);
  }
  if (mode === "admin") {
    const { data, error } = await client.rpc("time_away_admin_read");
    return error ? privateJson({ error: "Time Away administration unavailable" }, 403) : privateJson(data);
  }
  if (mode === "detail" || mode === "conflicts") {
    const id = query.get("id");
    if (!id || !isUuid(id)) return privateJson({ error: "Invalid request" }, 400);
    const view = query.get("view") ?? "VIEW_REQUESTS";
    if (mode === "detail" && view !== "VIEW_REQUESTS")
      return privateJson({ error: "Invalid request view" }, 400);
    const rpc = mode === "detail" ? "time_away_detail" : "time_away_conflicts";
    const args = mode === "detail" ? { p_request: id, p_action: view } : { p_request: id };
    const { data, error } = await client.rpc(rpc, args);
    return error ? privateJson({ error: "Time Away request unavailable" }, 403) : privateJson(data);
  }
  if (mode === "list") {
    const team = query.get("team");
    const offset = Number(query.get("offset") ?? "0");
    const limit = Number(query.get("limit") ?? "25");
    const from = query.get("from"), to = query.get("to");
    const view = query.get("view") ?? "VIEW_REQUESTS";
    if ((team && !isUuid(team)) || !Number.isInteger(offset) || offset < 0 || offset > 10000 ||
      !Number.isInteger(limit) || limit < 1 || limit > 50 ||
      !["VIEW_REQUESTS", "VIEW_CALENDAR", "VIEW_COVERAGE"].includes(view) ||
      (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)))
      return privateJson({ error: "Invalid Time Away filter" }, 400);
    const { data, error } = view === "VIEW_CALENDAR" && team
      ? await client.rpc("time_away_calendar", { p_team: team, p_from: from || null, p_to: to || null })
      : await client.rpc("time_away_list", {
        p_team: team || null, p_from: from || null, p_to: to || null,
        p_offset: offset, p_limit: limit, p_action: view,
      });
    return error ? privateJson({ error: "Time Away list unavailable" }, 403) : privateJson(data);
  }
  return privateJson({ error: "Invalid Time Away view" }, 400);
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  if (!await getPrincipal(client)) return unauthorised();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.action !== "string")
    return privateJson({ error: "Invalid Time Away action" }, 400);
  let rpc: string, args: Record<string, unknown>;
  if (body.action === "SAVE_DRAFT") {
    if (!optionalUuid(body.requestId) || !uuid(body.key) || !Number.isInteger(body.expectedRevision) ||
      typeof body.category !== "string" || !Array.isArray(body.segments))
      return privateJson({ error: "Invalid draft" }, 400);
    rpc = "time_away_save_draft";
    args = { p_request: body.requestId ?? null, p_category: body.category,
      p_segments: body.segments, p_expected_revision: body.expectedRevision, p_key: body.key };
  } else if (body.action === "SUBMIT") {
    if (!uuid(body.requestId) || !optionalUuid(body.teamId) || !uuid(body.key) || !Number.isInteger(body.expectedRevision))
      return privateJson({ error: "Invalid submission" }, 400);
    rpc = "time_away_submit";
    args = { p_request: body.requestId, p_team: body.teamId ?? null,
      p_expected_revision: body.expectedRevision, p_key: body.key };
  } else if (["WITHDRAWN", "CANCELLATION_REQUESTED", "APPROVED", "DECLINED", "CANCELLATION_APPROVED", "CANCELLATION_REJECTED"].includes(body.action)) {
    if (!uuid(body.requestId) || !uuid(body.key) || !Number.isInteger(body.expectedRevision) ||
      (body.reason != null && typeof body.reason !== "string") || body.note != null)
      return privateJson({ error: "Invalid decision" }, 400);
    rpc = "time_away_transition";
    args = { p_request: body.requestId, p_action: body.action, p_expected_revision: body.expectedRevision,
      p_key: body.key, p_reason: body.reason ?? null, p_note: null };
  } else if (actionNames.has(body.action)) {
    if (!optionalUuid(body.id) || !optionalUuid(body.teamId) || !optionalUuid(body.personId) ||
      typeof body.reason !== "string" || body.reason.length > 300 ||
      (body.actions != null && (!Array.isArray(body.actions) || body.actions.some((item: unknown) => typeof item !== "string"))))
      return privateJson({ error: "Invalid administration action" }, 400);
    rpc = "time_away_admin_action";
    args = { p_action: body.action, p_id: body.id ?? null, p_team: body.teamId ?? null,
      p_person: body.personId ?? null, p_name: body.name ?? null, p_description: body.description ?? null,
      p_start: body.start ?? null, p_end: body.end ?? null, p_until: body.until ?? null,
      p_actions: body.actions ?? null, p_reason: body.reason, p_expected_revision: body.expectedRevision ?? null };
  } else return privateJson({ error: "Invalid Time Away action" }, 400);
  const { data, error } = await client.rpc(rpc, args);
  if (error) {
    const safe = /Time Away|team membership|Ambiguous|nonexistent|Segments|Partial|Whole-day|Idempotency|retroactive|date/i.test(error.message);
    return privateJson({ error: safe ? error.message : "Time Away action denied" }, /Stale|Idempotency/i.test(error.message) ? 409 : 400);
  }
  return privateJson({ result: data }, 200);
}
