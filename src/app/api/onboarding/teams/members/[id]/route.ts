import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!isUuid(id) || typeof body?.canCoordinate !== "boolean") return privateJson({ error: "Invalid coordinator update" }, 400);
  const { data, error } = await client.rpc("set_onboarding_team_coordinator", {
    requested_membership: id, enabled: body.canCoordinate,
  });
  return error || !data ? privateJson({ error: "Coordinator update denied" }, 403) : privateJson({ id: data });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { id } = await context.params;
  if (!isUuid(id)) return privateJson({ error: "Invalid membership" }, 400);
  const { data, error } = await client.rpc("revoke_onboarding_team_member", { requested_membership: id });
  return error || !data ? privateJson({ error: "Membership revoke denied" }, 403) : privateJson({ id: data });
}
