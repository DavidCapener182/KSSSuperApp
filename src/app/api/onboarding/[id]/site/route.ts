import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!isUuid(id) || !isUuid(body?.siteId)) return privateJson({ error: "Choose an active Site" }, 400);
  const { data, error } = await client.rpc("attach_onboarding_site", {
    requested_case: id, requested_site: body.siteId,
  });
  return error || !data ? privateJson({ error: "Site could not be added to this draft case" }, 403)
    : privateJson({ id: data });
}
