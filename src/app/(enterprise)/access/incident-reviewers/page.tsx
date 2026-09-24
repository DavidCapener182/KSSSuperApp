import { notFound } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { IncidentReviewerAdmin } from "@/components/incident-reviewer-admin";
import "../../incidents/incidents.css";
export const dynamic="force-dynamic";
export default async function IncidentReviewersPage(){const p=await getPrincipal(await createServerSupabase());if(!p?.roles.includes("SUPER_ADMIN"))notFound();return <main className="enterprise-main incident-page"><header className="incident-page-header"><p className="incident-eyebrow">Super Admin · Synthetic development</p><h1>Incident reviewer grants</h1><p>Incident review requires an active Operations role and a separate, time-bounded reviewer grant.</p></header><IncidentReviewerAdmin /></main>}
