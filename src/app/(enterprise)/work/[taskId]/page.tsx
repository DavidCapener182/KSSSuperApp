import { notFound, redirect } from "next/navigation";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { readTask, canUseWork } from "@/lib/tasks/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function WorkTask({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  if (!isUuid(taskId)) notFound();
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) redirect(`/?next=${encodeURIComponent(`/work/${taskId}`)}`);
  if (!canUseWork(principal)) notFound();
  const task = await readTask(client, principal, taskId);
  if (!task) notFound();
  redirect(task.sourceHref);
}
