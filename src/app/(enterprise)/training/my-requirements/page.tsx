import Link from "next/link";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { TrainingRequirementPilot } from "@/components/training-requirement-pilot";
import "../training.css";

export const dynamic = "force-dynamic";
export default async function MyTrainingRequirements() {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return null;
  const { data: access, error } = await client.rpc("training_requirement_access_20fa");
  const rights = !error && access && typeof access === "object" ? access as {
    author: boolean; publisher: boolean; viewer: boolean; superAdmin: boolean; staff: boolean;
  } : null;
  if (!rights?.staff) return <main className="training-area"><h1>My Training requirements</h1><p>Access unavailable.</p></main>;
  const { data: contexts } = await client.rpc("training_requirement_contexts_20fa");
  return <main className="training-area"><Link href="/training/my-learning">← My Learning</Link>
    <header><p className="training-eyebrow">Synthetic policy pilot · TASK-20F-A</p>
      <h1>My Training requirements</h1>
      <p>Requirements are shown for your own allocated Site Shift contexts only.</p>
    </header>
    <TrainingRequirementPilot rights={rights} initial={null}
      contexts={Array.isArray(contexts) ? contexts as never : []} />
  </main>;
}
