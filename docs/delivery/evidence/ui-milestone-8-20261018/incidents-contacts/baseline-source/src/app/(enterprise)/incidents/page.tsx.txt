import { notFound } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { IncidentsWorkspace } from "@/components/incidents-workspace";
import "./incidents.css";

export const dynamic = "force-dynamic";
export default async function IncidentsPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal || (!principal.roles.includes("SECURITY_STAFF") && !principal.roles.includes("SUPER_ADMIN") && !principal.incidentReviewer)) notFound();
  return <main className="enterprise-main incident-page"><header className="incident-page-header"><p className="incident-eyebrow">KSS Enterprise · Synthetic development</p><h1>{principal.roles.includes("SECURITY_STAFF") ? "Report an incident" : "Incident review"}</h1><p>Operational incident reporting for factual site and service issues.</p></header><IncidentsWorkspace staff={principal.roles.includes("SECURITY_STAFF")} reviewer={principal.incidentReviewer || principal.roles.includes("SUPER_ADMIN")} /></main>;
}
