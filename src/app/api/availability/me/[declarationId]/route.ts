import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { availabilityError } from "@/lib/events/availability";

export async function PATCH(request: Request, { params }: { params: Promise<{ declarationId: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const { declarationId } = await params; if (!isUuid(declarationId)) return notFound();
  const body = await request.json().catch(() => null);
  if (!body || body.action !== "CANCEL" || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 ||
    typeof body.acknowledgeConflict !== "boolean")
    return privateJson({ error: "Invalid availability cancellation" }, 400);
  const { data, error } = await client.rpc("availability_cancel_ack", { p_declaration: declarationId,
    p_expected_revision: body.expectedRevision, p_acknowledge_deployment_conflict: body.acknowledgeConflict });
  if (error) { const result = availabilityError(error.message); return privateJson({ error: result.error }, result.status); }
  return privateJson({ revision: data });
}
