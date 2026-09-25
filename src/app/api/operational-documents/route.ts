import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { operationalCapabilities } from "@/lib/controlled/operational";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const capabilities = await operationalCapabilities(client);
  if (!capabilities.publish && !capabilities.assign) return forbidden();
  const { data: documents, error } = await client.from("controlled_documents")
    .select("id,title,family,created_at,controlled_document_versions(id,version_number,title,state,effective_on,upload_state)")
    .eq("family", "OPERATIONAL_SYNTHETIC").order("created_at", { ascending: false }).limit(50);
  const { data: assignments } = await client.rpc("operational_document_manager_list");
  return error ? privateJson({ error: "Documents unavailable" }, 503)
    : privateJson({ capabilities, documents: documents ?? [], assignments });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!(await operationalCapabilities(client)).publish) return forbidden();
  const body = await request.json().catch(() => null);
  if (typeof body?.title !== "string" || body.title.trim().length < 3 || body.title.length > 120)
    return privateJson({ error: "Invalid title" }, 400);
  const { data, error } = await client.rpc("create_operational_controlled_document", { supplied_title: body.title });
  return error || !data ? privateJson({ error: "Creation denied" }, 403) : privateJson({ documentId: data }, 201);
}
