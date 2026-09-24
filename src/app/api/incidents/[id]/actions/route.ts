import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN") && !principal.incidentReviewer) return forbidden();
  const { id } = await context.params; const b = await request.json().catch(() => null);
  if (!isUuid(id) || !b || !Number.isInteger(b.expectedRevision) || !isUuid(b.idempotencyKey) || !["ACKNOWLEDGE", "ACTION_RECORDED", "CLOSE", "REOPEN"].includes(b.action)) return privateJson({ error: "Invalid incident action" }, 400);
  const { data, error } = await client.rpc("incident_review_action", { p_incident: id, p_expected_revision: b.expectedRevision,
    p_idempotency_key: b.idempotencyKey, p_action: b.action, p_action_code: b.actionCode ?? null, p_reason: b.reason ?? null });
  return error ? privateJson({ error: "Action not recorded. Refresh to see the current incident status." }, 409) : privateJson({ result: data });
}
