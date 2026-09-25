import Link from "next/link";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { TrainingCompletionAdmin } from "@/components/training-completion-admin";
import "../../training/training.css";

export const dynamic = "force-dynamic";
export default async function CompletionAdministration() {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return null;
  const { data: access, error } = await client.rpc("training_completion_access");
  const rights = !error && access && typeof access === "object" ? access as {
    manager: boolean; publisher: boolean; superAdmin: boolean;
  } : null;
  if (!rights || (!rights.manager && !rights.publisher && !rights.superAdmin))
    return <main className="training-area"><h1>Completion administration</h1><p>Access unavailable.</p></main>;
  const [{ data: admin }, { data: choices }, { data: grants }] = await Promise.all([
    rights.manager ? client.rpc("training_completion_admin") : Promise.resolve({ data: null }),
    rights.publisher ? client.rpc("training_completion_publish_choices") : Promise.resolve({ data: [] }),
    rights.superAdmin ? client.rpc("training_completion_grants_read") : Promise.resolve({ data: null }),
  ]);
  return <main className="training-area"><Link href="/training-admin">← Training administration</Link>
    <header><p className="training-eyebrow">Native Training · Synthetic Dev</p><h1>Course completion</h1>
      <p>Published rules determine completion from exact learning facts. Certificate issue remains a separate manager decision and is unavailable while private PDF delivery is unresolved.</p></header>
    <TrainingCompletionAdmin rights={rights} initial={admin} choices={Array.isArray(choices) ? choices : []} grants={grants} />
  </main>;
}
