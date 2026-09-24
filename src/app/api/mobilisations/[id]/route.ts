import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const office = (roles: string[]) => roles.includes("OFFICE_ADMIN") || roles.includes("SUPER_ADMIN");
const commands = new Set(["STATUS", "OWNER", "TARGET_DATE", "ACTION_STATE", "ACTION_ADD", "ACTION_OWNER_DATE", "DEPENDENCY_ADD", "BLOCKER_OPEN", "BLOCKER_RESOLVE", "DECISION", "LINK_ADD"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!office(principal.roles)) return forbidden();
  const { id } = await params; if (!isUuid(id)) return notFound();
  const { data, error } = await client.rpc("mobilisation_detail", { p_id: id });
  return error ? privateJson({ error: "Mobilisation unavailable" }, 503) : data ? privateJson(data) : notFound();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!office(principal.roles)) return forbidden();
  const { id } = await params; if (!isUuid(id)) return notFound();
  const body = await request.json().catch(() => null);
  if (!body || !commands.has(body.action) || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1 ||
    !isUuid(body.requestKey) || !body.data || typeof body.data !== "object" || Array.isArray(body.data) ||
    JSON.stringify(body.data).length > 3000) return privateJson({ error: "Invalid mobilisation change" }, 400);
  const { data, error } = await client.rpc("mobilisation_command", {
    p_id: id, p_action: body.action, p_data: body.data, p_expected: body.expectedRevision, p_key: body.requestKey,
  });
  return error ? privateJson({ error: "Mobilisation change denied or stale. Refresh and review current facts." }, 409) : privateJson(data);
}
