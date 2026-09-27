import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const reason = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length >= 10 && value.trim().length <= 300;
const uuid = (value: unknown): value is string => typeof value === "string" && isUuid(value);
const date = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const optionalId = (value: unknown): value is string | null => value === null || uuid(value);
const optionalDate = (value: unknown): value is string | null => value === null || date(value);

export async function GET(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const params = new URL(request.url).searchParams;
  const view = params.get("view") ?? "access";
  const operation = view === "access" ? client.rpc("training_requirement_access_20fa")
    : view === "admin" ? client.rpc("training_requirement_admin_20fa")
    : view === "contexts" ? client.rpc("training_requirement_contexts_20fa")
    : view === "matrix" && uuid(params.get("person")) && uuid(params.get("service")) &&
        uuid(params.get("role")) && date(params.get("asOf"))
      ? client.rpc("training_requirement_matrix_20fa", {
          p_person: params.get("person")!, p_service: params.get("service")!,
          p_role: params.get("role")!, p_as_of: params.get("asOf")!,
        }) : null;
  if (!operation) return privateJson({ error: "Invalid Training requirement view" }, 400);
  const { data, error } = await operation;
  return error ? privateJson({ error: "Training requirement source unavailable or access denied" }, 403)
    : privateJson({ data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const body = await request.json().catch(() => null);
  let operation: ReturnType<typeof client.rpc> | null = null;
  if (body?.action === "GRANT" && uuid(body.personId) &&
      ["AUTHOR", "PUBLISHER", "VIEWER"].includes(body.capability) &&
      optionalId(body.serviceId) && (body.effectiveUntil === null || typeof body.effectiveUntil === "string") &&
      reason(body.reason))
    operation = client.rpc("training_requirement_grant_20fa", {
      p_person: body.personId, p_capability: body.capability, p_service: body.serviceId,
      p_until: body.effectiveUntil, p_reason: body.reason,
    });
  else if (body?.action === "REVOKE_GRANT" && uuid(body.grantId) && reason(body.reason))
    operation = client.rpc("training_requirement_revoke_grant_20fa", {
      p_grant: body.grantId, p_reason: body.reason,
    });
  else if (body?.action === "CREATE" && typeof body.label === "string" &&
      uuid(body.roleId) && optionalId(body.siteId) && optionalId(body.serviceId) &&
      uuid(body.courseVersionId) && ["NOT_ACCEPTED", "ACCEPT_IF_CURRENT"].includes(body.priorEvidence) &&
      date(body.effectiveFrom) && optionalDate(body.effectiveUntil) && reason(body.reason))
    operation = client.rpc("training_requirement_create_20fa", {
      p_label: body.label, p_role: body.roleId, p_site: body.siteId,
      p_service: body.serviceId, p_course_version: body.courseVersionId,
      p_prior: body.priorEvidence, p_from: body.effectiveFrom,
      p_until: body.effectiveUntil, p_reason: body.reason,
    });
  else if (body?.action === "REVISE" && uuid(body.previousVersionId) &&
      uuid(body.courseVersionId) && ["NOT_ACCEPTED", "ACCEPT_IF_CURRENT"].includes(body.priorEvidence) &&
      date(body.effectiveFrom) && optionalDate(body.effectiveUntil) && reason(body.reason))
    operation = client.rpc("training_requirement_revise_20fa", {
      p_previous: body.previousVersionId, p_course_version: body.courseVersionId,
      p_prior: body.priorEvidence, p_from: body.effectiveFrom,
      p_until: body.effectiveUntil, p_reason: body.reason,
    });
  else if (body?.action === "PUBLISH" && uuid(body.versionId) && reason(body.reason))
    operation = client.rpc("training_requirement_publish_20fa", {
      p_version: body.versionId, p_reason: body.reason,
    });
  else if (body?.action === "END" && uuid(body.versionId) && date(body.endOn) && reason(body.reason))
    operation = client.rpc("training_requirement_end_20fa", {
      p_version: body.versionId, p_end_on: body.endOn, p_reason: body.reason,
    });
  if (!operation) return privateJson({ error: "Invalid Training requirement request" }, 400);
  const { data, error } = await operation;
  return error ? privateJson({ error: "Training requirement action denied or unavailable" }, 403)
    : privateJson({ data });
}
