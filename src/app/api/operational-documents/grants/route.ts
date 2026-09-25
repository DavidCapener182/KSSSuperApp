import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const body = await request.json().catch(() => null);
  if (!isUuid(body?.personId) || !["PUBLISH", "ASSIGN"].includes(body?.capability) ||
    typeof body?.expiresAt !== "string" || !Number.isFinite(Date.parse(body.expiresAt)))
    return privateJson({ error: "Invalid grant" }, 400);
  const { data, error } = await client.rpc("operational_document_grant", {
    target_person: body.personId, capability_code: body.capability, expires_at: body.expiresAt,
  });
  return error || !data ? privateJson({ error: "Grant denied" }, 403) : privateJson({ grantId: data }, 201);
}

export async function DELETE(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const body = await request.json().catch(() => null);
  if (!isUuid(body?.grantId)) return privateJson({ error: "Invalid grant" }, 400);
  const { data, error } = await client.rpc("operational_document_revoke_grant", { grant_id: body.grantId });
  return error || !data ? privateJson({ error: "Revocation denied" }, 403) : privateJson({ revoked: true });
}
