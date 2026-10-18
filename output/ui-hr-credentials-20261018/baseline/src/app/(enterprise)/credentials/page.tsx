import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { CredentialsClient } from "@/components/credentials-client";

export const dynamic = "force-dynamic";
export default async function CredentialsPage({ searchParams }: { searchParams: Promise<{ personId?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fcredentials");
  const { personId } = await searchParams;
  if (!principal.roles.some((role) => role === "SECURITY_STAFF" || role === "OFFICE_ADMIN" || role === "SUPER_ADMIN"))
    return <main className="enterprise-main"><h1>Credentials</h1><p>Credential detail is restricted.</p></main>;
  return <CredentialsClient personId={personId ?? principal.personId} self={personId === undefined || personId === principal.personId}
    office={principal.roles.includes("OFFICE_ADMIN")} superAdmin={principal.roles.includes("SUPER_ADMIN")} />;
}
