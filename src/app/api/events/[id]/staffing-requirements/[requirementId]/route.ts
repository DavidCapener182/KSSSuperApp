import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageStaffing, staffingError, staffingFields } from "@/lib/events/staffing";

type Context = { params: Promise<{ id: string; requirementId: string }> };
export async function GET(_request: Request, { params }: Context) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!canManageStaffing(principal.roles)) return forbidden();
  const { id, requirementId } = await params; if (!isUuid(id) || !isUuid(requirementId)) return notFound();
  const { data, error } = await client.rpc("staffing_history", { p_event: id, p_requirement: requirementId });
  return error ? notFound() : privateJson({ history: data });
}
export async function PATCH(request: Request, { params }: Context) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!canManageStaffing(principal.roles)) return forbidden();
  const { id, requirementId } = await params; if (!isUuid(id) || !isUuid(requirementId)) return notFound();
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) return privateJson({ error: "Invalid requirement revision" }, 400);
  if (body.action === "CANCEL") {
    if (typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.trim().length > 500 || /[\x00-\x1f\x7f]/.test(body.reason))
      return privateJson({ error: "Cancellation requires a reason" }, 400);
    const { data, error } = await client.rpc("staffing_cancel", { p_event: id, p_requirement: requirementId,
      p_expected_revision: body.expectedRevision, p_reason: body.reason.trim() });
    if (error) { const result = staffingError(error.message); return privateJson({ error: result.error }, result.status); }
    return privateJson({ revision: data });
  }
  if (body.action !== "AMEND") return privateJson({ error: "Invalid staffing action" }, 400);
  const fields = staffingFields(body);
  if (!fields) return privateJson({ error: "Enter valid, unambiguous London staffing times and fields" }, 400);
  const { data, error } = await client.rpc("staffing_amend_confirmed", { p_event: id, p_requirement: requirementId,
    p_expected_revision: body.expectedRevision, ...fields });
  if (error) { const result = staffingError(error.message); return privateJson({ error: result.error }, result.status); }
  return privateJson({ revision: data });
}
