import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventAttendanceClient } from "@/components/event-attendance-client";
import { safeReturnTarget } from "@/lib/auth/return-target";

export const dynamic = "force-dynamic";
export default async function EventAttendancePage({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<{returnTo?:string}> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect(`/?next=%2Fevents%2F${id}%2Fattendance`);
  if (!hasCapability(principal, "EVENTS_USE") || !principal.roles.some((role) => ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"].includes(role))) notFound();
  const returnTo=safeReturnTarget((await searchParams).returnTo);
  return <main className="enterprise-main"><p className="eyebrow">Operations · synthetic development data</p><p>{returnTo?.startsWith("/control-room?")?<Link href={returnTo}>← Return to Control Room</Link>:<Link href={`/events/${id}`}>← Event</Link>}</p><EventAttendanceClient eventId={id} /></main>;
}
