import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { hasControlledPublisherGrant, readControlledVersion } from "@/lib/controlled/policy";
import { operationalCapabilities } from "@/lib/controlled/operational";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const { id, versionId } = await params;
  const version = await readControlledVersion(client, versionId);
  if (!isUuid(id) || !version || version.document_id !== id || version.state !== "DRAFT" || version.upload_state !== "READY")
    return forbidden();
  const { data: doc } = await client.from("controlled_documents").select("family,created_by_person_id")
    .eq("id", id).maybeSingle<{ family: string; created_by_person_id: string }>();
  if (!doc || doc.created_by_person_id !== principal.personId ||
    (doc.family === "ONBOARDING_TERMS_SYNTHETIC" ? !(await hasControlledPublisherGrant(client, principal))
      : doc.family === "OPERATIONAL_SYNTHETIC" ? !(await operationalCapabilities(client)).publish : true)) return forbidden();
  const body = await request.json().catch(() => null);
  if (typeof body?.effectiveOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.effectiveOn))
    return privateJson({ error: "Invalid effective date" }, 400);
  const { data, error } = await client.rpc("publish_controlled_version", {
    requested_version: versionId, requested_effective_on: body.effectiveOn,
  });
  return error || !data ? privateJson({ error: "Publication denied; check unresolved assignments and authority" }, 409)
    : privateJson({ published: true });
}
