import { notFound } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { TimeAwayClient } from "@/components/time-away-client";

export const dynamic = "force-dynamic";
export default async function TimeAwayPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal || !principal.roles.some((role) => ["OFFICE_ADMIN", "SUPER_ADMIN", "OPERATIONS"].includes(role))) notFound();
  return <TimeAwayClient view="manager" />;
}
