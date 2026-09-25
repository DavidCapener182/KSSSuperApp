import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal } from "@/lib/auth/principal";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { readDirectory, type DirectoryPerson } from "@/lib/people/directory";
import { readStaffRecordSections } from "@/lib/people/record";
import { requiredProfileMatches, SIA_LABELS } from "@/lib/profile/policy";
import { credentialState, type CredentialDecisionState } from "@/lib/credentials/state";
import { createServerSupabase } from "@/lib/supabase/server";
import styles from "../people.module.css";

export const dynamic = "force-dynamic";
const complete = new Set(["VERIFIED", "COMPLETE", "ACKNOWLEDGED"]);
const roleLabel = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(value)) : "Open-ended";
const sections = ["Overview", "Personal details", "Onboarding", "Credentials", "Documents", "Training", "Sites", "Activity"];
function Restricted({ name }: { name: string }) {
  return <p className="people-restricted">{name} restricted. Directory access does not include private personnel records.</p>;
}

async function StaffRecordBody({ client, principal, person }: { client: SupabaseClient; principal: Principal; person: DirectoryPerson }) {
  const self = principal.personId === person.id;
  const detail = await readStaffRecordSections(client, principal, person.id, person.onboardingCaseId);
  const oversight = principal.roles.includes("SUPER_ADMIN")
    ? await client.rpc("read_credential_oversight_16b", { subject: person.id }) : null;
  const oversightData = oversight?.data as { claims: { id: string; type_code: string; latest_revision_id: string | null;
    draft_change_seq: number; withdrawn_at: string | null }[];
    revisions: { id: string; draft_change_seq: number; expires_on: string | null }[];
    decisions: CredentialDecisionState[] } | null;
  const { data: credentialClaims } = oversightData ? { data: oversightData.claims } : await client.from("credential_claims_16b")
    .select("id,type_code,latest_revision_id,draft_change_seq,withdrawn_at").eq("person_id", person.id);
  const credentialIds = (credentialClaims ?? []).flatMap((item) => item.latest_revision_id ? [item.latest_revision_id] : []);
  const { data: credentialRevisions } = oversightData ? { data: oversightData.revisions } : credentialIds.length ? await client.from("credential_revisions_16b")
    .select("id,draft_change_seq,expires_on").in("id", credentialIds) : { data: [] };
  const { data: credentialDecisions } = oversightData ? { data: oversightData.decisions } : credentialIds.length ? await client.from("credential_decisions_16b")
    .select("revision_id,decision").in("revision_id", credentialIds) : { data: [] };
  const currentCase = detail.cases.find((row) => row.state === "IN_PROGRESS") ?? detail.cases[0] ?? null;
  const nextRequirement = currentCase?.requirements.find((row) => !complete.has(row.state));
  const sia = currentCase?.requirements.find((row) => row.code === "SIA_LICENCE");
  const credential = currentCase?.submittedSia ?? currentCase?.siaCredential ?? null;
  const profile = detail.profile;
  const submitted = detail.submittedProfile;
  const profileChanged = Boolean(profile && submitted && !requiredProfileMatches(profile, submitted));
  const safeStatus = person.onboardingState === "IN_PROGRESS"
    ? person.completed === null ? "Onboarding in progress" : `${person.completed} of ${person.totalRequirements} requirements complete`
    : person.onboardingState === "DRAFT" ? "Onboarding draft" : "No current onboarding case";
  return <div className="people-record-grid">
    <section id="overview" className="people-record-section people-record-overview">
      <div className="people-section-heading"><h2>Overview</h2><span className="people-record-state">{safeStatus}</span></div>
      <dl className="people-overview-list">
        <div><dt>Active roles</dt><dd>{person.roles.length ? person.roles.map(roleLabel).join(" · ") : "No active role"}</dd></div>
        <div><dt>Current work context</dt><dd>{person.sites.length ? person.sites.join(" · ") : "No permitted Site context shown"}</dd></div>
        <div><dt>Training</dt><dd>Provider not connected</dd></div>
        {profile?.preferred_name && <div><dt>Preferred name</dt><dd>{profile.preferred_name}</dd></div>}
        {currentCase && <div><dt>Authorised case</dt><dd>{currentCase.verifiedCount} of {currentCase.totalCount} requirements complete · Template v{currentCase.templateVersion}</dd></div>}
        {sia && <div><dt>Synthetic SIA workflow</dt><dd>{roleLabel(sia.state)}</dd></div>}
      </dl>
      {nextRequirement && <p className="people-next-action"><strong>Next action · {nextRequirement.title}</strong><span>{nextRequirement.nextAction}</span></p>}
      <p className="enterprise-honesty">This record does not establish compliance, legal identity or deployment eligibility.</p>
    </section>
    <section id="personal-details" className="people-record-section"><h2>Personal details</h2>
      {profile ? <><dl className="people-details-list">
        <div><dt>Legal name</dt><dd>{[profile.legal_first_name, profile.surname].filter(Boolean).join(" ") || "Not supplied"}</dd></div>
        <div><dt>Contact email</dt><dd>{profile.contact_email || "Not supplied"}</dd></div>
        <div><dt>Mobile</dt><dd>{profile.mobile || "Not supplied"}</dd></div>
        <div><dt>Address</dt><dd>{[profile.address_line1, profile.address_line2, profile.town_city, profile.postcode].filter(Boolean).join(", ") || "Not supplied"}</dd></div>
      </dl><p className="people-section-note">{submitted ? profileChanged
        ? "Current required details differ from the last submitted revision. Staff resubmission is needed."
        : `Last submitted ${dateLabel(submitted.submitted_at)}. Submission is not identity verification.`
        : "No authorised submitted Personal Details revision is available."}</p>
      </> : detail.canReadPrivate
        ? <p>No current Personal Details are available under this record.</p> : <Restricted name="Personal details" />}
      {self && <Link href="/profile">Open my Profile</Link>}
    </section>
    <section id="onboarding" className="people-record-section"><h2>Onboarding</h2>
      {detail.cases.length ? <ul className="people-record-list">{detail.cases.map((item) => {
        const blocker = item.requirements.find((row) => !complete.has(row.state));
        return <li key={item.id}><div><strong>{roleLabel(item.intendedRole)} · Template v{item.templateVersion}</strong><span>{roleLabel(item.state)} · {item.verifiedCount} of {item.totalCount} complete</span>{blocker && <small>Next: {blocker.title} — {blocker.nextAction}</small>}</div><Link href={`/onboarding/${item.id}`}>Open case</Link></li>;
      })}</ul> : detail.canReadPrivate ? <p>No authorised onboarding case is available.</p>
        : <p>{safeStatus}. Detailed onboarding history is restricted.</p>}
      {detail.cases.length > 0 && <p className="people-section-note"><Link href="/onboarding">View all authorised onboarding cases</Link></p>}
    </section>
    <section id="credentials" className="people-record-section"><h2>Credentials</h2>
      {self && <p><Link href="/credentials">Open My Credentials — current 16B claims</Link></p>}
      {!self && principal.roles.some((role) => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN") &&
        <p><Link href={`/credentials?personId=${person.id}`}>Open scoped 16B credential review</Link></p>}
      <h3>Current credentials · synthetic 16B</h3>
      {credentialClaims?.some((claim) => !claim.withdrawn_at) ? <ul className="people-record-list">{credentialClaims.filter((claim) => !claim.withdrawn_at).map((claim) => {
        const revision = credentialRevisions?.find((item) => item.id === claim.latest_revision_id) ?? null;
        const state = credentialState(claim, revision, (credentialDecisions ?? []) as CredentialDecisionState[]);
        return <li key={claim.id}><div><strong>{claim.type_code === "DOOR_SUPERVISION" ? "Door Supervision" : SIA_LABELS[claim.type_code as keyof typeof SIA_LABELS]}</strong>
          <span>{state.replaceAll("_", " ")} · Expiry: {revision?.expires_on ? dateLabel(revision.expires_on) : "Not recorded"}</span>
        </div></li>;
      })}</ul> : <p>No 16B current credential claim is available under this authority.</p>}
      <h3>Historical onboarding evidence</h3>
      {sia && credential ? <><dl className="people-details-list">
        <div><dt>Synthetic SIA category</dt><dd>{SIA_LABELS[credential.category]}</dd></div>
        <div><dt>Requirement state</dt><dd>{roleLabel(sia.state)} — synthetic workflow</dd></div>
        <div><dt>Synthetic expiry</dt><dd>{dateLabel(credential.expires_on)}</dd></div>
        <div><dt>Evidence</dt><dd>{sia.evidenceState ? roleLabel(sia.evidenceState) : "No authorised evidence state"}</dd></div>
      </dl><p className="people-section-note">This is a historical onboarding submission and case result. It is not a current 16B credential or global verification. No licence authenticity or entitlement is asserted. The SIA reference stays in its protected source workflow.</p>
      {currentCase && <Link href={`/onboarding/${currentCase.id}`}>Open authorised SIA requirement</Link>}</>
        : detail.canReadPrivate ? <p>No authorised submitted SIA credential is available in the current case.</p>
          : <Restricted name="Credential details" />}
    </section>
    <section id="documents" className="people-record-section"><h2>Documents</h2>
      {detail.documents === null ? <Restricted name="Documents" /> : detail.documents.length
        ? <ul className="people-record-list">{detail.documents.map((item) => <li key={item.id}><div><strong>{item.title}</strong><span>{roleLabel(item.status)}</span></div><Link href={`/documents/${item.id}`}>Open request</Link></li>)}</ul>
        : <p>No document requests are available under your current authority.</p>}
      {detail.documents !== null && <p className="people-section-note">Files and exact versions open through the protected Document service. Controlled Terms acknowledgement remains in its onboarding case.</p>}
      {detail.documents !== null && self && <Link href="/documents">View all my Documents</Link>}
    </section>
    <section id="training" className="people-record-section"><h2>Training</h2><p>Training provider not connected. No course completion, certificate or eligibility is inferred.</p></section>
    <section id="sites" className="people-record-section"><h2>Sites / assignments</h2>
      {detail.sites?.length ? <ul className="people-record-list">{detail.sites.map((site, index) => <li key={`${site.name}-${site.from}-${index}`}><div><strong>{site.name}</strong><span>{site.ended ? "Ended" : "Current"} · {dateLabel(site.from)} to {dateLabel(site.until)}</span></div></li>)}</ul>
        : <p>{person.sites.length ? `Current permitted context: ${person.sites.join(" · ")}.` : "No Site assignment detail is visible under your current access."}</p>}
      <p className="people-section-note">Site assignment does not grant access to private personnel sections.</p>
    </section>
    <section id="activity" className="people-record-section"><h2>Activity</h2><p>Activity timeline not yet available. Business history remains in the authorised source workflows.</p></section>
  </div>;
}

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
  const backHref = principal.roles.some((role) => role === "OFFICE_ADMIN" || role === "OPERATIONS" || role === "SUPER_ADMIN") ? "/people" : "/profile";
  return <main className={`enterprise-main people-record ${styles.workspace}`}>
    <Link className="people-back" href={backHref}>← {backHref === "/people" ? "People" : "Profile"}</Link>
    <header className="people-record-header"><div><p className="eyebrow">Staff record · synthetic development data</p><h1>{person.displayName}</h1><p>{person.roles.length ? person.roles.map(roleLabel).join(" · ") : "No active role"}</p></div></header>
    <nav className="people-record-nav" aria-label="Staff record sections">{sections.map((section) => <a href={`#${section.toLowerCase().replaceAll(" ", "-")}`} key={section}>{section}</a>)}</nav>
    <Suspense fallback={<div className="people-record-loading" role="status">Loading authorised Staff Record sections…</div>}>
      <StaffRecordBody client={client} principal={principal} person={person} />
    </Suspense>
  </main>;
}
