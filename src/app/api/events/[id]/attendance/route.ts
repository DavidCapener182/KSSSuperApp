import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const operational = (roles: string[]) => roles.some((role) => ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"].includes(role));
const validNote = (value: unknown) => typeof value === "string" && value.trim().length >= 3 && value.trim().length <= 300 && !/[\x00-\x1f\x7f]/.test(value);
const validInstant = (value: unknown) => typeof value === "string" && /(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!operational(principal.roles)) return forbidden();
  const { id } = await context.params; const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);
  if (!isUuid(id) || !Number.isInteger(offset) || offset < 0 || offset > 10000) return privateJson({ error: "Invalid attendance request" }, 400);
  const { data, error } = await client.rpc("attendance_event_overview", { p_event: id, p_offset: offset, p_limit: 100 });
  return error ? privateJson({ error: "Operational attendance unavailable" }, 503) : privateJson({ attendance: data });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!operational(principal.roles)) return forbidden();
  const { id } = await context.params; const body = await request.json().catch(() => null);
  if (!isUuid(id) || !body || !isUuid(body.allocationId) || !isUuid(body.idempotencyKey) ||
    !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 ||
    !["CHECK_IN", "CHECK_OUT", "NO_SHOW_RECORDED", "EXCUSED_ABSENCE_RECORDED", "CHECK_IN_NOT_POSSIBLE", "REVIEW_REQUIRED"].includes(body.action) ||
    ((body.action === "CHECK_IN" || body.action === "CHECK_OUT") && !validInstant(body.actualAt)) ||
    (!(["CHECK_IN", "CHECK_OUT"].includes(body.action)) && !validNote(body.reason)) ||
    ((body.action === "NO_SHOW_RECORDED" || body.action === "EXCUSED_ABSENCE_RECORDED" || body.action === "CHECK_IN_NOT_POSSIBLE") && !["NO_SHOW", "EXCUSED", "CHECK_IN_NOT_POSSIBLE", "OTHER"].includes(body.reasonCode))) {
    return privateJson({ error: "Invalid operational attendance action" }, 400);
  }
  const { data, error } = await client.rpc("attendance_manager_record", {
    p_allocation: body.allocationId, p_action: body.action,
    p_actual_at: body.actualAt ? new Date(body.actualAt).toISOString() : null,
    p_reason_code: body.reasonCode ?? null, p_reason: body.reason?.trim() ?? null,
    p_expected_case_revision: body.expectedRevision, p_idempotency_key: body.idempotencyKey,
  });
  return error ? privateJson({ error: "Attendance was not recorded. Refresh and resolve the current state." }, 409) : privateJson({ result: data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!operational(principal.roles)) return forbidden();
  const { id } = await context.params; const body = await request.json().catch(() => null);
  if (!isUuid(id) || !body || !isUuid(body.allocationId) || !isUuid(body.targetEventId) || !isUuid(body.idempotencyKey) ||
    !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 || !validNote(body.reason)) return privateJson({ error: "Invalid correction" }, 400);
  let data; let error;
  if (body.correction === "RESOLVE_NO_SHOW_FOR_CHECK_IN" && validInstant(body.actualAt)) {
    ({ data, error } = await client.rpc("attendance_manager_resolve_no_show", {
      p_allocation: body.allocationId, p_no_show_event: body.targetEventId, p_actual_at: new Date(body.actualAt).toISOString(),
      p_reason: body.reason.trim(), p_expected_case_revision: body.expectedRevision, p_idempotency_key: body.idempotencyKey,
    }));
  } else if (["CORRECT_TIMESTAMP", "RESOLVE_CANCELLED_ALLOCATION_REVIEW"].includes(body.correction)) {
    ({ data, error } = await client.rpc("attendance_manager_correct", {
      p_allocation: body.allocationId, p_target_event: body.targetEventId, p_correction: body.correction,
      p_corrected_actual_at: body.correction === "CORRECT_TIMESTAMP" && validInstant(body.actualAt) ? new Date(body.actualAt).toISOString() : null,
      p_reason: body.reason.trim(), p_expected_case_revision: body.expectedRevision, p_idempotency_key: body.idempotencyKey,
    }));
  } else return privateJson({ error: "Invalid correction" }, 400);
  return error ? privateJson({ error: "Correction was not recorded. Refresh and resolve the current state." }, 409) : privateJson({ result: data });
}
