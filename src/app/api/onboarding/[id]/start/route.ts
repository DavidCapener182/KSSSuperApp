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
  if (!c.canManage) return forbidden();
  const { error } = await client.rpc("start_onboarding_case", { requested_case: c.id });
  return error ? privateJson({ error: "Onboarding start denied" }, 403) : privateJson({ id: c.id });
}
