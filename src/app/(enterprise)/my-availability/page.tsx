import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { createServerSupabase } from "@/lib/supabase/server";
import { MyAvailabilityClient } from "@/components/my-availability-client";

export const dynamic = "force-dynamic";
export default async function MyAvailabilityPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fmy-availability");
  if (!hasCapability(principal, "AVAILABILITY_SELF_READ")) notFound();
  return <MyAvailabilityClient />;
}
