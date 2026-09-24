import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { ServiceDeliveryList } from "@/components/service-delivery-list";

export const dynamic = "force-dynamic";
export default async function Page() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fservice-delivery");
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) notFound();
  return <ServiceDeliveryList superAdmin={principal.roles.includes("SUPER_ADMIN")} />;
}
