import { getEnterpriseAccess } from "@/lib/auth/principal";
import { navigationFor } from "@/lib/auth/capabilities";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase();
  const access = await getEnterpriseAccess(client);
  if (access.state === "unauthenticated") return unauthorised();
  if (access.state !== "active") return privateJson({ error: "No Enterprise access" }, 403);
  const { principal } = access;
  return privateJson({
    person: { id: principal.personId, displayName: principal.displayName },
    roles: principal.roles,
    navigation: navigationFor(principal),
  });
}
