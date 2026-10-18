import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { ServiceDeliveryDetail } from "@/components/service-delivery-detail";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fservice-delivery");
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) notFound();
  const { id } = await params; if (!isUuid(id)) notFound();
  return <ServiceDeliveryDetail id={id} superAdmin={principal.roles.includes("SUPER_ADMIN")} />;
}
