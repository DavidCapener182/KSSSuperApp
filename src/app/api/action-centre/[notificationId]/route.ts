import { forbidden, notFound, privateJson, unauthorised } from "@/lib/auth/responses";
import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();

  const { notificationId } = await params;
  if (!isUuid(notificationId)) return notFound();
  const bodyText = await request.text();
  if (bodyText.length > 128) return privateJson({ error: "Invalid Action Centre action" }, 413);
  let body: unknown = null;
  try { body = JSON.parse(bodyText) as unknown; } catch { /* malformed request */ }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
    !("action" in body) || typeof body.action !== "string" || !["READ", "DISMISS"].includes(body.action)) {
    return privateJson({ error: "Invalid Action Centre action" }, 400);
  }
  const { data, error } = await client.rpc("staff_action_notification_change", {
    p_notification: notificationId, p_action: body.action,
  });
  // The same response covers unknown IDs and IDs belonging to another Person.
  if (error) return notFound();
  return privateJson(data);
}
