import { notFound, redirect } from "next/navigation";
import { OperationalDocumentsClient } from "@/components/operational-documents-client";
import { getPrincipal } from "@/lib/auth/principal";
import { operationalCapabilities } from "@/lib/controlled/operational";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function OperationalDocumentsPage() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect("/?next=%2Foperational-documents");
  const capabilities = await operationalCapabilities(client);
  const staff = principal.roles.includes("SECURITY_STAFF");
  const operations = principal.roles.includes("OPERATIONS");
  if (principal.roles.includes("OFFICE_ADMIN") && !staff && !operations &&
    !capabilities.publish && !capabilities.assign) return <main className="enterprise-main">
      <div className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Controlled operational instructions</p>
        <h1>Operational documents</h1><p>A finite Publisher or Assigner grant is required for this workspace.</p></div></div>
    </main>;
  if (!staff && !operations && !capabilities.publish && !capabilities.assign) notFound();
  return <OperationalDocumentsClient staff={staff} operations={operations}
    manager={capabilities.publish || capabilities.assign} superAdmin={principal.roles.includes("SUPER_ADMIN")} />;
}
