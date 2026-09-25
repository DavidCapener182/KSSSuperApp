import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { operationalCapabilities } from "@/lib/controlled/operational";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  if (!(await operationalCapabilities(client)).assign) return forbidden();
  const { id } = await params;
  if (!isUuid(id)) return privateJson({ error: "Invalid assignment" }, 400);
  const { data, error } = await client.rpc("operational_document_status", { assignment_id: id });
  return error ? privateJson({ error: "Status unavailable" }, 403) : privateJson(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  if (!(await operationalCapabilities(client)).assign) return forbidden();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!isUuid(id) || typeof body?.reason !== "string" || body.reason.trim().length < 3)
    return privateJson({ error: "Reason required" }, 400);
  const { data, error } = await client.rpc("operational_document_revoke", { assignment_id: id, reason: body.reason });
  return error || !data ? privateJson({ error: "Revocation denied" }, 409) : privateJson({ revoked: true });
}
