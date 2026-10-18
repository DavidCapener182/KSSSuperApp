import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal } from "@/lib/auth/principal";
import { parseDirectoryFilters, readDirectory, type DirectoryPerson } from "@/lib/people/directory";
import { createServerSupabase } from "@/lib/supabase/server";
import styles from "./people.module.css";
import { PeopleLiveSearch } from "./people-live-search";

export const dynamic = "force-dynamic";

type Query = Promise<Record<string, string | string[] | undefined>>;
const roleOptions = ["", "SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS", "SECURITY_STAFF"];
const label = (value: string) => value ? value.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "All";

function personHref(person: DirectoryPerson) { return `/people/${person.id}`; }
function position(person: DirectoryPerson) {
  if (person.onboardingState === "IN_PROGRESS")
    return person.completed === null ? "Onboarding in progress" : `${person.completed} of ${person.totalRequirements} requirements complete`;
  if (person.onboardingState === "DRAFT") return "Onboarding draft";
  return "Existing staff";
}

export default async function PeoplePage({ searchParams }: { searchParams: Query }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect("/?next=%2Fpeople");
  if (!hasCapability(principal, "PEOPLE_DIRECTORY")) notFound();
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["search", "role", "offset", "limit"]) {
    const value = raw[key];
    if (typeof value === "string") query.set(key, value);
  }
  const view = raw.view === "onboarding" ? "onboarding" : "existing";
  query.set("view", view);
  const filters = parseDirectoryFilters(query);
  if (!filters) return <main className="enterprise-main"><h1>People</h1><p role="alert">Check the search or filter values and try again.</p><Link href="/people">Clear filters</Link></main>;
  const result = await readDirectory(client, principal, {
    ...filters, onboarding: view === "existing" ? "NONE" : "IN_PROGRESS",
  });
  const drafts = view === "onboarding" ? await readDirectory(client, principal, {
    ...filters, onboarding: "DRAFT", offset: 0, limit: 50,
  }) : null;
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
  const hasFilters = Boolean(filters.search || filters.role);
  const ids = [...result.items, ...(drafts?.items ?? [])].map((person) => person.id);
  const { data: positionRows } = ids.length ? await client.from("person_work_positions")
    .select("person_id,position_name").eq("source_system", "PARIM").in("person_id", ids) : { data: [] };
  const positions = new Map<string, string[]>();
  for (const row of positionRows ?? []) positions.set(row.person_id,
    [...(positions.get(row.person_id) ?? []), row.position_name]);
  const workPosition = (person: DirectoryPerson) => positions.get(person.id)?.join(" · ") || "Not recorded";
  const workingRole = (person: DirectoryPerson) => {
    const titles = positions.get(person.id) ?? [];
    if (titles.some((title) => /HQ - Operations|Event Ops Manager|Event Control Operative|Event Logistics/i.test(title))) return "Operations";
    if (titles.some((title) => /Office Admin/i.test(title))) return "Office admin";
    if (titles.some((title) => /Door Supervisor|Security Officer/i.test(title))) return "Security";
    if (titles.some((title) => /Event Steward/i.test(title))) return "Steward";
    return titles.length ? "Other recorded position" : "Not recorded";
  };
  const renderRegister = (people: DirectoryPerson[]) => people.length ? <>
    <div className="people-table-wrap"><table className="people-table"><thead><tr><th scope="col">Person</th><th scope="col">Working role</th><th scope="col">PARiM positions</th><th scope="col">KSS access role</th><th scope="col">Case state</th><th scope="col"><span className="sr-only">Open record</span></th></tr></thead><tbody>
      {people.map((person) => <tr key={person.id}><th scope="row"><Link className={styles.personName} href={personHref(person)}>{person.displayName}</Link></th><td>{workingRole(person)}</td><td>{workPosition(person)}</td><td>{person.roles.length ? person.roles.map(label).join(" · ") : "No access role assigned"}</td><td>{position(person)}</td><td><Link href={personHref(person)}>Open record</Link></td></tr>)}
    </tbody></table></div>
    <ul className="people-mobile-list">{people.map((person) => <li key={person.id} className="people-mobile-card"><div><strong>{person.displayName}</strong><span>{workingRole(person)}</span></div><p className={styles.caseState}>{position(person)}</p><Link href={personHref(person)}>Open record <span aria-hidden="true">→</span></Link><dl className={styles.accessFacts}><div><dt>PARiM positions</dt><dd>{workPosition(person)}</dd></div><div><dt>KSS access role</dt><dd>{person.roles.length ? person.roles.map(label).join(" · ") : "No access role assigned"}</dd></div></dl></li>)}</ul>
  </> : <div className="people-empty"><h3>No matching people</h3><p>Try a different name or clear the filters.</p></div>;
  return <main className={`enterprise-main people-page ${styles.workspace}`}>
    <header className={styles.directoryHeader}><p className="eyebrow">KSS directory</p><h1>People</h1><p className="enterprise-intro">Find a person and open their scoped staff record. Private details are checked separately.</p></header>
    <nav className={styles.groups} aria-label="People groups"><Link href="/people?view=existing" aria-current={view === "existing" ? "page" : undefined}>Existing staff</Link><Link href="/people?view=onboarding" aria-current={view === "onboarding" ? "page" : undefined}>Onboarding staff</Link></nav>
    <form className="people-filters" method="get" action="/people" role="search">
      <input type="hidden" name="view" value={view} />
      <label>Search name, role or permitted Site<PeopleLiveSearch initialValue={filters.search} /></label>
      <label>KSS access role<select name="role" defaultValue={filters.role}>{roleOptions.map((value) => <option value={value} key={value}>{label(value)}</option>)}</select></label>
      <button type="submit">Apply filters</button>
    </form>
    {hasFilters && <Link className={styles.clearFilters} href="/people">Clear filters</Link>}
    <section className={styles.registerSection} aria-labelledby="people-results-heading">
      <div className="people-result-heading"><h2 id="people-results-heading">{view === "existing" ? "Existing staff" : "Ongoing onboarding cases"}</h2><p role="status">{result.total} {result.total === 1 ? "person" : "people"} matching this list</p></div>
      {renderRegister(result.items)}
      <div className="people-pagination">
        {filters.offset > 0 && <Link href={pageLink(Math.max(0, filters.offset - filters.limit))}>Previous</Link>}
        <span>Showing {result.items.length ? filters.offset + 1 : 0}–{filters.offset + result.items.length} of {result.total}</span>
        {filters.offset + filters.limit < result.total && <Link href={pageLink(filters.offset + filters.limit)}>Next</Link>}
      </div>
    </section>
    {view === "onboarding" && <section className={styles.registerSection} aria-labelledby="people-drafts-heading"><div className="people-result-heading"><h2 id="people-drafts-heading">Onboarding drafts</h2><p role="status">{drafts ? `${drafts.items.length} returned of ${drafts.total} matching drafts` : "Draft list unavailable"}</p></div><p className={styles.scopeNote}>Separate draft results · up to 50 returned. The page controls above apply only to ongoing onboarding cases.</p>{drafts ? renderRegister(drafts.items) : <p role="status" className="people-restricted">Drafts could not be loaded. The ongoing case list above is separate.</p>}</section>}
    {isOperations && <p className="enterprise-honesty">This Operations view contains directory information only. Private personnel records and evidence remain restricted.</p>}
  </main>;
}
