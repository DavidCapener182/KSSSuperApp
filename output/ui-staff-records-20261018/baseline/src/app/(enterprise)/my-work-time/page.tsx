import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { MyWorkTimeClient } from "@/components/my-work-time-client";

export const dynamic = "force-dynamic";
export default async function MyWorkTimePage({ searchParams }: { searchParams: Promise<{ allocationId?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fmy-work-time");
  if (!hasCapability(principal, "DEPLOYMENTS_SELF_READ")) notFound();
  const query = await searchParams;
  return <MyWorkTimeClient allocationId={query.allocationId} />;
}
