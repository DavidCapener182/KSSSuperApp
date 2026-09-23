import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageStaffing, staffingError, staffingFields } from "@/lib/events/staffing";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!canManageStaffing(principal.roles)) return forbidden();
  const { id } = await params; if (!isUuid(id)) return notFound();
  const { data, error } = await client.rpc("staffing_plan", { p_event: id });
  return error ? privateJson({ error: "Staffing plan unavailable" }, 503) : data ? privateJson({ plan: data }) : notFound();
}
export async function POST(request: Request, { params }: Context) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!canManageStaffing(principal.roles)) return forbidden();
  const { id } = await params; if (!isUuid(id)) return notFound();
  const fields = staffingFields(await request.json().catch(() => null));
  if (!fields) return privateJson({ error: "Enter valid, unambiguous London staffing times and fields" }, 400);
  const { data, error } = await client.rpc("staffing_create_confirmed", { p_event: id, ...fields });
  if (error) { const result = staffingError(error.message); return privateJson({ error: result.error }, result.status); }
  return privateJson({ id: data }, 201);
}
