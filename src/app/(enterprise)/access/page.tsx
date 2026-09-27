import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { readDirectory } from "@/lib/people/directory";
import { createServerSupabase } from "@/lib/supabase/server";
import styles from "./access.module.css";

export const dynamic = "force-dynamic";

const areas = [
  { title: "Sites", description: "Exact Site assignments, reasons and Site lifecycle.", href: "/sites", action: "Manage at Site" },
  { title: "Incident review", description: "A separate finite grant plus an active Operations role.", href: "/access/incident-reviewers", action: "Manage reviewers" },
  { title: "Onboarding", description: "Team triage, named case ownership and finite cover remain distinct.", href: "/onboarding", action: "Open onboarding" },
  { title: "Site Book", description: "Contributor and manager grants belong to an exact Site Service.", href: "/site-book/access", action: "Manage Site Book access" },
  { title: "Training", description: "Author, publisher, assigner, assessment and completion rights have separate sources.", href: "/training-admin", action: "Open Training" },
  { title: "Service Delivery", description: "Proposer, approver and recorder grants are scoped to a Service Delivery record.", href: "/service-delivery", action: "Open Service Delivery" },
];

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect("/?next=%2Faccess");
  if (!principal.roles.includes("SUPER_ADMIN")) notFound();
  const raw = (await searchParams).search ?? "";
  const search = typeof raw === "string" ? raw.trim() : "";
  const valid = search.length <= 100 && !/[\x00-\x1f\x7f]/.test(search);
  const result = valid && search ? await readDirectory(client, principal,
    { search, role: "", onboarding: "", offset: 0, limit: 25 }) : null;
  return <main className={`enterprise-main ${styles.page}`}>
    <p className={styles.eyebrow}>Super Admin · Synthetic development</p>
    <h1>Access administration</h1>
    <p className={styles.intro}>Find a Person, review recorded roles, Site assignments and typed grants, then open the owning module for any change. Each source checks authority again.</p>
    <section className={styles.searchPanel} aria-labelledby="person-search-title">
      <div><h2 id="person-search-title">Find a Person</h2><p>Search the permitted People directory. Private Staff records and files are not included.</p></div>
      <form method="get" action="/access" role="search" className={styles.searchForm}>
        <label htmlFor="access-search">Name</label><div><input id="access-search" name="search" type="search" maxLength={100} defaultValue={valid ? search : ""} placeholder="Search People" /><button type="submit">Search</button></div>
      </form>
      {!valid && <p role="alert">Enter up to 100 ordinary characters.</p>}
      {search && valid && !result && <p role="alert">People search is unavailable. Try again.</p>}
      {result && <div className={styles.results}><h3>People</h3><p role="status">{result.total} match{result.total === 1 ? "" : "es"}{result.total > 25 ? " · showing first 25; refine the name" : ""}</p>
        {result.items.length ? <ul>{result.items.map((person) => <li key={person.id}><div><strong>{person.displayName}</strong><span>{person.roles.length ? person.roles.map((role) => role.replaceAll("_", " ")).join(" · ") : "No active role shown"}</span></div><Link href={`/access/people/${person.id}`}>Review access</Link></li>)}</ul> : <p>No matching People. Try another name.</p>}
      </div>}
    </section>
    <section className={styles.areas} aria-labelledby="source-title"><div className={styles.sectionHeading}><h2 id="source-title">Manage at the source</h2><p>Grant changes stay with the module that owns their rules and history.</p></div><div className={styles.cards}>{areas.map((area) => <article key={area.href} className={styles.card}><h3>{area.title}</h3><p>{area.description}</p><Link href={area.href}>{area.action} <span aria-hidden="true">→</span></Link></article>)}</div></section>
  </main>;
}
