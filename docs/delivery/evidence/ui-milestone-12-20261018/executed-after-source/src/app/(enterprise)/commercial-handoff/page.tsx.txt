import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { CommercialHandoffClient } from "@/components/commercial-handoff-client";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: {
  searchParams: Promise<{ organisation?: string; opportunity?: string; mobilisation?: string }>;
}) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fcommercial-handoff");
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) notFound();
  const params = await searchParams;
  if (!params.organisation || !isUuid(params.organisation) ||
    (params.opportunity && !isUuid(params.opportunity)) ||
    (params.mobilisation && !isUuid(params.mobilisation))) notFound();
  return <CommercialHandoffClient organisationId={params.organisation}
    opportunityId={params.opportunity} mobilisationId={params.mobilisation} />;
}
