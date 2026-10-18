import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseServicePortfolioQuery, type ServicePortfolioQuery } from "@/components/service-delivery-return-context";
import { ServiceDeliveryList } from "@/components/service-delivery-list";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<ServicePortfolioQuery> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fservice-delivery");
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) notFound();
  const params = await searchParams;
  const { mobilisation, ...selection } = params;
  const initialContext = parseServicePortfolioQuery(selection) ?? undefined;
  return <ServiceDeliveryList superAdmin={principal.roles.includes("SUPER_ADMIN")}
    mobilisationId={typeof mobilisation === "string" && isUuid(mobilisation) ? mobilisation : undefined} initialContext={initialContext} />;
}
