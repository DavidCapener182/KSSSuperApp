import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId || !isUuid(eventId)) return privateJson({ error: "Select a valid Event" }, 400);
  const { data, error } = await client.rpc("event_work_time_grants_admin", { p_event: eventId });
  return error ? privateJson({ error: "Event grant list unavailable" }, 404) : privateJson({ grants: data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const body = await request.json().catch(() => null);
  if (!body || !isUuid(body.eventId) || !isUuid(body.personId) || !isUuid(body.idempotencyKey) ||
    !["WORK_TIME_REVIEW", "WORK_TIME_APPROVE"].includes(body.capability) ||
    typeof body.effectiveFrom !== "string" || !Number.isFinite(Date.parse(body.effectiveFrom)) ||
    typeof body.effectiveUntil !== "string" || !Number.isFinite(Date.parse(body.effectiveUntil)) ||
    typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.length > 300) {
    return privateJson({ error: "Check the Event-scoped grant details" }, 400);
  }
  const { data, error } = await client.rpc("event_work_time_grant", {
    p_event: body.eventId, p_person: body.personId, p_capability: body.capability,
    p_effective_from: new Date(body.effectiveFrom).toISOString(), p_effective_until: new Date(body.effectiveUntil).toISOString(),
    p_reason: body.reason.trim(), p_idempotency_key: body.idempotencyKey,
  });
  return error ? privateJson({ error: "Grant not recorded. Check for an existing active grant." }, 409) : privateJson({ grantId: data });
}
