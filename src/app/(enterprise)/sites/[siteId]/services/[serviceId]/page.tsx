import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteServiceDetailClient } from "@/components/site-service-detail-client";
import { safeWorkforceReturn } from "@/lib/events/workforce-navigation";
import { londonWeekStart } from "@/lib/events/workforce-week";
import { safeReturnTarget } from "@/lib/auth/return-target";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function SiteServiceDetailPage({ params, searchParams }: { params: Promise<{ siteId: string; serviceId: string }>; searchParams: Promise<{ demand?: string; returnTo?: string; sourceWeek?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fsites");
  if (!principal.roles.some((role) => ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"].includes(role))) notFound();
  const { siteId, serviceId } = await params; if (!isUuid(siteId) || !isUuid(serviceId)) notFound();
  const query=await searchParams;
  const controlReturn=safeReturnTarget(query.returnTo);
  return <>{controlReturn?.startsWith("/control-room?")&&<p className="enterprise-main"><Link href={controlReturn}>← Return to Control Room</Link></p>}<SiteServiceDetailClient siteId={siteId} serviceId={serviceId} initialDemandId={query.demand && isUuid(query.demand) ? query.demand : undefined}
    initialWeek={query.sourceWeek && londonWeekStart(query.sourceWeek) === query.sourceWeek ? query.sourceWeek : undefined}
    workforceReturn={safeWorkforceReturn(query.returnTo)}
    canAdmin={principal.roles.some((role) => ["SUPER_ADMIN", "OFFICE_ADMIN"].includes(role))} /></>;
}
