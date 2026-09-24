import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const validInstant = (value: unknown) => typeof value === "string" && /(Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).getUTCSeconds() === 0 && new Date(value).getUTCMilliseconds() === 0;

export async function POST(request: Request, context: { params: Promise<{ allocationId: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const { allocationId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!isUuid(allocationId) || !body || !["SAVE_DRAFT", "SUBMIT"].includes(body.action) ||
    !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 || !isUuid(body.idempotencyKey)) {
    return privateJson({ error: "Invalid worked-time action" }, 400);
  }
  if (body.action === "SAVE_DRAFT" && (!Array.isArray(body.segments) || body.segments.length < 1 || body.segments.length > 50 ||
    body.segments.some((segment: { kind?: unknown; startAt?: unknown; endAt?: unknown }) =>
      !segment || !["WORK", "BREAK"].includes(String(segment.kind)) || !validInstant(segment.startAt) || !validInstant(segment.endAt)))) {
    return privateJson({ error: "Add valid London-time work intervals. Breaks are entered explicitly." }, 400);
  }
  if (body.action === "SUBMIT" && body.segments !== undefined) return privateJson({ error: "Submit the saved draft" }, 400);
  const { data, error } = await client.rpc("event_work_time_self_action", {
    p_allocation: allocationId, p_action: body.action, p_expected_revision: body.expectedRevision,
    p_segments: body.action === "SAVE_DRAFT" ? body.segments.map((segment: { kind: string; startAt: string; endAt: string }) => ({
      kind: segment.kind, startAt: new Date(segment.startAt).toISOString(), endAt: new Date(segment.endAt).toISOString(),
    })) : null,
    p_idempotency_key: body.idempotencyKey,
  });
  return error ? privateJson({ error: "Worked-time change was not recorded. Refresh before retrying." }, 409) : privateJson({ result: data });
}
