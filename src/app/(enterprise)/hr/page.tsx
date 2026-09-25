import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, BookOpenText, ClipboardList, FileDown, FileText, GraduationCap, IdCard, UserRound } from "lucide-react";
import { hasCapability } from "@/lib/auth/capabilities";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import "./hr.css";

export const dynamic = "force-dynamic";

type View = "home" | "policies" | "forms" | "requests";
const tabs: { id: View; label: string }[] = [
  { id: "home", label: "My HR" },
  { id: "policies", label: "Handbook & policies" },
  { id: "forms", label: "Forms" },
  { id: "requests", label: "My requests" },
];

function ViewLink({ href, label, description, icon: Icon }: { href: string; label: string; description: string; icon: typeof UserRound }) {
  return <Link className="hr-service-link" href={href}>
    <span className="hr-service-icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
    <span><strong>{label}</strong><small>{description}</small></span>
    <ArrowRight size={17} aria-hidden="true" />
  </Link>;
}

export default async function HrPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fhr");
  if (!hasCapability(principal, "HR_HUB_SELF_READ")) notFound();
  const requested = (await searchParams).view;
  const view: View = tabs.some((tab) => tab.id === requested) ? requested as View : "home";
  const staff = principal.roles.includes("SECURITY_STAFF");
  const canSeeDocuments = hasCapability(principal, "DOCUMENT_SELF_READ");
  const canUseTimeAway = hasCapability(principal, "TIME_AWAY_SELF");
  const canSeeCredentials = staff || principal.roles.includes("OFFICE_ADMIN") || principal.roles.includes("SUPER_ADMIN");

  return <main className="enterprise-main hr-area" id="enterprise-content">
    <div className="hr-heading">
      <div><p className="hr-eyebrow">People & administration / HR</p><h1>HR</h1>
        <p>Find your own KSS services and current HR material in one place. Each linked service keeps its own access rules.</p></div>
      <span className="hr-scope-note">Synthetic development</span>
    </div>
    <nav className="hr-tabs" aria-label="HR sections">
      {tabs.map((tab) => <Link key={tab.id} href={tab.id === "home" ? "/hr" : `/hr?view=${tab.id}`} aria-current={view === tab.id ? "page" : undefined}>{tab.label}</Link>)}
    </nav>

    {view === "home" && <>
      <section className="hr-hero" aria-labelledby="hr-my-title">
        <span className="hr-hero-mark"><UserRound size={25} strokeWidth={1.8} aria-hidden="true" /></span>
        <div><p className="hr-kicker">Your starting point</p><h2 id="hr-my-title">My HR</h2><p>Open the source that holds your information or next action.</p></div>
      </section>
      <section className="hr-section" aria-labelledby="hr-services-title">
        <div className="hr-section-heading"><div><p className="hr-kicker">Self-service</p><h2 id="hr-services-title">Your KSS services</h2></div><span>Links are checked again by each service</span></div>
        <div className="hr-service-grid">
          <ViewLink href="/profile" label="My details" description="View your current identity and permitted personal details." icon={IdCard} />
          {canUseTimeAway && <ViewLink href="/my-time-away" label="Time away" description="Open your own requests and their current source status." icon={ClipboardList} />}
          {canSeeDocuments && <ViewLink href="/documents" label="My documents" description="Open only document requests and versions you are authorised to use." icon={FileText} />}
          {staff && <ViewLink href="/training/my-learning" label="My learning" description="Open assigned learning and factual progress." icon={GraduationCap} />}
          {canSeeCredentials && <ViewLink href="/credentials" label="My credentials" description="Open the credential record under its separate checks." icon={IdCard} />}
        </div>
      </section>
      <div className="hr-two-column">
        <section className="hr-preview" aria-labelledby="hr-policies-title"><BookOpenText size={23} aria-hidden="true" /><h2 id="hr-policies-title">Handbook & policies</h2><p>No approved HR handbook or policy catalogue is connected yet. Current versions will appear here after a separate publication and audience contract.</p><Link href="/hr?view=policies">View catalogue state <ArrowRight size={16} aria-hidden="true" /></Link></section>
        <section className="hr-preview" aria-labelledby="hr-forms-title"><FileDown size={23} aria-hidden="true" /><h2 id="hr-forms-title">Forms</h2><p>No approved HR form catalogue is connected yet. Downloads and online workflows will be labelled separately when available.</p><Link href="/hr?view=forms">View forms state <ArrowRight size={16} aria-hidden="true" /></Link></section>
      </div>
    </>}

    {view === "policies" && <section className="hr-collection" aria-labelledby="hr-policy-page-title"><div className="hr-collection-icon"><BookOpenText size={25} aria-hidden="true" /></div><p className="hr-kicker">Controlled material</p><h2 id="hr-policy-page-title">Handbook & policies</h2><p>There is no approved HR policy catalogue available to this account in this development slice. This page does not treat operational documents, uploaded evidence, or example policy titles as published HR policy.</p><div className="hr-empty"><strong>No current HR policies to show</strong><span>A later controlled catalogue must verify audience, exact version, effective date and private file access before showing a document here.</span></div><p className="hr-boundary">Opening a document, acknowledging its exact version and understanding it are separate facts.</p></section>}

    {view === "forms" && <section className="hr-collection" aria-labelledby="hr-forms-page-title"><div className="hr-collection-icon"><FileDown size={25} aria-hidden="true" /></div><p className="hr-kicker">Approved templates and workflows</p><h2 id="hr-forms-page-title">Forms</h2><p>No approved downloadable HR templates are connected. A catalogue entry will say whether it downloads a file, opens an existing KSS workflow, or goes to a verified external service.</p><div className="hr-empty"><strong>No HR forms published</strong><span>There is no placeholder download or invented KSS form to act on.</span></div>{canUseTimeAway && <div className="hr-related"><strong>Available native workflow</strong><ViewLink href="/my-time-away" label="My time away" description="Start or review a request in the existing Time Away service." icon={ClipboardList} /></div>}</section>}

    {view === "requests" && <section className="hr-collection" aria-labelledby="hr-requests-title"><div className="hr-collection-icon"><ClipboardList size={25} aria-hidden="true" /></div><p className="hr-kicker">Source-owned work</p><h2 id="hr-requests-title">My requests</h2><p>HR does not keep a second request status. Open the relevant source for its authoritative record and next action.</p><div className="hr-service-grid hr-request-links">{canUseTimeAway && <ViewLink href="/my-time-away" label="Time away requests" description="Current requests and decisions in Time Away." icon={ClipboardList} />}{staff && <ViewLink href="/onboarding" label="My onboarding" description="Your exact starter case and checklist, if authorised." icon={FileText} />}{canSeeDocuments && <ViewLink href="/documents" label="Document requests" description="Your permitted document requests and submissions." icon={FileText} />}</div>{!canUseTimeAway && !staff && !canSeeDocuments && <div className="hr-empty"><strong>No connected request view for this role</strong><span>Your identity remains available in My details.</span></div>}</section>}
    <p className="hr-footer-note">HR-01 uses existing guarded KSS services. Private employee relations cases and HR publishing authority are outside this slice.</p>
  </main>;
}
