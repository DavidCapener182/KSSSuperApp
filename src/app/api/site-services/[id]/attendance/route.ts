import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const operational = (roles: string[]) => roles.some(role => ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"].includes(role));
const validNote = (value: unknown) => typeof value === "string" && value.trim().length >= 3 && value.trim().length <= 300 && !/[\x00-\x1f\x7f]/.test(value);
const validInstant = (value: unknown) => typeof value === "string" && /(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const actions = ["CHECK_IN", "CHECK_OUT", "NO_SHOW_RECORDED", "EXCUSED_ABSENCE_RECORDED", "CHECK_IN_NOT_POSSIBLE", "REVIEW_REQUIRED", "RESOLVE_NO_SHOW_FOR_CHECK_IN", "CORRECT_TIMESTAMP", "RESOLVE_CANCELLED_ALLOCATION_REVIEW"];

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!operational(principal.roles)) return forbidden();
  const { id: serviceId } = await context.params; const params = new URL(request.url).searchParams;
  const demandId = params.get("demandId"); const offset = Number(params.get("offset") ?? "0");
  if (!isUuid(serviceId) || (demandId !== null && !isUuid(demandId)) || !Number.isInteger(offset) || offset < 0 || offset > 10000)
    return privateJson({ error: "Invalid attendance selection" }, 400);
  const { data, error } = await client.rpc("attendance_site_overview_09b", {
    p_service: serviceId, p_demand: demandId, p_offset: offset, p_limit: 100,
  });
  return error ? privateJson({ error: "Operational attendance unavailable" }, 503) : privateJson({ attendance: data });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!operational(principal.roles)) return forbidden();
  const { id: serviceId } = await context.params; const body = await request.json().catch(() => null);
  if (!isUuid(serviceId) || !body || !isUuid(body.allocationId) || !isUuid(body.idempotencyKey) ||
    !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 || !actions.includes(body.action) ||
    (["CHECK_IN", "CHECK_OUT", "RESOLVE_NO_SHOW_FOR_CHECK_IN", "CORRECT_TIMESTAMP"].includes(body.action) && !validInstant(body.actualAt)) ||
    (["NO_SHOW_RECORDED", "EXCUSED_ABSENCE_RECORDED", "CHECK_IN_NOT_POSSIBLE", "REVIEW_REQUIRED", "RESOLVE_NO_SHOW_FOR_CHECK_IN", "CORRECT_TIMESTAMP", "RESOLVE_CANCELLED_ALLOCATION_REVIEW"].includes(body.action) && !validNote(body.reason)) ||
    (["RESOLVE_NO_SHOW_FOR_CHECK_IN", "CORRECT_TIMESTAMP", "RESOLVE_CANCELLED_ALLOCATION_REVIEW"].includes(body.action) && !isUuid(body.targetEventId)))
    return privateJson({ error: "Invalid attendance action" }, 400);
  const { data, error } = await client.rpc("attendance_site_manager_action", {
    p_service: serviceId, p_allocation: body.allocationId, p_action: body.action,
    p_actual_at: body.actualAt ? new Date(body.actualAt).toISOString() : null,
    p_reason_code: body.reasonCode ?? null, p_reason: body.reason?.trim() ?? null,
    p_target_event: body.targetEventId ?? null,
    p_expected_case_revision: body.expectedRevision, p_idempotency_key: body.idempotencyKey,
  });
  return error ? privateJson({ error: "Attendance was not recorded. Refresh and resolve the current state." }, 409) : privateJson({ result: data });
}
