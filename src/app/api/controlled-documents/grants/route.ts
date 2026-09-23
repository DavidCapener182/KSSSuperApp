import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const body = await request.json().catch(() => null);
  if (!isUuid(body?.personId) || typeof body?.expiresAt !== "string" || !Number.isFinite(Date.parse(body.expiresAt)))
    return privateJson({ error: "Invalid publisher grant" }, 400);
  const { data, error } = await client.rpc("grant_controlled_publisher", {
    target_person: body.personId, expires_at: body.expiresAt,
  });
  return error || !data ? privateJson({ error: "Publisher grant denied" }, 403)
    : privateJson({ grantId: data }, 201);
}

export async function DELETE(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const body = await request.json().catch(() => null);
  if (!isUuid(body?.grantId)) return privateJson({ error: "Invalid grant" }, 400);
  const { data, error } = await client.rpc("revoke_controlled_publisher", { grant_id: body.grantId });
  return error || !data ? privateJson({ error: "Publisher revocation denied" }, 403)
    : privateJson({ revoked: true });
}
