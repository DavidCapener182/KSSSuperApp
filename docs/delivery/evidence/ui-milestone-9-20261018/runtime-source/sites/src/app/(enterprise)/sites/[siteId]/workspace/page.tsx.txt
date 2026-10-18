import Link from "next/link";
import styles from "@/components/site-operations.module.css";
import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { canUseSites, canViewSite, SITE_COLUMNS, type Site } from "@/lib/sites/policy";

export const dynamic = "force-dynamic";

export default async function SiteWorkspacePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!isUuid(siteId)) notFound();
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect(`/?next=${encodeURIComponent(`/sites/${siteId}/workspace`)}`);
  if (!canUseSites(principal)) notFound();
  const { data: site, error } = await client.from("sites").select(SITE_COLUMNS).eq("id", siteId).maybeSingle<Site>();
  if (error || !site || !await canViewSite(client, principal, site)) notFound();

  return <main className={`enterprise-main ${styles.workspace}`}>
    <p><Link href="/sites">← All Sites</Link></p>
    <header className={styles.pageHeading}><div><p className="eyebrow">Site workspace</p><h1>{site.name}</h1>
      <p>{site.address_line1}, {site.town_city}, {site.postcode}</p></div></header>
    <section className={styles.availability} aria-labelledby="workspace-status"><span className={styles.state}>Workspace unavailable</span>
      <h2 id="workspace-status">Coming soon</h2>
      <p>This Site’s workspace is being built. Its records will appear here when the workspace is ready.</p>
      <p><Link href="/sites">Return to Sites</Link></p>
    </section>
  </main>;
}
