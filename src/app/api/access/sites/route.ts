import { parseAssignment } from "@/lib/auth/assignment";
import { getPrincipal, hasRole } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!hasRole(principal, "SUPER_ADMIN")) return forbidden();
  const input = parseAssignment(await request.json().catch(() => null), "site");
  if (!input) return privateJson({ error: "Invalid assignment" }, 400);
  const { data, error } = await client.from("site_assignments").insert({
    person_id: input.personId, site_id: input.siteId,
    effective_from: input.effectiveFrom, effective_until: input.effectiveUntil,
    granted_by: principal.personId,
  }).select("id").single();
  if (error) return privateJson({ error: "Assignment could not be saved" }, 400);
  return privateJson({ id: data.id }, 201);
}
