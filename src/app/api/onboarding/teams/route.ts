import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("OFFICE_ADMIN") && !principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const teamId = new URL(request.url).searchParams.get("teamId");
  const [{ data: teams, error: teamError }, members, eligible] = await Promise.all([
    client.rpc("list_onboarding_teams"),
    teamId && isUuid(teamId) ? client.rpc("list_onboarding_team_people", { requested_team: teamId }) : Promise.resolve(null),
    teamId && isUuid(teamId) ? client.rpc("list_eligible_onboarding_office_people", { requested_team: teamId }) : Promise.resolve(null),
  ]);
  if (teamError || members?.error || eligible?.error) return privateJson({ error: "Teams unavailable" }, 503);
  return privateJson({ teams: teams ?? [], members: members?.data ?? [], eligible: eligible?.data ?? [] });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || body.name.trim().length < 3 || body.name.length > 100)
    return privateJson({ error: "Invalid team" }, 400);
  const { data, error } = await client.rpc("create_onboarding_team", { team_name: body.name });
  return error || !data ? privateJson({ error: "Team creation denied" }, 403) : privateJson({ id: data }, 201);
}
