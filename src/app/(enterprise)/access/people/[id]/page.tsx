import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { readPersonAccessReview, type DomainGrant, type RoleGrant, type SiteGrant } from "@/lib/access/review";
import { createServerSupabase } from "@/lib/supabase/server";
import styles from "../../access.module.css";

export const dynamic = "force-dynamic";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : "No end recorded";
const status = (row: { effective_from?: string; effective_until?: string | null; effectiveFrom?: string; effectiveUntil?: string | null; revoked_at?: string | null; revokedAt?: string | null }) => {
  const from = row.effective_from ?? row.effectiveFrom ?? "";
  const until = row.effective_until ?? row.effectiveUntil ?? null;
  const revoked = row.revoked_at ?? row.revokedAt;
  const now = Date.now();
  if (revoked) return "Revoked";
  if (Date.parse(from) > now) return "Scheduled";
  if (until && Date.parse(until.length === 10 ? `${until}T23:59:59Z` : until) <= now) return "Ended";
  return "Within grant dates";
};
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const actor = (id: string | null, grantors: Record<string, string>) => id ? grantors[id] ?? "Recorded Person unavailable" : "Not recorded";

function RoleItem({ row, grantors }: { row: RoleGrant; grantors: Record<string, string> }) {
  return <li className={styles.fact}><div className={styles.factHeading}><strong>{label(row.role_code)}</strong><span>{status(row)}</span></div><p>{date(row.effective_from)} → {date(row.effective_until)}</p><p>Granted by {actor(row.granted_by, grantors)} · Reason not recorded in role source</p>{row.revoked_at && <p>Revoked {date(row.revoked_at)}</p>}</li>;
}
function SiteItem({ row, grantors }: { row: SiteGrant & { siteName: string; siteStatus: string }; grantors: Record<string, string> }) {
  return <li className={styles.fact}><div className={styles.factHeading}><strong>{row.siteName}</strong><span>{status(row)} · Site {label(row.siteStatus)}</span></div><p>{date(row.effective_from)} → {date(row.effective_until)}</p><p>Granted by {actor(row.granted_by, grantors)} · {row.change_reason}</p>{row.revoked_at && <p>Revoked {date(row.revoked_at)}</p>}<Link href="/sites">Open Sites <span aria-hidden="true">→</span></Link></li>;
}
function GrantItem({ row, grantors }: { row: DomainGrant; grantors: Record<string, string> }) {
  return <li className={styles.fact}><div className={styles.factHeading}><strong>{label(row.capability)}</strong><span>{status(row)}</span></div><p>{row.scopeName}{row.scopeId ? ` · ${label(row.scopeKind)}` : ""}</p><p>{date(row.effectiveFrom)} → {date(row.effectiveUntil)}</p><p>Granted by {actor(row.grantedBy, grantors)} · {row.reason ?? "Reason not recorded in source"}</p>{row.revokedAt && <p>Revoked {date(row.revokedAt)}{row.revocationReason ? ` · ${row.revocationReason}` : ""}</p>}<Link href={row.sourceHref}>Open source <span aria-hidden="true">→</span></Link></li>;
}

export default async function PersonAccessPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ history?: string; offset?: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect(`/?next=${encodeURIComponent(`/access/people/${id}`)}`);
  if (!principal.roles.includes("SUPER_ADMIN")) notFound();
  const review = await readPersonAccessReview(client, principal, id);
  if (!review) notFound();
  const grouped = Map.groupBy(review.domainGrants, (grant) => grant.domain);
  const query = await searchParams;
  const historyDomain = typeof query.history === "string" && (["ROLES", "SITES"].includes(query.history) || grouped.has(query.history)) ? query.history : null;
  const historyOffset = typeof query.offset === "string" && /^\d{1,5}$/.test(query.offset) ? Number(query.offset) : 0;
  const roleCurrent = review.roles.filter((row) => ["Within grant dates", "Scheduled"].includes(status(row)));
  const roleHistory = review.roles.filter((row) => !["Within grant dates", "Scheduled"].includes(status(row)));
  const siteCurrent = review.sites.filter((row) => ["Within grant dates", "Scheduled"].includes(status(row)));
  const siteHistory = review.sites.filter((row) => !["Within grant dates", "Scheduled"].includes(status(row)));
  const historyWindow = (section: string, count: number) => {
    const browsing = historyDomain === section;
    const offset = browsing ? Math.min(historyOffset, Math.max(0, count - 1)) : 0;
    const size = browsing ? 20 : 3;
    const href = (next: number) => `/access/people/${id}?history=${encodeURIComponent(section)}&offset=${next}`;
    return { offset, size, nav: browsing
      ? <nav aria-label={`${label(section)} history pages`} className={styles.historyNav}><span>Showing {offset + 1}–{Math.min(offset + size, count)} of {count}</span>{offset > 0 && <Link href={href(Math.max(0, offset - 20))}>Previous</Link>}{offset + 20 < count && <Link href={href(offset + 20)}>Next</Link>}<Link href={`/access/people/${id}`}>Close history</Link></nav>
      : count > 3 ? <Link href={href(0)}>Browse all {count} historical rows</Link> : null };
  };
  const roleWindow = historyWindow("ROLES", roleHistory.length);
  const siteWindow = historyWindow("SITES", siteHistory.length);
  return <main className={`enterprise-main ${styles.page}`}>
    <nav className={styles.localNav} aria-label="Access review navigation"><Link href="/access">← Access administration</Link><Link href={`/people/${id}`}>Staff Record</Link></nav>
    <p className={styles.eyebrow}>Super Admin · Read-only · Synthetic development</p><h1>{review.person.displayName}</h1><p className={styles.intro}>Access &amp; grants</p>
    <p className={styles.boundary}>These are recorded source facts, not a promise that an action is currently allowed. The owning module also checks the Person’s active role, exact resource, current state and any independent file audience. Changes are made only at that source.</p>
    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="roles-title"><h2 id="roles-title">Roles</h2>{roleCurrent.length ? <ul className={styles.facts}>{roleCurrent.map((row) => <RoleItem key={row.id} row={row} grantors={review.grantors} />)}</ul> : <p>No roles within their recorded dates.</p>}{roleHistory.length > 0 && <div className={styles.history}><h3>Role history · {roleHistory.length}</h3><ul className={styles.facts}>{roleHistory.slice(roleWindow.offset, roleWindow.offset + roleWindow.size).map((row) => <RoleItem key={row.id} row={row} grantors={review.grantors} />)}</ul>{roleWindow.nav}</div>}</section>
      <section className={styles.panel} aria-labelledby="sites-title"><h2 id="sites-title">Site assignments</h2>{siteCurrent.length ? <ul className={styles.facts}>{siteCurrent.map((row) => <SiteItem key={row.id} row={row} grantors={review.grantors} />)}</ul> : <p>No Site assignments within their recorded dates.</p>}{siteHistory.length > 0 && <div className={styles.history}><h3>Site history · {siteHistory.length}</h3><ul className={styles.facts}>{siteHistory.slice(siteWindow.offset, siteWindow.offset + siteWindow.size).map((row) => <SiteItem key={row.id} row={row} grantors={review.grantors} />)}</ul>{siteWindow.nav}</div>}</section>
    </div>
    <section className={styles.panel} aria-labelledby="grants-title"><div className={styles.sectionHeading}><h2 id="grants-title">Typed domain grants</h2><p>Historical rows remain visible after expiry or revocation. A recorded grant can be ineffective when its required role or source scope is no longer valid.</p></div>
      {review.domainGrants.length ? <div className={styles.grantGroups}>{[...grouped.entries()].map(([domain, grants]) => {
        const current = grants.filter((grant) => ["Within grant dates", "Scheduled"].includes(status(grant)));
        const historical = grants.filter((grant) => !["Within grant dates", "Scheduled"].includes(status(grant)));
        const browsing = historyDomain === domain;
        const offset = browsing ? Math.min(historyOffset, Math.max(0, historical.length - 1)) : 0;
        const shownHistory = historical.slice(offset, offset + (browsing ? 20 : 3));
        const historyHref = (nextOffset: number) => `/access/people/${id}?history=${encodeURIComponent(domain)}&offset=${nextOffset}`;
        return <section key={domain} aria-label={label(domain)}><h3>{label(domain)}</h3>
          {current.length ? <ul className={styles.facts}>{current.map((row) => <GrantItem key={`${domain}-${row.grantId}`} row={row} grantors={review.grantors} />)}</ul> : <p>No grants within their recorded dates.</p>}
          {historical.length > 0 && <div className={styles.history}><h4>Historical grants · {historical.length}</h4><ul className={styles.facts}>{shownHistory.map((row) => <GrantItem key={`${domain}-${row.grantId}`} row={row} grantors={review.grantors} />)}</ul>
            {browsing ? <nav aria-label={`${label(domain)} grant history pages`} className={styles.historyNav}><span>Showing {offset + 1}–{Math.min(offset + 20, historical.length)} of {historical.length}</span>{offset > 0 && <Link href={historyHref(Math.max(0, offset - 20))}>Previous</Link>}{offset + 20 < historical.length && <Link href={historyHref(offset + 20)}>Next</Link>}<Link href={`/access/people/${id}`}>Close history</Link></nav>
              : historical.length > 3 && <Link href={historyHref(0)}>Browse all {historical.length} historical rows</Link>}
          </div>}
        </section>;
      })}</div> : <p>No typed domain grants recorded by the included sources.</p>}
    </section>
    <p className={styles.limit}>Source limits: role assignments have no reason field; some older grant sources lack a reason or revocation reason. No private case content, evidence metadata, file bytes or Credential reference is included. Open a source link for its current action decision.</p>
  </main>;
}
