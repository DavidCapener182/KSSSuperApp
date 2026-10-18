import Link from "next/link";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { TrainingRequirementPilot } from "@/components/training-requirement-pilot";
import "../../training/training.css";

export const dynamic = "force-dynamic";
export default async function TrainingRequirements() {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return null;
  const { data: access, error } = await client.rpc("training_requirement_access_20fa");
  const rights = !error && access && typeof access === "object" ? access as {
    author: boolean; publisher: boolean; viewer: boolean; superAdmin: boolean; staff: boolean;
  } : null;
  if (!rights || (!rights.author && !rights.publisher && !rights.viewer && !rights.superAdmin))
    return <main className="training-area"><h1>Training requirements</h1><p>Access unavailable.</p></main>;
  const [{ data: admin }, { data: contexts }, { data: completionAccess }] = await Promise.all([
    rights.author || rights.publisher || rights.superAdmin
      ? client.rpc("training_requirement_admin_20fa") : Promise.resolve({ data: null }),
    client.rpc("training_requirement_contexts_20fa"),
    client.rpc("training_completion_access"),
  ]);
  return <main className="training-area"><Link href="/training-admin">← Training administration</Link>
    <header><p className="training-eyebrow">Synthetic policy pilot · TASK-20F-A</p>
      <h1>Training requirements</h1>
      <p>Publish one exact role, Service and CourseVersion requirement, then inspect factual evidence for an allocated Person.</p>
    </header>
    <TrainingRequirementPilot rights={rights} initial={admin && typeof admin === "object" ? admin as never : null}
      contexts={Array.isArray(contexts) ? contexts as never : []}
      canReviewCompletions={!!completionAccess && typeof completionAccess === "object" &&
        "manager" in completionAccess && !!completionAccess.manager} />
  </main>;
}
