import Link from "next/link";
import { redirect } from "next/navigation";
import { navigationFor } from "@/lib/auth/capabilities";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { ExternalAppShortcuts } from "@/components/external-app-shortcuts";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect("/?next=%2Fapp");
  const links = navigationFor(principal).filter((item) => item.href !== "/app");
  const staffOnly = principal.roles.length === 1 && principal.roles[0] === "SECURITY_STAFF";
  const { data: trainingAccess } = await client.rpc("training_capabilities");
  const { data: assignmentAccess } = await client.rpc("training_assigner_access");
  const trainingAdmin = Boolean(trainingAccess && typeof trainingAccess === "object" && (trainingAccess.author || trainingAccess.publisher));
  const trainingAssignments = Boolean(assignmentAccess && typeof assignmentAccess === "object" && (assignmentAccess.assigner || assignmentAccess.superAdmin));
  const trainingCatalogue = trainingAdmin || principal.roles.includes("SECURITY_STAFF") || principal.roles.includes("OPERATIONS");
  return <main className="enterprise-main">
    <p className="eyebrow">Development workspace</p>
    <h1>{staffOnly ? "My Work" : "Home"}</h1>
    <p className="enterprise-intro">Welcome, {principal.displayName}. These are the functions currently available to your account.</p>
    <div className="enterprise-card-grid">
      {links.map((link) => <Link className="enterprise-card" href={link.href} key={link.href}><strong>{link.label}</strong><span>{link.href === "/people" ? "Find staff and open a permission-scoped staff record." : link.href === "/work" ? "Open your assigned document reviews and CRM follow-ups." : link.href === "/crm" ? "Manage the commercial pipeline, activities and follow-ups." : link.href === "/sites" ? "Open the Sites you are authorised to use." : link.href === "/events" ? "Manage Events and staffing demand without assigning People yet." : link.href === "/documents" ? "View your authorised synthetic document requests." : link.href === "/onboarding" ? "See your authorised synthetic starter checklist and next actions." : "View your current Enterprise identity and roles."}</span></Link>)}
    </div>
    {(trainingCatalogue || trainingAdmin || trainingAssignments) && <section aria-label="Native learning" className="enterprise-native-learning"><p className="eyebrow">Native learning · Synthetic Dev</p><h2>Learning content</h2><p>Browse synthetic course pages. Reading records no completion or compliance result.</p><div className="enterprise-card-grid">{trainingCatalogue && <Link className="enterprise-card" href="/training"><strong>Course catalogue</strong><span>Current published learning content for active Security Staff.</span></Link>}{principal.roles.includes("SECURITY_STAFF") && <Link className="enterprise-card" href="/training/my-learning"><strong>My Learning</strong><span>Your exact-version assignments and factual page progress.</span></Link>}{trainingAdmin && <Link className="enterprise-card" href="/training-admin"><strong>Training administration</strong><span>Draft, preview, publish, retire and inspect exact course versions.</span></Link>}{trainingAssignments && <Link className="enterprise-card" href="/training-admin/assignments"><strong>Training assignments</strong><span>Manual assignments, due dates and exact-version history.</span></Link>}</div></section>}
    <ExternalAppShortcuts roles={principal.roles} />
    <p className="enterprise-honesty">This development workspace does not contain live operational data.</p>
  </main>;
}
