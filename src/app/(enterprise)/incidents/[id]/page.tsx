import { notFound } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { IncidentDetail } from "@/components/incident-detail";
import "../incidents.css";
export const dynamic = "force-dynamic";
export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const principal = await getPrincipal(await createServerSupabase());
  if (!principal || !isUuid(id) || (!principal.roles.includes("SECURITY_STAFF") && !principal.roles.includes("SUPER_ADMIN") && !principal.incidentReviewer)) notFound();
  return <main className="enterprise-main incident-page"><IncidentDetail id={id} staff={principal.roles.includes("SECURITY_STAFF")} reviewer={principal.incidentReviewer || principal.roles.includes("SUPER_ADMIN")} /></main>;
}
