import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { MobilisationsClient } from "@/components/mobilisations-client";

export const dynamic = "force-dynamic";
export default async function MobilisationsPage({ searchParams }: { searchParams: Promise<{ organisation?: string; opportunity?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fmobilisations");
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) notFound();
  const q = await searchParams;
  return <MobilisationsClient organisation={q.organisation} opportunity={q.opportunity} actorId={principal.personId} />;
}
