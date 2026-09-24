import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { ManagementReportsClient } from "@/components/management-reports-client";

export const dynamic = "force-dynamic";

export default async function ManagementReportsPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fmanagement-reports");
  if (!principal.roles.some((role) => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) notFound();
  return <ManagementReportsClient />;
}
