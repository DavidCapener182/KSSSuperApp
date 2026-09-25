import Link from "next/link";
import { redirect } from "next/navigation";
import { navigationFor } from "@/lib/auth/capabilities";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { ExternalAppShortcuts } from "@/components/external-app-shortcuts";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

type Entry = { href: string; title: string; detail: string };

const entries: Record<string, Entry> = {
  "/my-attendance": { href: "/my-attendance", title: "My attendance", detail: "Check arrival and departure evidence for your own duties." },
  "/credentials": { href: "/credentials", title: "My credentials", detail: "Review your own credential submissions and their separate verification state." },
  "/my-schedule": { href: "/my-schedule", title: "My schedule", detail: "See your own duties and their source links." },
  "/my-deployments": { href: "/my-deployments", title: "My deployments", detail: "Review allocations and respond to requests on the deployment record." },
  "/my-availability": { href: "/my-availability", title: "My availability", detail: "Review or change your own availability declarations." },
  "/action-centre": { href: "/action-centre", title: "Action Centre", detail: "Open your own source-linked notices and actions." },
  "/my-time-away": { href: "/my-time-away", title: "My time away", detail: "Check your requests and submit a new one." },
  "/onboarding": { href: "/onboarding", title: "Onboarding", detail: "Open your authorised case or Office queue; requirements retain their own evidence state." },
  "/documents": { href: "/documents", title: "Documents", detail: "Open requests and exact evidence versions you may access." },
  "/workforce": { href: "/workforce", title: "Workforce", detail: "Review staffing demand, allocation and availability as separate facts." },
  "/control-room": { href: "/control-room", title: "Control Room", detail: "Triage operational exceptions and open their source records." },
  "/mobilisations": { href: "/mobilisations", title: "Mobilisations", detail: "Review authorised actions, blockers, decisions and handovers." },
  "/service-delivery": { href: "/service-delivery", title: "Service Delivery", detail: "Continue service reviews and source-linked actions." },
  "/work": { href: "/work", title: "Assigned work", detail: "Document reviews and CRM follow-ups assigned through the existing Task service." },
  "/time-away": { href: "/time-away", title: "Time away review", detail: "Review requests within your existing authority." },
  "/my-work-time": { href: "/my-work-time", title: "My worked time", detail: "Review and submit worked intervals separately from attendance." },
  "/my-equipment": { href: "/my-equipment", title: "My equipment", detail: "Check your own custody record and handovers." },
  "/events": { href: "/events", title: "Events", detail: "Open event plans, staffing and attendance source records." },
};

function EntryGroup({ title, paths, allowed }: { title: string; paths: string[]; allowed: Set<string> }) {
  const visible = paths.filter((path) => allowed.has(path)).map((path) => entries[path]);
  if (!visible.length) return null;
  return <section className={styles.section} aria-label={title}>
    <h2>{title}</h2><div className={styles.grid}>{visible.map((entry) =>
      <Link className={styles.card} href={entry.href} key={entry.href}>
        <strong>{entry.title}</strong><span>{entry.detail}</span><span className={styles.action}>Open {entry.title} →</span>
      </Link>)}</div>
  </section>;
}

function QuickLinks({ paths, allowed }: { paths: string[]; allowed: Set<string> }) {
  return <nav className={styles.quickGrid} aria-label="Quick access">{paths.filter((path) => allowed.has(path)).map((path) => <Link className={styles.quickLink} href={path} key={path}>{entries[path].title}<span aria-hidden="true">↗</span></Link>)}</nav>;
}

export default async function AppHome() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect("/?next=%2Fapp");
  const allowed = new Set<string>(navigationFor(principal).map((item) => item.href));
  const staff = principal.roles.includes("SECURITY_STAFF");
  if (staff && allowed.has("/my-deployments")) { allowed.add("/my-attendance"); allowed.add("/credentials"); }
  const office = principal.roles.some((role) => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN");
  const operations = principal.roles.includes("OPERATIONS");
  const { data: trainingAccess } = await client.rpc("training_capabilities");
  const { data: assignmentAccess } = await client.rpc("training_assigner_access");
  const trainingAdmin = Boolean(trainingAccess && typeof trainingAccess === "object" && (trainingAccess.author || trainingAccess.publisher));
  const trainingAssignments = Boolean(assignmentAccess && typeof assignmentAccess === "object" && (assignmentAccess.assigner || assignmentAccess.superAdmin));
  const trainingCatalogue = trainingAdmin || staff || operations;
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/London" }).format(new Date());
  return <main className={`enterprise-main ${styles.home}`}>
    <header className={styles.hero}><div><p className={styles.kicker}>KSS workspace / Synthetic Development</p><h1>Welcome, {principal.displayName}</h1><p>{staff && !office && !operations ? "Your duty and personal records are a step away." : "Open an operational area or continue your assigned work."}</p></div><p className={styles.date}>{date}</p></header>
    <section className={styles.section} aria-label="Quick access"><h2>Quick access</h2><QuickLinks paths={staff && !office && !operations ? ["/my-schedule", "/my-deployments", "/action-centre"] : ["/workforce", "/events", "/control-room"]} allowed={allowed} /></section>
    {office && allowed.has("/work") && <section className={styles.taskPanel} aria-label="Assigned Tasks"><div><p className={styles.kicker}>Existing Task service</p><h2>Assigned Tasks</h2><p>Document reviews and CRM follow-ups assigned through the existing Task service. Open the panel for current records and actions.</p></div><Link href="/work">Open assigned Tasks <span aria-hidden="true">→</span></Link></section>}
    {staff && <EntryGroup title="My duty" paths={["/my-schedule", "/my-deployments", "/my-attendance", "/my-work-time", "/my-availability"]} allowed={allowed} />}
    {staff && <EntryGroup title="My requests and evidence" paths={["/action-centre", "/my-time-away", "/onboarding", "/documents", "/credentials", "/my-equipment"]} allowed={allowed} />}
    {(office || operations) && <EntryGroup title="Operations" paths={["/control-room", "/workforce", "/events", "/time-away"]} allowed={allowed} />}
    {office && <EntryGroup title="Delivery" paths={["/mobilisations", "/service-delivery", "/documents"]} allowed={allowed} />}
    {office && <EntryGroup title="People & administration" paths={["/onboarding"]} allowed={allowed} />}
    {(trainingCatalogue || trainingAdmin || trainingAssignments) && <section className={styles.section} aria-label="Learning"><h2>Learning</h2><div className={styles.grid}>
      {trainingCatalogue && <Link className={styles.card} href="/training"><strong>Course catalogue</strong><span>Browse published synthetic learning content. Reading does not record completion.</span><span className={styles.action}>Open catalogue →</span></Link>}
      {staff && <Link className={styles.card} href="/training/my-learning"><strong>My learning</strong><span>Open your exact-version assignments and factual page progress.</span><span className={styles.action}>Open my learning →</span></Link>}
      {trainingAdmin && <Link className={styles.card} href="/training-admin"><strong>Training administration</strong><span>Manage course versions under existing author or publisher access.</span><span className={styles.action}>Open administration →</span></Link>}
      {trainingAssignments && <Link className={styles.card} href="/training-admin/assignments"><strong>Training assignments</strong><span>Review manual assignments, dates and exact-version history.</span><span className={styles.action}>Open assignments →</span></Link>}
    </div></section>}
    <section className={styles.section} aria-label="More authorised areas"><h2>More authorised areas</h2><div className={styles.grid}>{navigationFor(principal).filter((link) => link.href !== "/app" && !entries[link.href]).map((link) => <Link className={styles.card} href={link.href} key={link.href}><strong>{link.label}</strong><span>Open your authorised {link.label.toLowerCase()} workspace.</span><span className={styles.action}>Open {link.label} →</span></Link>)}</div></section>
    <ExternalAppShortcuts roles={principal.roles} />
    <p className="enterprise-honesty">This development workspace does not contain live operational data.</p>
  </main>;
}
