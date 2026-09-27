import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { canUseOnboarding, listOnboardingCases } from "@/lib/onboarding/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canUseOnboarding(principal)) return forbidden();
  const cases = await listOnboardingCases(client, principal);
  return cases ? privateJson({ cases }) : privateJson({ error: "Onboarding unavailable" }, 503);
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const superAdmin = principal.roles.includes("SUPER_ADMIN");
  if (!principal.roles.includes("OFFICE_ADMIN") && !superAdmin) return forbidden();
  const body = await request.json().catch(() => null);
  if (!isUuid(body?.targetPersonId) || !isUuid(body?.siteId) || !isUuid(body?.requestKey))
    return privateJson({ error: "Invalid onboarding request" }, 400);
  if (superAdmin && (!isUuid(body?.teamId) || !isUuid(body?.ownerPersonId)))
    return privateJson({ error: "Choose an onboarding team and Office owner" }, 400);
  const { data, error } = superAdmin
    ? await client.rpc("create_onboarding_case_as_super", {
      target_person: body.targetPersonId, requested_site: body.siteId,
      requested_team: body.teamId, requested_owner: body.ownerPersonId, request_key: body.requestKey,
    })
    : await client.rpc("create_onboarding_case", {
      target_person: body.targetPersonId, requested_site: body.siteId, request_key: body.requestKey,
    });
  if (error || !data) return privateJson({ error: "Onboarding case denied" }, 403);
  return privateJson({ id: data }, 201);
}
