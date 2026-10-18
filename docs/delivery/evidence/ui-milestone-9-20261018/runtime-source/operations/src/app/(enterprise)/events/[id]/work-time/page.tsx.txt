import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventWorkTimeClient } from "@/components/event-work-time-client";

export const dynamic = "force-dynamic";
export default async function EventWorkTimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect(`/?next=%2Fevents%2F${id}%2Fwork-time`);
  return <main className="enterprise-main"><EventWorkTimeClient eventId={id} canAdminGrants={principal.roles.includes("SUPER_ADMIN")} /></main>;
}
