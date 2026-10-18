import { notFound, redirect } from "next/navigation";
import { CrmClient } from "@/components/crm-client";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function OpportunityPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  if(!isUuid(id)) notFound();
  const principal=await getPrincipal(await createServerSupabase());
  if(!principal) redirect("/?next=%2Fcrm");
  if(!hasCapability(principal,"CRM_USE")) notFound();
  return <CrmClient view="opportunity" id={id} currentPersonId={principal.personId}/>;
}
