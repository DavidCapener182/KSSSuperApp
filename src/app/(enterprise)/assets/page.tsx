import { notFound } from "next/navigation";
import { AssetsWorkspace } from "@/components/assets-workspace";
import { ContextHeader } from "@/components/ui13/operational";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function AssetsPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) notFound();
  const office = principal.roles.includes("OFFICE_ADMIN");
  const operations = principal.roles.includes("OPERATIONS");
  const superAdmin = principal.roles.includes("SUPER_ADMIN");
  if (!office && !operations && !superAdmin) notFound();
  return <main className="enterprise-main"><ContextHeader context="KSS Enterprise · Synthetic development" title="Assets and stock"
    description="Native register, exact custody, condition and immutable history." />
    <AssetsWorkspace mode="register" office={office} operations={operations} superAdmin={superAdmin} /></main>;
}
