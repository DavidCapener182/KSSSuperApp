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
  const { data, error } = await client.rpc("training_catalogue", { p_course: null });
  const courses = !error && Array.isArray(data) ? data as TrainingVersion[] : [];
  return <main className="training-area"><header><p className="training-eyebrow">Native learning · Synthetic Dev</p><h1>Course catalogue</h1><p>Available learning content. Opening a page records no progress, completion or compliance result.</p></header>
    {error ? <p role="alert">Catalogue unavailable for this role.</p> : courses.length === 0 ? <p>No courses are currently available.</p> : <div className="training-cards">{courses.map(course => <Link className="training-card" href={`/training/${course.courseId}`} key={course.courseId}><small>Synthetic example · Version {course.versionNumber}</small><h2>{course.title}</h2><p>{course.summary}</p><span>View modules and pages →</span></Link>)}</div>}
    <p className="training-boundary">This native synthetic catalogue is separate from the existing external Training shortcut.</p></main>;
}
