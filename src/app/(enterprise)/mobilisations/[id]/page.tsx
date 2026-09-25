import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { MobilisationDetailClient } from "@/components/mobilisation-detail-client";

export const dynamic = "force-dynamic";
export default async function MobilisationPage({ params, searchParams }: { params: Promise<{ id: string }>;
  searchParams: Promise<{ sourceType?: string; sourceId?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fmobilisations");
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) notFound();
  const { id } = await params; if (!isUuid(id)) notFound();
  const query = await searchParams;
  const sourceType = ["SITE", "SITE_SERVICE", "EVENT"].includes(query.sourceType ?? "") ? query.sourceType : undefined;
  const sourceId = query.sourceId && isUuid(query.sourceId) ? query.sourceId : undefined;
  return <MobilisationDetailClient id={id} returnedSource={sourceType && sourceId ? { sourceType, sourceId } : undefined} />;
}
