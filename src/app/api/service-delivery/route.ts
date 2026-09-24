import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const allowed = (roles: string[]) => roles.includes("OFFICE_ADMIN") || roles.includes("SUPER_ADMIN");

export async function GET(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!allowed(principal.roles)) return forbidden();
  const q = new URL(request.url).searchParams;
  if (q.get("choices") === "1") {
    const { data, error } = await client.rpc("service_delivery_choices");
    return error ? privateJson({ error: "Choices unavailable" }, 503) : privateJson(data);
  }
  const offset = Number(q.get("offset") ?? "0");
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) return privateJson({ error: "Invalid page" }, 400);
  const { data, error } = await client.rpc("service_delivery_list", { p_offset: offset, p_limit: 25 });
  return error ? privateJson({ error: "Service Delivery unavailable" }, 503) : privateJson(data);
}

export async function POST(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!allowed(principal.roles)) return forbidden();
  const b = await request.json().catch(() => null);
  if (!b || !isUuid(b.serviceId) || !isUuid(b.linkId) || !isUuid(b.ownerId) || !isUuid(b.requestKey) ||
    !["MOBILISATION_HANDOVER", "LEGACY_EXISTING"].includes(b.source) ||
    (b.mobilisationId && !isUuid(b.mobilisationId)) || (b.decisionId && !isUuid(b.decisionId)) ||
    (b.explanation && (typeof b.explanation !== "string" || b.explanation.length > 500)))
    return privateJson({ error: "Invalid start input" }, 400);
  const { data, error } = await client.rpc("service_delivery_start", {
    p_service: b.serviceId, p_link: b.linkId, p_source: b.source, p_mobilisation: b.mobilisationId || null,
    p_decision: b.decisionId || null, p_owner: b.ownerId, p_super_oversight: b.superOversight === true,
    p_reason_code: b.reasonCode || null, p_explanation: b.explanation || null, p_key: b.requestKey,
  });
  return error ? privateJson({ error: "Service Delivery start denied. Check exact source, owner, reason and duplicates." }, 409) : privateJson(data, 201);
}
