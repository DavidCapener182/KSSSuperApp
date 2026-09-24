import { notFound } from "next/navigation";
import { AssetsWorkspace } from "@/components/assets-workspace";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function MyEquipmentPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal || !principal.roles.includes("SECURITY_STAFF")) notFound();
  return <main className="enterprise-main"><header><p>KSS Enterprise · Synthetic development</p><h1>My Equipment</h1>
    <p>Review items and uniform issued to you. Acknowledging confirms receipt, not condition or usage.</p></header>
    <AssetsWorkspace mode="self" office={false} operations={false} superAdmin={false} /></main>;
}
