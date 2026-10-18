import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { readServicePortfolioReturn, type ServicePortfolioQuery } from "@/components/service-delivery-return-context";
import { ServiceDeliveryDetail } from "@/components/service-delivery-detail";

export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<ServicePortfolioQuery> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fservice-delivery");
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) notFound();
  const { id } = await params; if (!isUuid(id)) notFound();
  const query = await searchParams ?? {};
  const returnTo = Object.keys(query).every(key => key === "returnTo") ? readServicePortfolioReturn(query.returnTo) : "/service-delivery";
  return <ServiceDeliveryDetail id={id} superAdmin={principal.roles.includes("SUPER_ADMIN")} returnTo={returnTo} />;
}
