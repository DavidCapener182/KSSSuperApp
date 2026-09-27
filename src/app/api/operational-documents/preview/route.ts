import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { operationalCapabilities } from "@/lib/controlled/operational";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  if (!(await operationalCapabilities(client)).assign) return forbidden();
  const body = await request.json().catch(() => null);
  if (!isUuid(body?.versionId) || !isUuid(body?.targetId) ||
    !["SITE", "SITE_SERVICE", "EVENT", "OPERATIONAL_ROLE", "PERSON"].includes(body?.targetKind) ||
    typeof body?.effectiveFrom !== "string" || !Number.isFinite(Date.parse(body.effectiveFrom)) ||
    (body.targetKind === "OPERATIONAL_ROLE" ?
      !["SITE_SERVICE", "EVENT"].includes(body.contextKind) || !isUuid(body.contextId) :
      body.contextKind != null || body.contextId != null))
    return privateJson({ error: "Invalid exact preview" }, 400);
  const { data, error } = await client.rpc("operational_document_assignment_preview", {
    requested_version: body.versionId, target_kind: body.targetKind, target_id: body.targetId,
    context_kind: body.contextKind ?? null, context_id: body.contextId ?? null,
    effective_from: body.effectiveFrom,
  });
  return error || !data ? privateJson({ error: "Preview denied or source changed" }, 409) : privateJson(data);
}
