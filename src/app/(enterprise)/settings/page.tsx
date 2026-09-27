import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fsettings");
  const superAdmin = principal.roles.includes("SUPER_ADMIN");
  if (!superAdmin && !principal.roles.includes("OFFICE_ADMIN")) notFound();

  const areas = [
    ...(superAdmin ? [
      { href: "/client-workspaces/manage", title: "Workspace access", description: "Provision client workspaces and manage exact Person and module grants." },
      { href: "/access", title: "Access administration", description: "Review People, roles, Site assignments and source-owned permissions." },
    ] : []),
    { href: "/site-book/access", title: "Site Book access", description: "Manage finite contributor and manager grants for a Site Service." },
  ];

  return <main className="enterprise-main enterprise-settings">
    <p className="enterprise-settings-eyebrow">ADMINISTRATION</p>
    <h1>Settings</h1>
    <p className="enterprise-intro">Manage access in the area that owns each permission and its history.</p>
    <div className="enterprise-card-grid">{areas.map((area) => <Link className="enterprise-card" href={area.href} key={area.href}>
      <strong>{area.title}</strong><span>{area.description}</span>
    </Link>)}</div>
  </main>;
}
