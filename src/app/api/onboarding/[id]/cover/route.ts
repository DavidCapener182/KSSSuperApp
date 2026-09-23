import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("OFFICE_ADMIN") && !principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { id } = await context.params;
  if (!isUuid(id)) return privateJson({ error: "Invalid case" }, 400);
  const { data, error } = await client.rpc("list_onboarding_case_cover", { requested_case: id });
  return error ? privateJson({ error: "Cover unavailable" }, 503) : privateJson({ grants: data ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("OFFICE_ADMIN") && !principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!isUuid(id) || !isUuid(body?.coveringPersonId) || typeof body?.reason !== "string" ||
    body.reason.trim().length < 10 || body.reason.length > 500 ||
    typeof body?.startsAt !== "string" || typeof body?.endsAt !== "string" ||
    !Number.isFinite(Date.parse(body.startsAt)) || !Number.isFinite(Date.parse(body.endsAt)))
    return privateJson({ error: "Invalid cover" }, 400);
  const { data, error } = await client.rpc("grant_onboarding_case_cover", {
    requested_case: id, covering_person: body.coveringPersonId, starts_at: body.startsAt,
    ends_at: body.endsAt, reason_text: body.reason,
  });
  return error || !data ? privateJson({ error: "Cover denied" }, 403) : privateJson({ grantId: data });
}
