import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageDeployment, deploymentError } from "@/lib/events/deployment";

type Context = { params: Promise<{ id: string; requirementId: string }> };
export async function GET(_request: Request, { params }: Context) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!canManageDeployment(principal.roles)) return forbidden();
  const { id, requirementId } = await params; if (!isUuid(id) || !isUuid(requirementId)) return notFound();
  const { data, error } = await client.rpc("deployment_requirement", { p_event: id, p_requirement: requirementId });
  return error ? notFound() : privateJson({ deployment: data });
}
export async function POST(request: Request, { params }: Context) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!canManageDeployment(principal.roles)) return forbidden();
  const { id, requirementId } = await params; if (!isUuid(id) || !isUuid(requirementId)) return notFound();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.personId !== "string" || !isUuid(body.personId) ||
    !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1 ||
    typeof body.acknowledgeWarnings !== "boolean" ||
    (body.reason != null && (typeof body.reason !== "string" || body.reason.length > 300 || /[\x00-\x1f\x7f]/.test(body.reason))) )
    return privateJson({ error: "Invalid allocation request" }, 400);
  const { data, error } = await client.rpc("deployment_allocate", { p_event: id, p_requirement: requirementId,
    p_person: body.personId, p_expected_revision: body.expectedRevision,
    p_acknowledge_warnings: body.acknowledgeWarnings, p_reason: body.reason?.trim() || null });
  if (error) { const result = deploymentError(error.message); return privateJson({ error: result.error }, result.status); }
  return privateJson({ id: data }, 201);
}
