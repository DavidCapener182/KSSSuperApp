import { notFound, redirect } from "next/navigation";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import SitesClient from "./sites-client";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fsites");
  if (!hasCapability(principal, "SITES_VIEW")) notFound();
  return <SitesClient />;
}
