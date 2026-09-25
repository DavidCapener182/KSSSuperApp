import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const allowed = (roles: string[]) => roles.includes("OFFICE_ADMIN") || roles.includes("SUPER_ADMIN");

export async function GET(request: Request, { params }: Context) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!allowed(principal.roles)) return forbidden();
  const { id } = await params;
  if (!isUuid(id)) return privateJson({ error: "Invalid Service Delivery" }, 400);
  const grants = new URL(request.url).searchParams.get("grants") === "1";
  if (grants && !principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { data, error } = grants
    ? await client.rpc("service_change_grants_admin", { p_delivery: id })
    : await client.rpc("service_management_detail", { p_delivery: id });
  return error ? privateJson({ error: "Management details unavailable" }, 404) : privateJson(data);
}

export async function POST(request: Request, { params }: Context) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!allowed(principal.roles)) return forbidden();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!isUuid(id) || !body || !isUuid(body.requestKey) ||
    !["COMMITMENT", "CHANGE", "GRANT"].includes(body.entity) ||
    typeof body.kind !== "string" || body.kind.length > 32 ||
    (body.subjectId != null && !isUuid(body.subjectId)) ||
    (body.expectedRevision != null && (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 1)) ||
    JSON.stringify(body).length > 5500)
    return privateJson({ error: "Invalid management action" }, 400);
  if (body.entity === "GRANT") {
    if (!principal.roles.includes("SUPER_ADMIN") ||
      (body.subjectId == null && (!isUuid(body.personId) || !["SERVICE_CHANGE_PROPOSER", "SERVICE_CHANGE_APPROVER", "SERVICE_CHANGE_RECORDER"].includes(body.capability))) ||
      (body.subjectId != null && body.kind !== "REVOKE") ||
      typeof body.reason !== "string") return forbidden();
    const { data, error } = await client.rpc("service_change_grant_command", {
      p_delivery: id, p_grant: body.subjectId ?? null, p_person: body.personId ?? null,
      p_capability: body.capability ?? null, p_until: body.effectiveUntil ?? null,
      p_reason: body.reason, p_key: body.requestKey,
    });
    return error ? privateJson({ error: "Grant action denied or stale" }, 409) : privateJson(data);
  }
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data))
    return privateJson({ error: "Invalid management payload" }, 400);
  const { data, error } = await client.rpc("service_management_command", {
    p_delivery: id, p_entity: body.entity, p_kind: body.kind,
    p_subject: body.subjectId ?? null, p_data: body.data,
    p_expected: body.expectedRevision ?? null, p_key: body.requestKey,
  });
  return error ? privateJson({ error: "Action denied. Refresh the record, grant or exact source revision." }, 409) : privateJson(data);
}
