import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { MyScheduleClient } from "@/components/my-schedule-client";
import { londonWeekStart } from "@/lib/events/workforce-week";

export const dynamic = "force-dynamic";
export default async function MySchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fmy-schedule");
  if (!hasCapability(principal, "SCHEDULE_SELF_READ")) notFound();
  const { week } = await searchParams;
  return <MyScheduleClient initialWeek={week && londonWeekStart(week) === week ? week : undefined} />;
}
