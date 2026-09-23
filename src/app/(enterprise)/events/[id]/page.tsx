import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventsClient } from "@/components/events-client";

export const dynamic = "force-dynamic";
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!isUuid(id)) notFound();
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fevents");
  if (!hasCapability(principal, "EVENTS_USE")) notFound();
  return <EventsClient roles={principal.roles} id={id} />;
}
