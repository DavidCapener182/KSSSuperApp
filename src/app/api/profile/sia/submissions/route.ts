import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { readOnboardingCase } from "@/lib/onboarding/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const body = await request.json().catch(() => null);
  if (!isUuid(body?.caseId) || !isUuid(body?.requestKey) || body?.category !== "SECURITY_GUARDING")
    return privateJson({ error: "This pilot requires synthetic Security Guarding details" }, 400);
  const c = await readOnboardingCase(client, principal, body.caseId);
  if (!c || c.personId !== principal.personId || c.state !== "IN_PROGRESS" || c.templateVersion < 2)
    return forbidden();
  const { data, error } = await client.rpc("submit_onboarding_sia", {
    requested_case: c.id, supplied_request_key: body.requestKey,
  });
  return error || !data ? privateJson({ error: "Synthetic SIA details incomplete or submission denied" }, 400)
    : privateJson({ submissionId: data }, 201);
}
