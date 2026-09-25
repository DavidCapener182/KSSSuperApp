import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { operationalCapabilities } from "@/lib/controlled/operational";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!(await operationalCapabilities(client)).assign) return forbidden();
  const body = await request.json().catch(() => null);
  if (!body || !isUuid(body.versionId) || !isUuid(body.targetId) ||
    !["SITE", "SITE_SERVICE", "EVENT", "OPERATIONAL_ROLE", "PERSON"].includes(body.targetKind) ||
    typeof body.required !== "boolean" || typeof body.effectiveFrom !== "string" ||
    typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.length > 300 ||
    !Number.isFinite(Date.parse(body.effectiveFrom)) ||
    (body.effectiveUntil != null && (typeof body.effectiveUntil !== "string" || !Number.isFinite(Date.parse(body.effectiveUntil)))) ||
    (body.targetKind === "OPERATIONAL_ROLE" ? !["SITE", "SITE_SERVICE", "EVENT"].includes(body.contextKind) || !isUuid(body.contextId)
      : body.contextKind != null || body.contextId != null))
    return privateJson({ error: "Invalid exact assignment" }, 400);
  const { data, error } = await client.rpc("operational_document_assign", {
    requested_version: body.versionId, target_kind: body.targetKind, target_id: body.targetId,
    context_kind: body.contextKind ?? null, context_id: body.contextId ?? null,
    required: body.required, effective_from: body.effectiveFrom, effective_until: body.effectiveUntil ?? null,
    assignment_reason: body.reason.trim(),
  });
  return error || !data ? privateJson({ error: "Assignment denied or source changed" }, 409)
    : privateJson({ assignmentId: data }, 201);
}
