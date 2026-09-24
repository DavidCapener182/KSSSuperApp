import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { isExternalPartyList } from "@/lib/incidents/validation";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const { id } = await context.params; if (!isUuid(id)) return privateJson({ error: "Incident unavailable" }, 404);
  if (!principal.roles.includes("SECURITY_STAFF") && !principal.roles.includes("SUPER_ADMIN") && !principal.incidentReviewer) return forbidden();
  const { data, error } = await client.rpc("incident_detail", { p_incident: id });
  return error ? privateJson({ error: "Incident unavailable" }, 404) : privateJson({ incident: data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const { id } = await context.params; const b = await request.json().catch(() => null);
  if (!isUuid(id) || !b || !Number.isInteger(b.expectedRevision) || !isUuid(b.idempotencyKey) || !/^(?:Z|[+-]\d{2}:\d{2})$/.test(String(b.occurredAt).slice(-6)) && !String(b.occurredAt).endsWith("Z") || !Number.isFinite(Date.parse(b.occurredAt)) || typeof b.category !== "string" || !b.narrative || typeof b.narrative !== "string" || !b.reason || typeof b.reason !== "string" || !isExternalPartyList(b.externalParties)) return privateJson({ error: "Check the correction details and try again." }, 400);
  const c = b.context ?? {};
  if (typeof c !== "object" || ["eventId", "siteId", "siteServiceId", "eventAllocationId", "siteShiftAllocationId"].some((key) => c[key] != null && !isUuid(c[key]))) return privateJson({ error: "Select a valid incident context." }, 400);
  const { data, error } = await client.rpc("incident_correct", { p_incident: id, p_expected_revision: b.expectedRevision,
    p_idempotency_key: b.idempotencyKey, p_occurred_at: new Date(b.occurredAt).toISOString(), p_category: b.category,
    p_narrative: b.narrative.trim(), p_reason: b.reason.trim(), p_event: c.eventId ?? null, p_site: c.siteId ?? null,
    p_site_service: c.siteServiceId ?? null, p_event_allocation: c.eventAllocationId ?? null,
    p_site_shift_allocation: c.siteShiftAllocationId ?? null, p_external_parties: b.externalParties });
  return error ? privateJson({ error: "Correction not recorded. Refresh to see the current report version." }, 409) : privateJson({ result: data });
}
