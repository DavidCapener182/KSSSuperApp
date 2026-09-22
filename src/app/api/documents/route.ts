import { getPrincipal } from "@/lib/auth/principal";
import { canCreateDocumentRequest, canUseDocuments, publicDocument, readDocumentRequest } from "@/lib/documents/policy";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canUseDocuments(principal)) return forbidden();
  const { data, error, count } = await client.from("document_requests")
    .select("id", { count: "exact" }).order("created_at", { ascending: false }).limit(50);
  if (error) return privateJson({ error: "Unable to load documents" }, 500);
  const requests = await Promise.all((data ?? []).map((item) => readDocumentRequest(client, item.id)));
  return privateJson({ count: count ?? 0, requests: requests.filter((item) => item !== null).map((item) => publicDocument(item)) });
}
export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canCreateDocumentRequest(principal)) return forbidden();
  const input = await request.json().catch(() => null);
  const target = input?.targetPersonId;
  const site = input?.siteId ?? null;
  const title = input?.title;
  if (!isUuid(target) || (site !== null && !isUuid(site)) || typeof title !== "string" ||
    title.trim().length < 1 || title.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(title)) return privateJson({ error: "Invalid request" }, 400);
  const { data, error } = await client.rpc("create_document_request", {
    target_person: target, requested_site: site, request_title: title.trim(),
  });
  if (error || !data) return privateJson({ error: "Document request denied" }, 403);
  return privateJson({ id: data }, 201);
}
