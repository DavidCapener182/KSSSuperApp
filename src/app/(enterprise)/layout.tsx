import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { EnterpriseShell } from "@/components/enterprise-shell";
import { navigationFor } from "@/lib/auth/capabilities";
import { getEnterpriseAccess } from "@/lib/auth/principal";
import { safeReturnTarget } from "@/lib/auth/return-target";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EnterpriseLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getEnterpriseAccess(await createServerSupabase());
  if (access.state !== "active") {
    const target = safeReturnTarget((await headers()).get("x-kss-return-target")) ?? "/app";
    redirect(`/?next=${encodeURIComponent(target)}`);
  }
  const { principal } = access;
  return <EnterpriseShell person={{ id: principal.personId, name: principal.displayName }} roles={principal.roles} navigation={navigationFor(principal)}>{children}</EnterpriseShell>;
}
