import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const reason = (value: unknown): value is string => typeof value === "string" && value.trim().length >= 10 && value.trim().length <= 300;

export async function GET(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const view = new URL(request.url).searchParams.get("view") ?? "mine";
  const operation = view === "mine" ? client.rpc("training_completion_mine")
    : view === "access" ? client.rpc("training_completion_access")
    : view === "admin" ? client.rpc("training_completion_admin")
    : view === "choices" ? client.rpc("training_completion_publish_choices")
    : view === "grants" ? client.rpc("training_completion_grants_read") : null;
  if (!operation) return privateJson({ error: "Invalid completion view" }, 400);
  const { data, error } = await operation;
  return error ? privateJson({ error: "Completion history unavailable" }, 403) : privateJson({ data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const body = await request.json().catch(() => null);
  let operation: ReturnType<typeof client.rpc> | null = null;
  if (body?.action === "EVALUATE" && isUuid(body.assignmentId) && isUuid(body.requestId))
    operation = client.rpc("training_completion_evaluate", { p_assignment: body.assignmentId, p_request: body.requestId });
  else if (body?.action === "VOID" && isUuid(body.completionId) && reason(body.reason) && isUuid(body.requestId))
    operation = client.rpc("training_completion_void", { p_completion: body.completionId, p_reason: body.reason, p_request: body.requestId });
  else if (body?.action === "GRANT" && isUuid(body.personId) && reason(body.reason))
    operation = client.rpc("training_completion_grant", { p_person: body.personId, p_reason: body.reason });
  else if (body?.action === "REVOKE_GRANT" && isUuid(body.grantId) && reason(body.reason))
    operation = client.rpc("training_completion_revoke_grant", { p_grant: body.grantId, p_reason: body.reason });
  else if (body?.action === "PUBLISH_RULE" && isUuid(body.courseVersionId) && isUuid(body.assessmentVersionId) &&
    typeof body.effectiveFrom === "string" && (body.effectiveUntil === null || typeof body.effectiveUntil === "string") &&
    (body.validityMonths === null || Number.isInteger(body.validityMonths)))
    operation = client.rpc("training_completion_publish_rule", {
      p_course_version: body.courseVersionId, p_assessment_version: body.assessmentVersionId,
      p_effective_from: body.effectiveFrom, p_effective_until: body.effectiveUntil,
      p_validity_months: body.validityMonths,
    });
  if (!operation) return privateJson({ error: "Invalid completion request" }, 400);
  const { data, error } = await operation;
  return error ? privateJson({ error: "Completion check denied or unavailable" }, 403) : privateJson({ data });
}
