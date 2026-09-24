import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventAttendanceClient } from "@/components/event-attendance-client";

export const dynamic = "force-dynamic";
export default async function EventAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect(`/?next=%2Fevents%2F${id}%2Fattendance`);
  if (!hasCapability(principal, "EVENTS_USE") || !principal.roles.some((role) => ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"].includes(role))) notFound();
  return <main className="enterprise-main"><p className="eyebrow">Operations · synthetic development data</p><p><Link href={`/events/${id}`}>← Event</Link></p><EventAttendanceClient eventId={id} /></main>;
}
