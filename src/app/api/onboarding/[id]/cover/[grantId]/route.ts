import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function DELETE(_request: Request, context: { params: Promise<{ grantId: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("OFFICE_ADMIN") && !principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { grantId } = await context.params;
  if (!isUuid(grantId)) return privateJson({ error: "Invalid cover" }, 400);
  const { data, error } = await client.rpc("revoke_onboarding_case_cover", { requested_grant: grantId });
  return error || !data ? privateJson({ error: "Cover revoke denied" }, 403) : privateJson({ id: data });
}
