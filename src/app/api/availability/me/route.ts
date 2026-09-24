import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { availabilityError } from "@/lib/events/availability";
import { parseAvailabilityRange } from "@/lib/events/availability-time";

export async function GET(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) return privateJson({ error: "Invalid page" }, 400);
  const { data, error } = await client.rpc("my_availability", { p_offset: offset, p_limit: 25 });
  return error ? privateJson({ error: "My Availability unavailable" }, 503) : privateJson({ availability: data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const body = await request.json().catch(() => null);
  const range = body && parseAvailabilityRange(body);
  if (!body || body.mode === "EXACT" || !range || !["AVAILABLE", "UNAVAILABLE"].includes(body.state) ||
    !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 ||
    typeof body.confirmReplace !== "boolean" || typeof body.acknowledgeConflict !== "boolean" ||
    (body.note != null && (typeof body.note !== "string" || body.note.length > 300 || /[\x00-\x1f\x7f]/.test(body.note))))
    return privateJson({ error: "Enter a valid future London time range. Ambiguous or missing DST times are not accepted." }, 400);
  const { data, error } = await client.rpc("availability_save", { p_state: body.state,
    p_starts: range.starts, p_ends: range.ends, p_note: body.note?.trim() || null,
    p_expected_revision: body.expectedRevision, p_confirm_replace: body.confirmReplace,
    p_acknowledge_deployment_conflict: body.acknowledgeConflict });
  if (error) { const result = availabilityError(error.message); return privateJson({ error: result.error }, result.status); }
  return privateJson({ revision: data }, 201);
}
