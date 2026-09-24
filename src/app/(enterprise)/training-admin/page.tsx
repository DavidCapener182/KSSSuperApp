import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { TrainingAdminClient } from "@/components/training-admin-client";
import type { TrainingVersion } from "@/lib/training/types";
import "../training/training.css";

export const dynamic = "force-dynamic";
export default async function TrainingAdmin() {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return null;
  const { data: access, error: accessError } = await client.rpc("training_capabilities");
  const capabilities = !accessError && access && typeof access === "object" ? access as { author: boolean; publisher: boolean; superAdmin: boolean } : null;
  if (!capabilities || (!capabilities.author && !capabilities.publisher)) return <main className="training-area"><h1>Training administration</h1><p>Access unavailable.</p></main>;
  const { data, error } = await client.rpc("training_admin", { p_course: null });
  const { data: grants } = capabilities.superAdmin ? await client.rpc("training_grants") : { data: [] };
  return <main className="training-area"><header><p className="training-eyebrow">Native Training · Synthetic Dev</p><h1>Training administration</h1><p>Courses, immutable published versions, draft editing and publication history.</p></header>
    {error ? <p role="alert">Training records unavailable.</p> : <TrainingAdminClient initial={Array.isArray(data) ? data as TrainingVersion[] : []} capabilities={capabilities} initialGrants={Array.isArray(grants) ? grants : []} />}</main>;
}
