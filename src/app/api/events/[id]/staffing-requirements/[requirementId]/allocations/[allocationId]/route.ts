import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageDeployment, deploymentError } from "@/lib/events/deployment";

type Context = { params: Promise<{ id: string; requirementId: string; allocationId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!canManageDeployment(principal.roles)) return forbidden();
  const { id, requirementId, allocationId } = await params;
  if (![id, requirementId, allocationId].every(isUuid)) return notFound();
  const body = await request.json().catch(() => null);
  if (!body || body.action !== "CANCEL" || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1 ||
    typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.trim().length > 300 ||
    /[\x00-\x1f\x7f]/.test(body.reason)) return privateJson({ error: "Cancellation requires a short reason" }, 400);
  const { data, error } = await client.rpc("deployment_cancel", { p_event: id, p_requirement: requirementId,
    p_allocation: allocationId, p_expected_revision: body.expectedRevision, p_reason: body.reason.trim() });
  if (error) { const result = deploymentError(error.message); return privateJson({ error: result.error }, result.status); }
  return privateJson({ revision: data });
}
