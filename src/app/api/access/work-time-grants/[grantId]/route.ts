import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ grantId: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { grantId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!isUuid(grantId) || !body || !isUuid(body.idempotencyKey) || typeof body.reason !== "string" ||
    body.reason.trim().length < 3 || body.reason.length > 300) return privateJson({ error: "Invalid grant revocation" }, 400);
  const { data, error } = await client.rpc("event_work_time_grant_revoke", {
    p_grant: grantId, p_reason: body.reason.trim(), p_idempotency_key: body.idempotencyKey,
  });
  return error ? privateJson({ error: "Grant was not revoked" }, 409) : privateJson({ revoked: data });
}
