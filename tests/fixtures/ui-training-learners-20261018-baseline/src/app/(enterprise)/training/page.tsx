import Link from "next/link";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import type { TrainingVersion } from "@/lib/training/types";
import "./training.css";

export const dynamic = "force-dynamic";
export default async function TrainingCatalogue() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return null;
  const staff = principal.roles.includes("SECURITY_STAFF");
  const { data: access } = await client.rpc("training_capabilities");
  const { data: assignmentAccess } = await client.rpc("training_assigner_access");
  const canAdmin = Boolean(access && typeof access === "object" && (access.author || access.publisher));
  const canAssign = Boolean(assignmentAccess && typeof assignmentAccess === "object" && (assignmentAccess.assigner || assignmentAccess.superAdmin));
  const { data, error } = await client.rpc("training_catalogue", { p_course: null });
  const courses = !error && Array.isArray(data) ? data as TrainingVersion[] : [];
  return <main className="training-area"><header><p className="training-eyebrow">Native learning · Synthetic Dev</p><h1>Course catalogue</h1><p>Available learning content. Opening a page records no progress, completion or compliance result.</p></header><nav className="training-section-links"><Link href="/training" aria-current="page">Course catalogue</Link>{staff && <Link href="/training/my-learning">My Learning</Link>}{canAdmin && <Link href="/training-admin">Course administration</Link>}{canAssign && <Link href="/training-admin/assignments">Assignments</Link>}</nav>
    {error ? <p role="alert">Catalogue unavailable for this role.</p> : courses.length === 0 ? <p>No courses are currently available.</p> : <div className="training-cards">{courses.map(course => <Link className="training-card" href={`/training/${course.courseId}`} key={course.courseId}><small>Synthetic example · Version {course.versionNumber}</small><h2>{course.title}</h2><p>{course.summary}</p><span>View modules and pages →</span></Link>)}</div>}
    <section className="training-next" aria-label="Training connections"><h2>Training connections</h2><p>Assigned learning, assessments, completions and certificates are available through My Learning and Training administration for authorised roles.</p><div className="training-cards"><article className="training-card"><h3>Onboarding induction status</h3><p>Coming soon. Onboarding does not yet read an exact Person Training assignment or completion.</p></article><article className="training-card"><h3>Operational eligibility</h3><p>Coming soon. Training progress does not currently decide whether a Person may be deployed.</p></article></div></section>
    <p className="training-boundary">This native synthetic catalogue is separate from the existing external Training shortcut.</p></main>;
}
