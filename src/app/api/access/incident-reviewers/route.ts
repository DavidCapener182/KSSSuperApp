import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const { data, error } = await client.rpc("incident_reviewer_grants_list");
  return error ? privateJson({ error: "Reviewer grants unavailable" }, 503) : privateJson({ reviewers: data });
}
export async function POST(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!principal.roles.includes("SUPER_ADMIN")) return forbidden();
  const b = await request.json().catch(() => null);
  if (!b || !isUuid(b.personId) || typeof b.lastActiveDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.lastActiveDate) || typeof b.reason !== "string" || b.reason.trim().length < 3 || b.reason.length > 300) return privateJson({ error: "Check the reviewer grant details." }, 400);
  const { data, error } = await client.rpc("incident_reviewer_grant", { p_reviewer: b.personId, p_last_active_date: b.lastActiveDate, p_reason: b.reason.trim() });
  return error ? privateJson({ error: "Reviewer grant not recorded. Refresh and check current access." }, 409) : privateJson({ grantId: data }, 201);
}
