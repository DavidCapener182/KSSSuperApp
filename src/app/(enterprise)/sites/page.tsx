import { notFound, redirect } from "next/navigation";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import SitesClient from "./sites-client";
import { OperationalSitesClient } from "@/components/operational-sites-client";

export const dynamic = "force-dynamic";

export default async function SitesPage({ searchParams }: { searchParams: Promise<{ view?: string; selected?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fsites");
  if (!hasCapability(principal, "SITES_VIEW")) notFound();
  const query = await searchParams;
  if (principal.roles.includes("OPERATIONS") && !principal.roles.includes("OFFICE_ADMIN") && !principal.roles.includes("SUPER_ADMIN"))
    return <OperationalSitesClient selected={query.selected} office={false} />;
  if (query.view === "operational" && (principal.roles.includes("OFFICE_ADMIN") || principal.roles.includes("SUPER_ADMIN")))
    return <OperationalSitesClient selected={query.selected} office />;
  return <SitesClient />;
}
