import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const allowed = (roles: string[]) => roles.includes("OFFICE_ADMIN") || roles.includes("SUPER_ADMIN");
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!allowed(principal.roles)) return forbidden();
  const { id } = await params; if (!isUuid(id)) return privateJson({ error: "Invalid record" }, 400);
  const q = new URL(request.url).searchParams;
  if (q.get("history") === "1") {
    const offset = Number(q.get("offset") ?? "0");
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000) return privateJson({ error: "Invalid page" }, 400);
    const { data, error } = await client.rpc("service_delivery_history_page", { p_id: id, p_offset: offset, p_limit: 25 });
    return error ? privateJson({ error: "History unavailable" }, 404) : privateJson(data);
  }
  const { data, error } = await client.rpc("service_delivery_detail", { p_id: id });
  return error ? privateJson({ error: "Service Delivery unavailable" }, 404) : privateJson(data);
}

export async function PATCH(request: Request, { params }: Context) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!allowed(principal.roles)) return forbidden();
  const { id } = await params; const b = await request.json().catch(() => null);
  if (!isUuid(id) || !b || !isUuid(b.requestKey) || !Number.isInteger(b.expectedRevision) || b.expectedRevision < 1 ||
    typeof b.kind !== "string" || !b.data || typeof b.data !== "object" || Array.isArray(b.data) ||
    (b.subjectId && !isUuid(b.subjectId)) || JSON.stringify(b.data).length > 5000)
    return privateJson({ error: "Invalid change input" }, 400);
  const { data, error } = await client.rpc("service_delivery_change", {
    p_id: id, p_kind: b.kind, p_subject: b.subjectId || null, p_data: b.data,
    p_expected: b.expectedRevision, p_key: b.requestKey,
  });
  return error ? privateJson({ error: "Change denied. Refresh the record and check the required reason, owner and state." }, 409) : privateJson(data);
}
