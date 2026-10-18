import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { MyDeploymentsClient } from "@/components/my-deployments-client";
import { londonWeekStart } from "@/lib/events/workforce-week";

export const dynamic = "force-dynamic";
export default async function MyDeploymentsPage({ searchParams }: { searchParams: Promise<{ allocationId?: string; source?: string; returnWeek?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fmy-deployments");
  if (!hasCapability(principal, "DEPLOYMENTS_SELF_READ")) notFound();
  const query=await searchParams;
  const focus = query.allocationId && isUuid(query.allocationId) ? query.allocationId : undefined;
  const focusSource = focus && (query.source === "EVENT" || query.source === "SITE_SHIFT") ? query.source : undefined;
  const returnWeek = query.returnWeek && londonWeekStart(query.returnWeek) === query.returnWeek ? query.returnWeek : undefined;
  return <MyDeploymentsClient focus={focus} focusSource={focusSource} returnWeek={returnWeek} />;
}
