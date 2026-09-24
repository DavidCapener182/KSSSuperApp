import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const instant = (v: unknown): v is string => typeof v === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const reason = (v: unknown): v is string => typeof v === "string" && v.trim().length >= 3 && v.trim().length <= 300 && !/[\x00-\x1f\x7f]/.test(v);

export async function GET(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((r) => r === "OFFICE_ADMIN" || r === "SUPER_ADMIN")) return forbidden();
  const serviceId = new URL(request.url).searchParams.get("serviceId");
  if (!serviceId) {
    const { data, error } = await client.rpc("site_book_grant_choices_14a");
    return error ? forbidden() : privateJson({ choices: data });
  }
  if (!serviceId || !isUuid(serviceId)) return privateJson({ error: "Invalid service" }, 400);
  const { data, error } = await client.rpc("site_book_grants_list", { p_service: serviceId });
  return error ? forbidden() : privateJson({ grants: data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((r) => r === "OFFICE_ADMIN" || r === "SUPER_ADMIN")) return forbidden();
  const b = await request.json().catch(() => null);
  if (!b || typeof b.action !== "string" || !reason(b.reason)) return privateJson({ error: "Invalid grant request" }, 400);
  if (b.action === "issue") {
    if (!isUuid(b.serviceId) || !isUuid(b.personId) || !["CONTRIBUTOR", "MANAGER"].includes(b.kind) || !instant(b.from) || !instant(b.until))
      return privateJson({ error: "Invalid grant request" }, 400);
    const { data, error } = await client.rpc("site_book_grant_issue", { p_service: b.serviceId, p_person: b.personId, p_kind: b.kind,
      p_from: b.from, p_until: b.until, p_reason: b.reason.trim() });
    return error ? forbidden() : privateJson({ grantId: data }, 201);
  }
  if (b.action === "revoke") {
    if (!isUuid(b.grantId)) return privateJson({ error: "Invalid grant" }, 400);
    const { data, error } = await client.rpc("site_book_grant_revoke", { p_grant: b.grantId, p_reason: b.reason.trim() });
    return error ? forbidden() : privateJson({ revoked: data });
  }
  return privateJson({ error: "Invalid grant action" }, 400);
}
