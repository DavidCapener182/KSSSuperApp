import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { isExternalPartyList } from "@/lib/incidents/validation";

const categories = ["SAFETY_HAZARD", "INJURY_OR_ILLNESS_REPORTED", "SECURITY_OCCURRENCE", "PROPERTY_DAMAGE_OR_LOSS", "SERVICE_DISRUPTION", "OTHER_OPERATIONAL"];
const validText = (v: unknown, min: number, max: number): v is string => typeof v === "string" && v.trim().length >= min && v.trim().length <= max && !/[\x00-\x1f\x7f]/.test(v);
const instant = (v: unknown) => typeof v === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));

export async function GET(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const url = new URL(request.url); const mode = url.searchParams.get("mode");
  const submissionKey=url.searchParams.get("submissionKey");
  if(submissionKey){if(!principal.roles.includes("SECURITY_STAFF")||!isUuid(submissionKey))return forbidden();const {data,error}=await client.rpc("incident_submit_result",{p_idempotency_key:submissionKey});return error?privateJson({error:"Submission status unavailable"},503):privateJson({result:data});}
  if (mode === "context") {
    if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
    const { data, error } = await client.rpc("incident_context_choices");
    return error ? privateJson({ error: "Incident context unavailable" }, 503) : privateJson({ choices: data });
  }
  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) return privateJson({ error: "Invalid incident request" }, 400);
  if (principal.roles.includes("SECURITY_STAFF")) {
    const { data, error } = await client.rpc("incident_self_list", { p_offset: offset, p_limit: 25 });
    return error ? privateJson({ error: "Your incident reports are unavailable" }, 503) : privateJson({ result: data });
  }
  if (!principal.roles.includes("SUPER_ADMIN") && !principal.incidentReviewer) return forbidden();
  const { data, error } = await client.rpc("incident_review_queue", { p_offset: offset, p_limit: 25, p_include_closed: false });
  return error ? privateJson({ error: "Incident review queue unavailable" }, 503) : privateJson({ result: data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const b = await request.json().catch(() => null);
  if (!b || !isUuid(b.idempotencyKey) || !instant(b.occurredAt) || !categories.includes(b.category) || !validText(b.narrative, 10, 6000) || !isExternalPartyList(b.externalParties ?? [])) return privateJson({ error: "Check the incident details and try again." }, 400);
  const context = b.context ?? {};
  if (typeof context !== "object" || ["eventId", "siteId", "siteServiceId", "eventAllocationId", "siteShiftAllocationId"].some((key) => context[key] != null && !isUuid(context[key]))) return privateJson({ error: "Select a valid incident context." }, 400);
  const { data, error } = await client.rpc("incident_submit", {
    p_idempotency_key: b.idempotencyKey, p_occurred_at: new Date(b.occurredAt).toISOString(), p_category: b.category,
    p_narrative: b.narrative.trim(), p_event: context.eventId ?? null, p_site: context.siteId ?? null,
    p_site_service: context.siteServiceId ?? null, p_event_allocation: context.eventAllocationId ?? null,
    p_site_shift_allocation: context.siteShiftAllocationId ?? null, p_external_parties: b.externalParties ?? [],
  });
  return error ? privateJson({ error: "Report not confirmed. Retry with the same submission without duplicating it." }, 409) : privateJson({ result: data }, 201);
}
