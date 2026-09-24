import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteServiceDetailClient } from "@/components/site-service-detail-client";

export const dynamic = "force-dynamic";
export default async function SiteServiceDetailPage({ params, searchParams }: { params: Promise<{ siteId: string; serviceId: string }>; searchParams: Promise<{ demand?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fsites");
  if (!principal.roles.some((role) => ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"].includes(role))) notFound();
  const { siteId, serviceId } = await params; if (!isUuid(siteId) || !isUuid(serviceId)) notFound();
  const query=await searchParams;
  return <SiteServiceDetailClient siteId={siteId} serviceId={serviceId} initialDemandId={query.demand && isUuid(query.demand) ? query.demand : undefined}
    canAdmin={principal.roles.some((role) => ["SUPER_ADMIN", "OFFICE_ADMIN"].includes(role))} />;
}
