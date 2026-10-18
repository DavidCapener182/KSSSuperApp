import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import styles from "./settings.module.css";

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

  return <main className={`enterprise-main ${styles.page}`}>
    <header className={styles.header}><p className={styles.eyebrow}>Administration</p>
    <h1>Settings</h1>
    <p className="enterprise-intro">Manage access in the area that owns each permission and its history.</p>
    </header><ul className={styles.directory}>{areas.map((area) => <li key={area.href}><Link href={area.href}>
      <span><strong>{area.title}</strong><small>{area.description}</small></span><span className={styles.arrow} aria-hidden="true">→</span>
    </Link></li>)}</ul>
  </main>;
}
