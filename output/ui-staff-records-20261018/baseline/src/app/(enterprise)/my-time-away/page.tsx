import { notFound } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { TimeAwayClient } from "@/components/time-away-client";

export const dynamic = "force-dynamic";
export default async function MyTimeAwayPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal?.roles.includes("SECURITY_STAFF")) notFound();
  return <TimeAwayClient view="staff" />;
}
