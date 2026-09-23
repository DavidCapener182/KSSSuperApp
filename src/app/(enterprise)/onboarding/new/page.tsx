import { notFound, redirect } from "next/navigation";
import { OnboardingClient } from "@/components/onboarding-client";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function NewOnboardingPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fonboarding%2Fnew");
  if (!principal.roles.includes("OFFICE_ADMIN")) notFound();
  return <OnboardingClient office />;
}
