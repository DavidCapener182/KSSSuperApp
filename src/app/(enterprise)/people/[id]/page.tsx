import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { readDirectory } from "@/lib/people/directory";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const title = (role: string) => role.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export default async function PersonRecord({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect(`/?next=${encodeURIComponent(`/people/${id}`)}`);
  const result = await readDirectory(client, principal,
    { search: "", role: "", onboarding: "", offset: 0, limit: 1 }, id);
  const person = result?.items[0];
  if (!person) notFound();
  const self = principal.personId === id;
  const canOpenCase = Boolean(person.onboardingCaseId);
  const caseHref = person.onboardingCaseId ? `/onboarding/${person.onboardingCaseId}` : null;
  const backHref = principal.roles.some((r) => r === "OFFICE_ADMIN" || r === "OPERATIONS" || r === "SUPER_ADMIN") ? "/people" : "/profile";
  return <main className="enterprise-main people-record">
    <Link className="people-back" href={backHref}>← {backHref === "/people" ? "People" : "Profile"}</Link>
    <header className="people-record-header"><div><p className="eyebrow">Staff record · synthetic development data</p><h1>{person.displayName}</h1><p>{person.roles.length ? person.roles.map(title).join(" · ") : "No active role"}</p></div><span className="people-record-state">{person.onboardingState === "IN_PROGRESS" ? "Onboarding in progress" : person.onboardingState === "DRAFT" ? "Onboarding draft" : "No current onboarding case"}</span></header>
    <nav className="people-record-nav" aria-label="Staff record sections">{["Overview", "Personal details", "Onboarding", "Credentials", "Documents", "Training", "Sites", "Activity"].map((section) => <a href={`#${section.toLowerCase().replaceAll(" ", "-")}`} key={section}>{section}</a>)}</nav>
    <div className="people-record-grid">
      <section id="overview" className="people-record-section"><h2>Overview</h2><dl><div><dt>Active roles</dt><dd>{person.roles.length ? person.roles.map(title).join(" · ") : "None"}</dd></div><div><dt>Onboarding</dt><dd>{person.onboardingState === "IN_PROGRESS" && person.completed !== null ? `${person.completed} of ${person.totalRequirements} requirements complete` : person.onboardingState === "NONE" ? "No current case" : title(person.onboardingState)}</dd></div><div><dt>Site context</dt><dd>{person.sites.length ? person.sites.join(" · ") : "No permitted Site context shown"}</dd></div></dl><p className="enterprise-honesty">Directory information does not establish compliance or deployment eligibility.</p></section>
      <section id="personal-details" className="people-record-section"><h2>Personal details</h2><p>{self ? "Your current details are managed in Profile. Submitted onboarding history remains separate." : "Private contact and address details require separate personnel authority."}</p>{self ? <Link href="/profile">Open my Profile</Link> : canOpenCase && caseHref ? <Link href={caseHref}>Open authorised onboarding details</Link> : <span className="people-restricted">Restricted</span>}</section>
      <section id="onboarding" className="people-record-section"><h2>Onboarding</h2><p>{person.onboardingState === "NONE" ? "No current onboarding case." : person.completed === null ? "A current onboarding case exists. Detailed progress is restricted." : `${person.completed} of ${person.totalRequirements} requirements complete. The case is ${title(person.onboardingState)}.`}</p>{caseHref && <Link href={caseHref}>Open authorised case</Link>}</section>
      <section id="credentials" className="people-record-section"><h2>Credentials</h2><p>Credential values and evidence remain in the protected Profile and onboarding workflows.</p>{self ? <Link href="/profile">Open my credential section</Link> : caseHref ? <Link href={caseHref}>Open authorised onboarding case</Link> : <span className="people-restricted">Details restricted</span>}</section>
      <section id="documents" className="people-record-section"><h2>Documents</h2><p>Personnel documents retain their own exact audience and file access controls. This record does not expose filenames or counts.</p>{self ? <Link href="/documents">Open my Documents</Link> : caseHref ? <Link href={caseHref}>Open authorised case documents</Link> : <span className="people-restricted">Details restricted</span>}</section>
      <section id="training" className="people-record-section"><h2>Training</h2><p>Training provider not connected. No completion or eligibility is inferred.</p></section>
      <section id="sites" className="people-record-section"><h2>Sites / assignments</h2><p>{person.sites.length ? person.sites.join(" · ") : "No Site assignment is visible under your current access."}</p></section>
      <section id="activity" className="people-record-section"><h2>Activity</h2><p>A safe staff activity timeline has not been configured. Business and audit histories remain in their authorised source workflows.</p></section>
    </div>
  </main>;
}
