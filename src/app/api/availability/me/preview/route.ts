import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseAvailabilityRange } from "@/lib/events/availability-time";

export async function POST(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const body = await request.json().catch(() => null);
  const range = body && parseAvailabilityRange(body);
  if (!range) return privateJson({ error: "Enter a valid Europe/London range." }, 400);
  const { data, error } = await client.rpc("availability_preview", { p_starts: range.starts, p_ends: range.ends });
  return error ? privateJson({ error: "Availability preview unavailable" }, 503) : privateJson({ preview: data, range });
}
