import { notFound, redirect } from "next/navigation";
import { OnboardingClient } from "@/components/onboarding-client";
import { getPrincipal } from "@/lib/auth/principal";
import { canUseOnboarding } from "@/lib/onboarding/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function OnboardingPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fonboarding");
  if (!canUseOnboarding(principal)) notFound();
  return <OnboardingClient office={principal.roles.includes("OFFICE_ADMIN") || principal.roles.includes("SUPER_ADMIN")} />;
}
