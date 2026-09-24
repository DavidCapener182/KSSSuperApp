import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const q = new URL(request.url).searchParams;
  const offset = Number(q.get("offset") ?? "0");
  const focus = q.get("allocationId");
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000 || (focus && !isUuid(focus))) return privateJson({ error: "Invalid page" }, 400);
  const { data, error } = await client.rpc("my_deployments_08a", { p_offset: offset, p_limit: 25, p_focus: focus || null });
  return error ? privateJson({ error: "My Deployments unavailable" }, 503) : privateJson({ deployments: data });
}
