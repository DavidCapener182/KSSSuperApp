import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { readOnboardingCase } from "@/lib/onboarding/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const c = await readOnboardingCase(client, principal, (await params).id);
  if (!c) return notFound();
  if (!c.canManage || c.state !== "IN_PROGRESS" || c.templateVersion !== 2 || c.personId === principal.personId)
    return forbidden();
  const body = await request.json().catch(() => null);
  if (!isUuid(body?.requirementId) || !isUuid(body?.versionId) ||
    (body?.syntheticValidUntil !== undefined && body.syntheticValidUntil !== null))
    return privateJson({ error: "Invalid Identity Evidence verification" }, 400);
  const requirement = c.requirements.find((row) => row.id === body.requirementId && row.code === "IDENTITY_EVIDENCE");
  if (!requirement || requirement.acceptedVersionId !== body.versionId ||
    requirement.evidenceState !== "ACCEPTED_AS_EVIDENCE" || requirement.state !== "UNDER_REVIEW") return forbidden();
  const { data, error } = await client.rpc("verify_onboarding_identity", {
    requested_case: c.id, requested_requirement: requirement.id, accepted_version: body.versionId,
  });
  return error || !data ? privateJson({ error: "Identity Evidence verification denied" }, 403)
    : privateJson({ verificationId: data });
}
