import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventsClient } from "@/components/events-client";

export const dynamic = "force-dynamic";
export default async function EventsPage({ searchParams }: { searchParams: Promise<{ organisation?: string; opportunity?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fevents");
  if (!hasCapability(principal, "EVENTS_USE")) notFound();
  const params = await searchParams;
  return <EventsClient roles={principal.roles} organisation={params.organisation} opportunity={params.opportunity} />;
}
