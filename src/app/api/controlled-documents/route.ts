import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { hasControlledPublisherGrant } from "@/lib/controlled/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const canPublish = await hasControlledPublisherGrant(client, principal);
  if (!canPublish && !principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { data: docs, error } = await client.from("controlled_documents")
    .select("id,title,family,created_at,created_by_person_id")
    .order("created_at", { ascending: false }).limit(20);
  if (error) return privateJson({ error: "Controlled documents unavailable" }, 503);
  const documents = await Promise.all((docs ?? []).map(async (doc) => {
    const { data: versions } = await client.from("controlled_document_versions")
      .select("id,document_id,version_number,title,upload_state,state,scan_state,published_at,effective_on,byte_size,sha256")
      .eq("document_id", doc.id).order("version_number", { ascending: false });
    return { ...doc, versions: versions ?? [] };
  }));
  return privateJson({ canPublish, documents });
}

export async function POST() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!(await hasControlledPublisherGrant(client, principal))) return forbidden();
  const { data, error } = await client.rpc("create_controlled_document");
  return error || !data ? privateJson({ error: "Controlled document creation denied" }, 403)
    : privateJson({ documentId: data }, 201);
}
