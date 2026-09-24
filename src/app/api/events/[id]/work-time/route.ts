import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const { id } = await context.params;
  if (!isUuid(id)) return privateJson({ error: "Worked-time review unavailable" }, 404);
  const { data, error } = await client.rpc("event_work_time_manager_read", { p_event: id });
  return error ? privateJson({ error: "Worked-time review unavailable" }, 404) : privateJson({ workTime: { ...data, actor_person_id: principal.personId } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  if (!await getPrincipal(client)) return unauthorised();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!isUuid(id) || !body || !isUuid(body.caseId) || !isUuid(body.idempotencyKey) ||
    !["RETURN", "APPROVE"].includes(body.action) || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1 ||
    (body.action === "RETURN" && (typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.length > 500)) ||
    (body.action === "APPROVE" && body.reason !== undefined && (typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.length > 500))) {
    return privateJson({ error: "Invalid worked-time review action" }, 400);
  }
  const { data, error } = await client.rpc("event_work_time_manager_action", {
    p_event: id, p_case: body.caseId, p_action: body.action, p_expected_revision: body.expectedRevision,
    p_reason: body.reason?.trim() ?? null, p_idempotency_key: body.idempotencyKey,
  });
  return error ? privateJson({ error: "Review was not recorded. Refresh and verify the current revision." }, 409) : privateJson({ result: data });
}
