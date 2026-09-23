import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { CONTROLLED_BUCKET, readControlledVersion } from "@/lib/controlled/policy";
import { documentServerProof } from "@/lib/documents/server-proof";
import { readOnboardingCase } from "@/lib/onboarding/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const c = await readOnboardingCase(client, principal, (await params).id);
  if (!c) return notFound();
  const requirement = c.requirements.find((r) => r.code === "CONTRACT_TERMS");
  const assignment = requirement?.controlled;
  if (!assignment || c.state !== "IN_PROGRESS" ||
    !(principal.personId === c.personId && principal.roles.includes("SECURITY_STAFF") ||
      c.canManage && c.ownerPersonId === principal.personId && principal.roles.includes("OFFICE_ADMIN")))
    return forbidden();
  const version = await readControlledVersion(client, assignment.versionId);
  if (!version || version.upload_state !== "READY" || version.id !== assignment.versionId) return notFound();
  if (principal.personId === c.personId) {
    const access = await client.rpc("record_controlled_access", {
      requested_assignment: assignment.assignmentId,
      server_proof: documentServerProof("controlled_access", assignment.assignmentId, version.id),
    });
    if (access.error || !access.data) return privateJson({ error: "Access record unavailable" }, 503);
  }
  const { data, error } = await client.storage.from(CONTROLLED_BUCKET).download(version.object_key);
  if (error || !data) return notFound();
  const bytes = await data.arrayBuffer();
  return new Response(bytes, { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=synthetic-controlled-document.pdf",
    "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff",
  } });
}
