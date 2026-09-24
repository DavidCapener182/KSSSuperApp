import { notFound, redirect } from "next/navigation";
import { ActionCentreClient } from "@/components/action-centre-client";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ActionCentrePage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Faction-centre");
  if (!hasCapability(principal, "ACTION_CENTRE_SELF_READ")) notFound();
  return <ActionCentreClient />;
}
