import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { canUseWork, listTasks } from "@/lib/tasks/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canUseWork(principal)) return forbidden();
  const tasks = await listTasks(client, principal);
  if (!tasks) return privateJson({ error: "Work unavailable" }, 503);
  return privateJson({ tasks }, 200);
}
