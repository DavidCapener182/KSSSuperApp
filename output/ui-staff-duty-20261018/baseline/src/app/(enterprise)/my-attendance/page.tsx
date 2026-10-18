import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { MyAttendanceClient } from "@/components/my-attendance-client";

export const dynamic = "force-dynamic";
export default async function MyAttendancePage({ searchParams }: { searchParams: Promise<{ allocationId?: string; source?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fmy-attendance");
  if (!hasCapability(principal, "DEPLOYMENTS_SELF_READ")) notFound();
  const query = await searchParams;
  const allocationId = query.allocationId && isUuid(query.allocationId) ? query.allocationId : undefined;
  const source = query.source === "SITE_SHIFT" ? "SITE_SHIFT" : "EVENT";
  return <MyAttendanceClient allocationId={allocationId} source={source} />;
}
