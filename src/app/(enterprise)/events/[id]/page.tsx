import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventsClient } from "@/components/events-client";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ requirement?: string }> }) {
  const { id } = await params; if (!isUuid(id)) notFound();
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fevents");
  if (!hasCapability(principal, "EVENTS_USE")) notFound();
  const search = await searchParams;
  return <><main className="enterprise-main"><p><Link href={`/events/${id}/attendance`}>Event attendance</Link> · <Link href={`/events/${id}/work-time`}>Worked-time review</Link> · <Link href={`/operational-contacts/manage?kind=EVENT&id=${id}`}>Operational contacts</Link></p></main><EventsClient roles={principal.roles} id={id} focusRequirement={search.requirement && isUuid(search.requirement) ? search.requirement : undefined} /></>;
}
