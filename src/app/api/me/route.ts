import { getPrincipal, hasRole } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  return privateJson({
    person: { id: principal.personId, displayName: principal.displayName },
    roles: principal.roles,
    view: hasRole(principal, "SUPER_ADMIN") ? "Access administration" : hasRole(principal, "OFFICE_ADMIN") ? "Office access proof" : hasRole(principal, "OPERATIONS") ? "Operations access proof" : "Security Staff access proof",
  });
}
