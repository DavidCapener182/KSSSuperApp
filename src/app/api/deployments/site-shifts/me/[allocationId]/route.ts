import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { deploymentError } from "@/lib/events/deployment";

export async function PATCH(request: Request, { params }: { params: Promise<{ allocationId: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const { allocationId } = await params; if (!isUuid(allocationId)) return notFound();
  const body = await request.json().catch(() => null);
  if (!body || !["ACCEPTED", "DECLINED"].includes(body.response) ||
    !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1 ||
    (body.response === "DECLINED" && !["CANNOT_ATTEND", "TIMING_CONFLICT", "OTHER"].includes(body.reasonCode)) ||
    (body.note != null && (typeof body.note !== "string" || body.note.length > 300 || /[\x00-\x1f\x7f]/.test(body.note))))
    return privateJson({ error: "Invalid deployment response" }, 400);
  const { data, error } = await client.rpc("site_shift_respond", { p_allocation: allocationId,
    p_expected_revision: body.expectedRevision, p_response: body.response,
    p_reason_code: body.response === "DECLINED" ? body.reasonCode : null,
    p_note: body.response === "DECLINED" ? body.note?.trim() || null : null });
  if (error) { const result = deploymentError(error.message); return privateJson({ error: result.error }, result.status); }
  return privateJson({ revision: data });
}
