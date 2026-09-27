import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { EnterpriseShell } from "@/components/enterprise-shell";
import { navigationFor } from "@/lib/auth/capabilities";
import { getEnterpriseAccess } from "@/lib/auth/principal";
import { safeReturnTarget } from "@/lib/auth/return-target";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EnterpriseLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const client = await createServerSupabase();
  const access = await getEnterpriseAccess(client);
  if (access.state !== "active") {
    const target = safeReturnTarget((await headers()).get("x-kss-return-target")) ?? "/app";
    redirect(`/?next=${encodeURIComponent(target)}`);
  }
  const { principal } = access;
  const navigation = navigationFor(principal);
  const { data: workspaces, error: workspaceError } = await client.rpc("cw_directory");
  if (!workspaceError && Array.isArray(workspaces) && workspaces.length > 0 && !navigation.some((item) => item.href === "/client-workspaces")) {
    navigation.push({ href: "/client-workspaces", label: "Client workspaces" });
  }
  if (!principal.roles.includes("SUPER_ADMIN")) {
    const { data: tfsWorkspace } = await client.rpc("cw_tfs_entry");
    if (typeof tfsWorkspace === "string") navigation.push({ href: "/tfs", label: "TFS" });
  }
  if (principal.roles.includes("SUPER_ADMIN")) {
    navigation.push({ href: "/client-workspaces/manage", label: "Workspace access" });
  }
  return <EnterpriseShell person={{ id: principal.personId, name: principal.displayName }} roles={principal.roles} incidentReviewer={principal.incidentReviewer} navigation={navigation}>{children}</EnterpriseShell>;
}
