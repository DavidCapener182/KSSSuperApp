import Link from "next/link";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import type { TrainingAssignment } from "@/lib/training/learning-types";
import { TrainingAssignmentsClient } from "@/components/training-assignments-client";
import "../../training/training.css";

export const dynamic = "force-dynamic";
export default async function TrainingAssignments() {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return null;
  const { data: access } = await client.rpc("training_assigner_access");
  const rights = access && typeof access === "object" ? access as { assigner: boolean; superAdmin: boolean } : { assigner: false, superAdmin: false };
  if (!rights.assigner && !rights.superAdmin) return <main className="training-area"><h1>Training assignments</h1><p>Access unavailable.</p></main>;
  const [{ data: assignments }, { data: choices }, { data: grants }, { data: candidates }] = await Promise.all([
    client.rpc("training_assignments_admin"), rights.assigner ? client.rpc("training_assignable_choices") : Promise.resolve({ data: null }),
    rights.superAdmin ? client.rpc("training_assigner_grants_read") : Promise.resolve({ data: null }),
    rights.superAdmin ? client.rpc("training_assigner_candidates") : Promise.resolve({ data: null }),
  ]);
  return <main className="training-area"><Link href="/training-admin">← Course administration</Link><header><p className="training-eyebrow">Native Training · Synthetic Dev</p><h1>Training assignments</h1><p>Exact version assignments and factual page progress. Past due is a calendar display only.</p></header>
    <TrainingAssignmentsClient initial={Array.isArray(assignments) ? assignments as TrainingAssignment[] : []} choices={choices as { staff: { personId: string; displayName: string }[]; courses: { courseId: string; versionId: string; versionNumber: number; title: string }[] } | null} grants={Array.isArray(grants) ? grants : []} candidates={Array.isArray(candidates) ? candidates : []} rights={rights} />
  </main>;
}
