import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal } from "@/lib/auth/principal";
import { parseDirectoryFilters, readDirectory, type DirectoryPerson } from "@/lib/people/directory";
import { createServerSupabase } from "@/lib/supabase/server";
import styles from "./people.module.css";

export const dynamic = "force-dynamic";

type Query = Promise<Record<string, string | string[] | undefined>>;
const roleOptions = ["", "SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS", "SECURITY_STAFF"];
const stateOptions = ["", "IN_PROGRESS", "DRAFT", "NONE"];
const label = (value: string) => value ? value.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "All";

function personHref(person: DirectoryPerson) { return `/people/${person.id}`; }
function position(person: DirectoryPerson) {
  if (person.onboardingState === "IN_PROGRESS")
    return person.completed === null ? "Onboarding in progress" : `${person.completed} of ${person.totalRequirements} requirements complete`;
  if (person.onboardingState === "DRAFT") return "Onboarding draft";
  return "No current onboarding case";
}

export default async function PeoplePage({ searchParams }: { searchParams: Query }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect("/?next=%2Fpeople");
  if (!hasCapability(principal, "PEOPLE_DIRECTORY")) notFound();
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["search", "role", "onboarding", "offset", "limit"]) {
    const value = raw[key];
    if (typeof value === "string") query.set(key, value);
  }
  const filters = parseDirectoryFilters(query);
  if (!filters) return <main className="enterprise-main"><h1>People</h1><p role="alert">Check the search or filter values and try again.</p><Link href="/people">Clear filters</Link></main>;
  const result = await readDirectory(client, principal, filters);
  if (!result) return <main className="enterprise-main"><h1>People</h1><p role="alert">The directory is temporarily unavailable. Please retry.</p></main>;
  if (result.total > 0 && filters.offset >= result.total) {
    query.set("offset", "0");
    redirect(`/people?${query.toString()}`);
  }
  const isOperations = principal.roles.includes("OPERATIONS") && !principal.roles.some((r) => r === "OFFICE_ADMIN" || r === "SUPER_ADMIN");
  const pageLink = (offset: number) => {
    const next = new URLSearchParams(query);
    next.set("offset", String(offset));
    return `/people?${next.toString()}`;
  };
  const hasFilters = Boolean(filters.search || filters.role || filters.onboarding);
  return <main className={`enterprise-main people-page ${styles.workspace}`}>
    <p className="eyebrow">KSS directory · synthetic development data</p>
    <h1>People</h1>
    <p className="enterprise-intro">Find a person and open their scoped staff record. Private details are checked separately.</p>
    <form className="people-filters" method="get" action="/people" role="search">
      <label>Search name, role or permitted Site<input name="search" maxLength={100} defaultValue={filters.search} placeholder="Search People" /></label>
      <label>Role<select name="role" defaultValue={filters.role}>{roleOptions.map((value) => <option value={value} key={value}>{label(value)}</option>)}</select></label>
      <label>Onboarding<select name="onboarding" defaultValue={filters.onboarding}>{stateOptions.map((value) => <option value={value} key={value}>{value === "NONE" ? "No current case" : label(value)}</option>)}</select></label>
      <button type="submit">Apply filters</button>
    </form>
    {hasFilters && <Link className={styles.clearFilters} href="/people">Clear filters</Link>}
    <div className="people-result-heading"><h2>Directory</h2><p role="status">{result.total} {result.total === 1 ? "person" : "people"} in this view</p></div>
    {result.items.length === 0 ? <section className="people-empty"><h3>No matching People</h3><p>Try a different name or clear the filters.</p><Link href="/people">Clear filters</Link></section> : <>
      <div className="people-table-wrap"><table className="people-table"><thead><tr><th scope="col">Person</th><th scope="col">Active roles</th><th scope="col">Onboarding</th><th scope="col">Permitted Site context</th><th scope="col"><span className="sr-only">Open record</span></th></tr></thead><tbody>
        {result.items.map((person) => <tr key={person.id}><th scope="row">{person.displayName}</th><td>{person.roles.length ? person.roles.map(label).join(" · ") : "No active role"}</td><td>{position(person)}</td><td>{person.sites.length ? person.sites.join(" · ") : "No Site context shown"}</td><td><Link href={personHref(person)}>View record</Link></td></tr>)}
      </tbody></table></div>
      <ul className="people-mobile-list">{result.items.map((person) => <li key={person.id} className="people-mobile-card"><div><strong>{person.displayName}</strong><span>{person.roles.length ? person.roles.map(label).join(" · ") : "No active role"}</span></div><p><b>Onboarding</b>{position(person)}</p><p><b>Site context</b>{person.sites.length ? person.sites.join(" · ") : "No Site context shown"}</p><Link href={personHref(person)}>View staff record <span aria-hidden="true">→</span></Link></li>)}</ul>
    </>}
    <div className="people-pagination">
      {filters.offset > 0 && <Link href={pageLink(Math.max(0, filters.offset - filters.limit))}>Previous</Link>}
      <span>Showing {result.items.length ? filters.offset + 1 : 0}–{filters.offset + result.items.length} of {result.total}</span>
      {filters.offset + filters.limit < result.total && <Link href={pageLink(filters.offset + filters.limit)}>Next</Link>}
    </div>
    {isOperations && <p className="enterprise-honesty">This Operations view contains directory information only. Private personnel records and evidence remain restricted.</p>}
  </main>;
}
