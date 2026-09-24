import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { MobilisationDetailClient } from "@/components/mobilisation-detail-client";

export const dynamic = "force-dynamic";
export default async function MobilisationPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fmobilisations");
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) notFound();
  const { id } = await params; if (!isUuid(id)) notFound();
  return <MobilisationDetailClient id={id} />;
}
