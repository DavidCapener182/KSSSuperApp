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
  if (!c.canManage || c.ownerPersonId !== principal.personId || c.state !== "IN_PROGRESS") return forbidden();
  const body = await request.json().catch(() => null);
  const sia = c.requirements.find((r) => r.code === "SIA_LICENCE");
  if (!isUuid(body?.submissionId) || !sia || sia.siaSubmissionId !== body.submissionId) return forbidden();
  const { data, error } = await client.rpc("issue_onboarding_sia_request", {
    requested_case: c.id, requested_submission: body.submissionId,
  });
  return error || !data ? privateJson({ error: "SIA evidence request denied" }, 403) : privateJson({ requestId: data });
}
