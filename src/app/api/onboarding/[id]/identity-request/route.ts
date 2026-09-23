import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { readOnboardingCase } from "@/lib/onboarding/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const c = await readOnboardingCase(client, principal, (await params).id);
  if (!c) return notFound();
  if (c.state !== "IN_PROGRESS" || c.templateVersion !== 2 || c.ownerPersonId !== principal.personId ||
    c.personId === principal.personId || !principal.roles.includes("OFFICE_ADMIN") ||
    !c.requirements.some((row) => row.code === "IDENTITY_EVIDENCE")) return forbidden();
  const { data, error } = await client.rpc("issue_onboarding_identity_request", { requested_case: c.id });
  return error || !data ? privateJson({ error: "Identity Evidence request denied" }, 403)
    : privateJson({ requestId: data });
}
