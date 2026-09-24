import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageDeployment } from "@/lib/events/deployment";

type Context = { params: Promise<{ id: string; requirementId: string }> };
export async function GET(request: Request, { params }: Context) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!canManageDeployment(principal.roles)) return forbidden();
  const { id, requirementId } = await params; if (!isUuid(id) || !isUuid(requirementId)) return notFound();
  const url = new URL(request.url); const offset = Number(url.searchParams.get("offset") ?? "0");
  const search = url.searchParams.get("search") ?? "";
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000 || search.length > 80 || /[\x00-\x1f\x7f]/.test(search))
    return privateJson({ error: "Invalid candidate search" }, 400);
  const { data, error } = await client.rpc("deployment_candidates", { p_event: id, p_requirement: requirementId,
    p_search: search, p_offset: offset, p_limit: 20 });
  return error ? notFound() : privateJson({ candidates: data });
}
