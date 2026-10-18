import Link from "next/link";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { TrainingAssessmentAdminClient } from "@/components/training-assessment-admin-client";
import "../../training/training.css";

export const dynamic = "force-dynamic";
export default async function AssessmentAdministration() {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return null;
  const { data: access, error } = await client.rpc("training_assessment_access");
  const rights = !error && access && typeof access === "object" ? access as { author: boolean; publisher: boolean; superAdmin: boolean } : null;
  if (!rights || (!rights.author && !rights.publisher && !rights.superAdmin)) return <main className="training-area"><h1>Assessment administration</h1><p>Access unavailable.</p></main>;
  const [{ data: versions }, { data: courses }, { data: grants }, { data: candidates }] = await Promise.all([
    client.rpc("training_assessment_admin"), client.rpc("training_assessment_course_choices"),
    rights.superAdmin ? client.rpc("training_assessment_grants_read") : Promise.resolve({ data: [] }),
    rights.superAdmin ? client.rpc("training_assigner_candidates") : Promise.resolve({ data: [] }),
  ]);
  return <main className="training-area"><Link href="/training-admin">← Training administration</Link><header><p className="training-eyebrow">Native Training · Synthetic Dev</p><h1>Assessment administration</h1><p>Draft, preview, publish and retire exact assessment versions. Learner results remain factual attempts only.</p></header>
    <TrainingAssessmentAdminClient initial={Array.isArray(versions) ? versions : []} courses={Array.isArray(courses) ? courses : []} rights={rights} grants={Array.isArray(grants) ? grants : []} candidates={Array.isArray(candidates) ? candidates : []} />
  </main>;
}
