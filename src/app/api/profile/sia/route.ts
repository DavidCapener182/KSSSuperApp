import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { SIA_CATEGORIES } from "@/lib/profile/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const body = await request.json().catch(() => null);
  if (!SIA_CATEGORIES.includes(body?.category) ||
    (body.reference !== null && body.reference !== undefined && typeof body.reference !== "string") ||
    (body.expiresOn !== null && body.expiresOn !== undefined &&
      (typeof body.expiresOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.expiresOn))))
    return privateJson({ error: "Invalid synthetic SIA details" }, 400);
  const { data, error } = await client.rpc("save_person_sia_credential", {
    supplied_category: body.category, supplied_reference: body.reference ?? null,
    supplied_expiry: body.expiresOn ?? null,
  });
  return error || !data ? privateJson({ error: "Synthetic SIA details could not be saved" }, 400)
    : privateJson({ credentialId: data });
}
