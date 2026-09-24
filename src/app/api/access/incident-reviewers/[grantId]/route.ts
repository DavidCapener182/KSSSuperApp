import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
export async function DELETE(request: Request, context: { params: Promise<{ grantId: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { grantId } = await context.params; const b = await request.json().catch(() => null);
  if (!isUuid(grantId) || !b || typeof b.reason !== "string" || b.reason.trim().length < 3 || b.reason.length > 300) return privateJson({ error: "A revocation reason is required." }, 400);
  const { data, error } = await client.rpc("incident_reviewer_revoke", { p_grant: grantId, p_reason: b.reason.trim() });
  return error ? privateJson({ error: "Reviewer grant not revoked. Refresh and check current access." }, 409) : privateJson({ revoked: data });
}
