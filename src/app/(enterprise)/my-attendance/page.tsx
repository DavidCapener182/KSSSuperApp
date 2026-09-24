import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { MyAttendanceClient } from "@/components/my-attendance-client";

export const dynamic = "force-dynamic";
export default async function MyAttendancePage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fmy-attendance");
  if (!hasCapability(principal, "DEPLOYMENTS_SELF_READ")) notFound();
  return <MyAttendanceClient />;
}
