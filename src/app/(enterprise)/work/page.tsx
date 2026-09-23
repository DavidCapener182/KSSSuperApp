import { redirect, notFound } from "next/navigation";
import { WorkClient } from "@/components/work-client";
import { getPrincipal } from "@/lib/auth/principal";
import { canUseWork } from "@/lib/tasks/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function WorkPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fwork");
  if (!canUseWork(principal)) notFound();
  return <WorkClient />;
}
