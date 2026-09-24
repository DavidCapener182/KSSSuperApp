import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ allocationId: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const { allocationId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!isUuid(allocationId) || !body || !["CHECK_IN", "CHECK_OUT"].includes(body.action) ||
    !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 || typeof body.actualAt !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(body.actualAt) ||
    !Number.isFinite(Date.parse(body.actualAt)) || !isUuid(body.idempotencyKey)) {
    return privateJson({ error: "Invalid attendance action" }, 400);
  }
  const actualAt = new Date(body.actualAt).toISOString();
  const source = new URL(request.url).searchParams.get("source") ?? "EVENT";
  if (!["EVENT", "SITE_SHIFT"].includes(source)) return privateJson({ error: "Invalid attendance source" }, 400);
  const { data, error } = await client.rpc(source === "SITE_SHIFT" ? "attendance_site_self_action" : "attendance_self_action", {
    p_allocation: allocationId, p_action: body.action, p_actual_at: actualAt,
    p_expected_case_revision: body.expectedRevision, p_idempotency_key: body.idempotencyKey,
  });
  return error ? privateJson({ error: "Attendance was not recorded. Refresh and retry safely." }, 409) : privateJson({ result: data });
}
