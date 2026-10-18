import { notFound, redirect } from "next/navigation";
import { CrmClient } from "@/components/crm-client";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function CrmPage({ searchParams }: { searchParams: Promise<{view?: string}> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fcrm");
  if (!hasCapability(principal,"CRM_USE")) notFound();
  const raw = (await searchParams).view;
  const view = raw==="pipeline"||raw==="organisations"||raw==="contacts"||raw==="opportunities" ? raw : "overview";
  return <CrmClient view={view} currentPersonId={principal.personId}/>;
}
