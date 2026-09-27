import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("OFFICE_ADMIN") && !principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const siteId = new URL(request.url).searchParams.get("siteId");
  if (!siteId || !isUuid(siteId)) return privateJson({ error: "Invalid Site" }, 400);
  const { data, error } = await client.rpc("list_onboarding_case_targets", { requested_site: siteId });
  return error ? privateJson({ error: "Targets unavailable" }, 503) : privateJson({ targets: data ?? [] });
}
