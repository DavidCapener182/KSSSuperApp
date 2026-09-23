import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { readOnboardingCase } from "@/lib/onboarding/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const c = await readOnboardingCase(client, principal, (await params).id);
  if (!c || c.state !== "IN_PROGRESS" || c.personId !== principal.personId ||
    !principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const body = await request.json().catch(() => null);
  if (body?.confirmed !== true) return privateJson({ error: "Explicit confirmation required" }, 400);
  const assignment = c.requirements.find((r) => r.code === "CONTRACT_TERMS")?.controlled;
  if (!assignment || assignment.acknowledgedAt) return forbidden();
  const { data, error } = await client.rpc("acknowledge_controlled_assignment", {
    requested_assignment: assignment.assignmentId,
  });
  return error || !data ? privateJson({ error: "Exact-version acknowledgement denied" }, 403)
    : privateJson({ acknowledgementId: data }, 201);
}
