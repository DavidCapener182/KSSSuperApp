import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageDeployment } from "@/lib/events/deployment";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!canManageDeployment(principal.roles)) return forbidden();
  const { id } = await params; if (!isUuid(id)) return notFound();
  const { data, error } = await client.rpc("deployment_event_summary", { p_event: id });
  return error ? notFound() : privateJson({ summary: data });
}
