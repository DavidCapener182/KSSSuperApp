import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120 || /[\x00-\x1f\x7f]/.test(name) || !isUuid(body?.requestKey))
    return privateJson({ error: "Enter a staff member's name" }, 400);
  if (body?.siteId != null && !isUuid(body.siteId)) return privateJson({ error: "Invalid Site" }, 400);
  const { data, error } = await client.rpc("register_onboarding_starter", {
    p_starter_name: name, p_request_key: body.requestKey, p_requested_site: body?.siteId ?? null,
  });
  if (error || !data) return privateJson({ error: "Staff member could not be registered" }, 403);
  return privateJson(data, 201);
}
