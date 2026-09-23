import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!isUuid(id) || !isUuid(body?.personId) || typeof body?.startsAt !== "string" ||
    !Number.isFinite(Date.parse(body.startsAt)) ||
    (body.endsAt != null && (typeof body.endsAt !== "string" || !Number.isFinite(Date.parse(body.endsAt)))))
    return privateJson({ error: "Invalid team membership" }, 400);
  const { data, error } = await client.rpc("grant_onboarding_team_member", {
    requested_team: id, target_person: body.personId, starts_at: body.startsAt,
    ends_at: body.endsAt ?? null, can_coordinate_reassign: Boolean(body.canCoordinate),
  });
  return error || !data ? privateJson({ error: "Membership denied" }, 403) : privateJson({ id: data }, 201);
}
