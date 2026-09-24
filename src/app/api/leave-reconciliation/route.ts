import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageDeployment } from "@/lib/events/deployment";

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canManageDeployment(principal.roles)) return forbidden();
  const query = new URL(request.url).searchParams;
  const source = query.get("source"), allocationId = query.get("allocationId");
  if (!["EVENT", "SITE_SHIFT"].includes(source ?? "") || !allocationId || !isUuid(allocationId))
    return privateJson({ error: "Invalid allocation" }, 400);
  const { data, error } = await client.rpc("time_away_reconciliation_list", {
    p_source: source, p_allocation: allocationId,
  });
  return error ? privateJson({ error: "Reconciliation unavailable" }, 403) : privateJson({ issues: data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!canManageDeployment(principal.roles)) return forbidden();
  const body = await request.json().catch(() => null);
  if (!body || !isUuid(body.issueId) || !Number.isInteger(body.expectedRevision) ||
    body.expectedRevision < 1 || typeof body.reason !== "string" ||
    body.reason.trim().length < 10 || body.reason.length > 300 || /[\x00-\x1f\x7f]/.test(body.reason))
    return privateJson({ error: "Invalid reconciliation closure" }, 400);
  const { data, error } = await client.rpc("time_away_reconciliation_close", {
    p_issue: body.issueId, p_expected_revision: body.expectedRevision, p_reason: body.reason.trim(),
  });
  return error ? privateJson({ error: "Reconciliation remains open. Review the current allocation and approved time away." }, 409)
    : privateJson({ revision: data });
}
