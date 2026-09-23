import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("OFFICE_ADMIN") && !principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!isUuid(id) || !isUuid(body?.newOwnerPersonId) || typeof body?.reason !== "string" ||
    body.reason.trim().length < 10 || body.reason.length > 500) return privateJson({ error: "Invalid reassignment" }, 400);
  const { data, error } = await client.rpc("reassign_onboarding_case", {
    requested_case: id, new_owner: body.newOwnerPersonId, reason_text: body.reason,
  });
  return error || !data ? privateJson({ error: "Reassignment denied" }, 403) : privateJson({ changeId: data });
}
