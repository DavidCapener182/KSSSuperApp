import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteServicesClient } from "@/components/site-services-client";

export const dynamic = "force-dynamic";
export default async function SiteServicesPage({ params, searchParams }: { params: Promise<{ siteId: string }>;
  searchParams: Promise<{ mobilisation?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fsites");
  if (!principal.roles.some((role) => ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"].includes(role))) notFound();
  const { siteId } = await params; if (!isUuid(siteId)) notFound();
  const query = await searchParams;
  return <SiteServicesClient siteId={siteId} personId={principal.personId}
    mobilisationId={query.mobilisation && isUuid(query.mobilisation) ? query.mobilisation : undefined}
    canAdmin={principal.roles.some((role) => ["SUPER_ADMIN", "OFFICE_ADMIN"].includes(role))} />;
}
