import { notFound, redirect } from "next/navigation";
import { OnboardingClient } from "@/components/onboarding-client";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { canUseOnboarding, readOnboardingCase } from "@/lib/onboarding/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function OnboardingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect(`/?next=${encodeURIComponent(`/onboarding/${id}`)}`);
  if (!canUseOnboarding(principal) || !await readOnboardingCase(client, principal, id)) notFound();
  return <OnboardingClient office={principal.roles.includes("OFFICE_ADMIN") || principal.roles.includes("SUPER_ADMIN")} selectedCaseId={id} />;
}
