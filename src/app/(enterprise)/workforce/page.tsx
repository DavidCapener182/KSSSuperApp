import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { WorkforceClient } from "@/components/workforce-client";
import { parseWorkforceReturnState } from "@/lib/events/workforce-navigation";

export const dynamic = "force-dynamic";
export default async function WorkforcePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fworkforce");
  if (!hasCapability(principal, "WORKFORCE_USE")) notFound();
  return <WorkforceClient initial={parseWorkforceReturnState(await searchParams)} allowLocalSample={process.env.KSS_ENABLE_LOCAL_SYNTHETIC_PREVIEW === "1" && !process.env.VERCEL_ENV} />;
}
