import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { canUseWork, readTask } from "@/lib/tasks/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canUseWork(principal)) return forbidden();
  const task = await readTask(client, principal, (await params).id);
  return task ? privateJson({ task }, 200) : notFound();
}
