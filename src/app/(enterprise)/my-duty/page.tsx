import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { MyDutyClient } from "@/components/my-duty-client";

export const dynamic = "force-dynamic";

export default async function MyDutyPage({ searchParams }: { searchParams: Promise<{ allocationId?: string; source?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fmy-duty");
  if (!principal.roles.includes("SECURITY_STAFF") || !hasCapability(principal, "DEPLOYMENTS_SELF_READ")) notFound();
  const query = await searchParams;
  const focus = query.allocationId && isUuid(query.allocationId) && (query.source === "EVENT" || query.source === "SITE_SHIFT")
    ? { id: query.allocationId, source: query.source as "EVENT" | "SITE_SHIFT" } : undefined;
  return <MyDutyClient focus={focus} />;
}
