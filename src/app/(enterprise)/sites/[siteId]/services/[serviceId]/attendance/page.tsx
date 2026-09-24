import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteAttendanceClient } from "@/components/site-attendance-client";

export const dynamic = "force-dynamic";
export default async function SiteAttendancePage({ params, searchParams }: {
  params: Promise<{ siteId: string; serviceId: string }>;
  searchParams: Promise<{ demand?: string }>;
}) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fsites");
  if (!principal.roles.some(role => ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"].includes(role))) notFound();
  const { siteId, serviceId } = await params;
  if (!isUuid(siteId) || !isUuid(serviceId)) notFound();
  const { demand } = await searchParams;
  return <SiteAttendanceClient siteId={siteId} serviceId={serviceId}
    demandId={demand && isUuid(demand) ? demand : undefined} />;
}
