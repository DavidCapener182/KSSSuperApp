import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const office = (roles: string[]) => roles.includes("OFFICE_ADMIN") || roles.includes("SUPER_ADMIN");
const validDate = (value: unknown) => value == null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
const validText = (value: unknown, min: number, max: number) => typeof value === "string" && value.trim().length >= min && value.trim().length <= max && !/[\x00-\x1f\x7f]/.test(value);

export async function GET(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!office(principal.roles)) return forbidden();
  const q = new URL(request.url).searchParams; const organisation = q.get("organisationId"); const offset = Number(q.get("offset") ?? 0);
  if ((organisation && !isUuid(organisation)) || !Number.isInteger(offset) || offset < 0 || offset > 10000) return privateJson({ error: "Invalid filter" }, 400);
  const { data, error } = await client.rpc("mobilisation_list", { p_organisation: organisation || null, p_offset: offset, p_limit: 25 });
  return error ? privateJson({ error: "Mobilisations unavailable" }, 503) : privateJson(data);
}

export async function POST(request: Request) {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!office(principal.roles)) return forbidden();
  const body = await request.json().catch(() => null);
  if (!body || !isUuid(body.organisationId) || (body.opportunityId && !isUuid(body.opportunityId)) ||
    !["STATIC_SITE", "EVENT"].includes(body.templateCode) || !validText(body.title, 3, 180) || !isUuid(body.ownerId) ||
    !validDate(body.targetDate) || (body.duplicateReason && !validText(body.duplicateReason, 3, 500)) || !isUuid(body.requestKey))
    return privateJson({ error: "Invalid mobilisation input" }, 400);
  const { data, error } = await client.rpc("mobilisation_authorise", {
    p_organisation: body.organisationId, p_opportunity: body.opportunityId || null, p_template: body.templateCode,
    p_title: body.title.trim(), p_owner: body.ownerId, p_target: body.targetDate || null,
    p_duplicate_reason: body.duplicateReason?.trim() || null, p_key: body.requestKey,
  });
  return error ? privateJson({ error: error.message.includes("Duplicate scope") ? "A matching mobilisation exists. Give this scope a distinct name and reason." : "Mobilisation authorisation denied" }, 409)
    : privateJson(data, 201);
}
