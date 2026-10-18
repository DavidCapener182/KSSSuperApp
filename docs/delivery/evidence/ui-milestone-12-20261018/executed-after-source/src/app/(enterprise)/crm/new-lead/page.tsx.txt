import { notFound, redirect } from "next/navigation";
import { CrmNewLead } from "@/components/crm-new-lead";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function NewLeadPage({ searchParams }: { searchParams: Promise<{ organisation?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fcrm%2Fnew-lead");
  if (!hasCapability(principal, "CRM_USE")) notFound();
  const candidate = (await searchParams).organisation;
  return <CrmNewLead currentPersonId={principal.personId} initialOrganisationId={candidate && isUuid(candidate) ? candidate : undefined} />;
}
