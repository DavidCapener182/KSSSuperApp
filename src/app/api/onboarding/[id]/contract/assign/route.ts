import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { hasControlledPublisherGrant, readControlledVersion } from "@/lib/controlled/policy";
import { readOnboardingCase } from "@/lib/onboarding/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!(await hasControlledPublisherGrant(client, principal))) return forbidden();
  const c = await readOnboardingCase(client, principal, (await params).id);
  if (!c || !c.canManage || c.ownerPersonId !== principal.personId || c.state !== "IN_PROGRESS") return forbidden();
  const body = await request.json().catch(() => null);
  const requirement = c.requirements.find((r) => r.code === "CONTRACT_TERMS");
  if (!isUuid(body?.versionId) || !requirement || requirement.state !== "NOT_AVAILABLE") return forbidden();
  const version = await readControlledVersion(client, body.versionId);
  if (!version || version.state !== "PUBLISHED") return forbidden();
  const { data, error } = await client.rpc("assign_onboarding_controlled", {
    requested_case: c.id, requested_requirement: requirement.id, requested_version: version.id,
  });
  return error || !data ? privateJson({ error: "Controlled assignment denied" }, 403)
    : privateJson({ assignmentId: data }, 201);
}
