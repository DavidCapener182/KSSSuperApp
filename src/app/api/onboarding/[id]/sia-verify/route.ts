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
  if (!c.canManage || c.state !== "IN_PROGRESS") return forbidden();
  const body = await request.json().catch(() => null);
  const sia = c.requirements.find((r) => r.code === "SIA_LICENCE" && r.id === body?.requirementId);
  if (!isUuid(body?.requirementId) || !isUuid(body?.submissionId) || !isUuid(body?.versionId) || !sia ||
    sia.siaSubmissionId !== body.submissionId || sia.acceptedVersionId !== body.versionId || sia.state !== "UNDER_REVIEW")
    return forbidden();
  const { data, error } = await client.rpc("verify_onboarding_sia", {
    requested_case: c.id, requested_requirement: sia.id,
    requested_submission: body.submissionId, accepted_version: body.versionId,
  });
  return error || !data ? privateJson({ error: "SIA verification denied" }, 403)
    : privateJson({ verificationId: data });
}
