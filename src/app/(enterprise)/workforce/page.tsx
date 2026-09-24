import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { WorkforceClient } from "@/components/workforce-client";

export const dynamic = "force-dynamic";
export default async function WorkforcePage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fworkforce");
  if (!hasCapability(principal, "WORKFORCE_USE")) notFound();
  return <WorkforceClient />;
}
