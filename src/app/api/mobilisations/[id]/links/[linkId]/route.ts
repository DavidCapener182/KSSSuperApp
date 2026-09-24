import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some(role => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) return forbidden();
  const { id, linkId } = await params; if (!isUuid(id) || !isUuid(linkId)) return notFound();
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1 || !isUuid(body.requestKey) ||
    typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.trim().length > 500 || /[\x00-\x1f\x7f]/.test(body.reason))
    return privateJson({ error: "Invalid link correction" }, 400);
  const { data, error } = await client.rpc("mobilisation_unlink", { p_id: id, p_link: linkId,
    p_expected: body.expectedRevision, p_reason: body.reason.trim(), p_key: body.requestKey });
  return error ? privateJson({ error: "Link correction denied or stale. Refresh and review current links." }, 409) : privateJson(data);
}
