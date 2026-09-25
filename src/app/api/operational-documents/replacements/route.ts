import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { operationalCapabilities } from "@/lib/controlled/operational";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  if (!(await operationalCapabilities(client)).assign) return forbidden();
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.assignmentIds) || body.assignmentIds.length < 1 || body.assignmentIds.length > 50 ||
    !body.assignmentIds.every(isUuid) || new Set(body.assignmentIds).size !== body.assignmentIds.length ||
    !isUuid(body.newVersionId) || typeof body.effectiveAt !== "string" ||
    !Number.isFinite(Date.parse(body.effectiveAt)) || typeof body.reason !== "string" || body.reason.trim().length < 3)
    return privateJson({ error: "Invalid replacement" }, 400);
  const { data, error } = await client.rpc("operational_document_replace", {
    old_assignment_ids: body.assignmentIds, new_version: body.newVersionId,
    replacement_at: body.effectiveAt, reason: body.reason,
  });
  return error || !data ? privateJson({ error: "Replacement denied or source changed" }, 409)
    : privateJson({ replacementAssignmentIds: data }, 201);
}
