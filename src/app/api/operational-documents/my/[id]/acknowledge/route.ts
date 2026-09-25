import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { documentServerProof } from "@/lib/documents/server-proof";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!isUuid(id) || body?.confirmed !== true) return privateJson({ error: "Explicit confirmation required" }, 400);
  const { data: mine, error: listError } = await client.rpc("operational_document_my_list");
  const assignment = (mine?.assignments as Array<{ id: string; version_id: string; current: boolean; conflict: boolean }> | undefined)
    ?.find((item) => item.id === id);
  if (listError || !assignment?.current || assignment.conflict) return privateJson({ error: "Assignment unavailable" }, 403);
  const { data, error } = await client.rpc("operational_document_acknowledge", {
    assignment_id: id, server_proof: documentServerProof("operational_ack", id, assignment.version_id),
  });
  return error || !data ? privateJson({ error: "Exact-version acknowledgement denied" }, 403)
    : privateJson({ acknowledgementId: data }, 201);
}
