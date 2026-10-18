import { redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { OperationalContactsClient } from "@/components/operational-contacts-client";
import "./operational-contacts.css";

export const dynamic = "force-dynamic";
export default async function OperationalContactsPage({ searchParams }: {
  searchParams: Promise<{ allocationId?: string; source?: string }>;
}) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Foperational-contacts");
  const q = await searchParams;
  const allocation = q.allocationId && isUuid(q.allocationId) ? q.allocationId : undefined;
  const source = q.source === "EVENT" || q.source === "SITE_SHIFT" ? q.source : undefined;
  return <main className="enterprise-main operational-contacts"><header>
    <p className="enterprise-eyebrow">Synthetic development · Current operational routes</p>
    <h1>Operational contacts</h1>
    <p>Contacts published for this exact deployment. These routes do not confirm anyone is working or available.</p>
  </header><OperationalContactsClient allocationId={allocation} source={source} /></main>;
}
