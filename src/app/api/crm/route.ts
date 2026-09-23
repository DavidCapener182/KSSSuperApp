import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

const views = new Set(["overview", "organisations", "contacts", "opportunities", "organisation", "opportunity"]);
const types = new Set(["TENDER", "DIRECT_ENQUIRY", "EXISTING_CLIENT_EXPANSION", "RENEWAL", "PROSPECTING"]);
const stages = new Set(["NEW_LEAD", "CONTACTED", "QUALIFIED", "PROPOSAL_TENDER", "NEGOTIATION", "WON", "LOST"]);
const statuses = new Set(["PROSPECT", "CLIENT", "FORMER_CLIENT", "PARTNER"]);
const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const maybe = (value: unknown, max: number) => value == null || text(value, max);

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!hasCapability(principal, "CRM_USE")) return forbidden();
  const params = new URL(request.url).searchParams;
  const view = params.get("view") ?? "overview";
  const search = params.get("search") ?? "";
  const stage = params.get("stage") ?? "";
  const type = params.get("type") ?? "";
  const status = params.get("status") ?? "";
  const owner = params.get("owner") ?? "";
  const offset = Number(params.get("offset") ?? 0);
  const id = params.get("id");
  if (!views.has(view) || !text(search, 100) || !/^[\p{L}\p{N} @._'+&/-]*$/u.test(search)
    || !Number.isInteger(offset) || offset < 0 || offset > 10000
    || (stage && !stages.has(stage)) || (type && !types.has(type)) || (status && !statuses.has(status))
    || (owner && !isUuid(owner)) || ((view === "organisation" || view === "opportunity") && (!id || !isUuid(id))))
    return privateJson({ error: "Invalid CRM query" }, 400);

  if (view === "overview") {
    const [organisations, contacts, open, newLeads, proposals, won, lost] = await Promise.all([
      client.from("crm_organisations").select("id", { count: "exact", head: true }),
      client.from("crm_contacts").select("id", { count: "exact", head: true }),
      client.from("crm_opportunities").select("id", { count: "exact", head: true }).not("stage", "in", '("WON","LOST")'),
      client.from("crm_opportunities").select("id", { count: "exact", head: true }).eq("stage", "NEW_LEAD"),
      client.from("crm_opportunities").select("id", { count: "exact", head: true }).eq("stage", "PROPOSAL_TENDER"),
      client.from("crm_opportunities").select("id", { count: "exact", head: true }).eq("stage", "WON"),
      client.from("crm_opportunities").select("id", { count: "exact", head: true }).eq("stage", "LOST"),
    ]);
    if ([organisations, contacts, open, newLeads, proposals, won, lost].some((result) => result.error)) return privateJson({ error: "CRM unavailable" }, 503);
    return privateJson({ organisations: organisations.count, contacts: contacts.count,
      open: open.count, newLeads: newLeads.count, proposals: proposals.count, won: won.count, lost: lost.count });
  }
  if (view === "organisation") {
    const [organisation, contacts, opportunities, history, ownerHistory] = await Promise.all([
      client.from("crm_organisations").select("*").eq("id", id!).maybeSingle(),
      client.from("crm_contacts").select("*").eq("organisation_id", id!).order("created_at"),
      client.from("crm_opportunities").select("*").eq("organisation_id", id!).order("created_at", { ascending: false }),
      client.from("crm_relationship_events").select("*").eq("organisation_id", id!).order("occurred_at", { ascending: false }),
      client.from("crm_organisation_owner_events").select("*").eq("organisation_id", id!).order("occurred_at", { ascending: false }),
    ]);
    if (organisation.error || contacts.error || opportunities.error || history.error || ownerHistory.error) return privateJson({ error: "CRM unavailable" }, 503);
    if (!organisation.data) return privateJson({ error: "Not found" }, 404);
    return privateJson({ organisation: organisation.data, contacts: contacts.data, opportunities: opportunities.data, history: history.data, ownerHistory: ownerHistory.data });
  }
  if (view === "opportunity") {
    const opportunity = await client.from("crm_opportunities").select("*").eq("id", id!).maybeSingle();
    if (opportunity.error) return privateJson({ error: "CRM unavailable" }, 503);
    if (!opportunity.data) return privateJson({ error: "Not found" }, 404);
    const [organisation, contact, history] = await Promise.all([
      client.from("crm_organisations").select("id,name,relationship_status").eq("id", opportunity.data.organisation_id).single(),
      opportunity.data.primary_contact_id ? client.from("crm_contacts").select("id,first_name,last_name").eq("id", opportunity.data.primary_contact_id).single() : Promise.resolve({ data: null, error: null }),
      client.from("crm_opportunity_events").select("*").eq("opportunity_id", id!).order("occurred_at", { ascending: false }),
    ]);
    if (organisation.error || contact.error || history.error) return privateJson({ error: "CRM unavailable" }, 503);
    return privateJson({ opportunity: opportunity.data, organisation: organisation.data, contact: contact.data, history: history.data });
  }
  if (view === "organisations") {
    let query = client.from("crm_organisations").select("*", { count: "exact" }).order("name").order("id");
    if (search) query = query.or(`name.ilike.%${search}%,trading_name.ilike.%${search}%`);
    if (status) query = query.eq("relationship_status", status);
    if (owner) query = query.eq("owner_person_id", owner);
    const result = await query.range(offset, offset + 24);
    if (result.error) return privateJson({ error: "CRM unavailable" }, 503);
    const ids = (result.data ?? []).map((row) => row.id);
    if (!ids.length) return privateJson({ items: [], total: result.count, offset });
    const [primary, open] = await Promise.all([
      client.from("crm_contacts").select("organisation_id,first_name,last_name").in("organisation_id", ids).eq("is_primary", true).eq("active", true),
      client.from("crm_opportunities").select("organisation_id").in("organisation_id", ids).not("stage", "in", '("WON","LOST")'),
    ]);
    if (primary.error || open.error) return privateJson({ error: "CRM unavailable" }, 503);
    const primaryByOrg = new Map((primary.data ?? []).map((row) => [row.organisation_id, `${row.first_name} ${row.last_name}`]));
    const openByOrg = new Map<string, number>();
    for (const row of open.data ?? []) openByOrg.set(row.organisation_id, (openByOrg.get(row.organisation_id) ?? 0) + 1);
    return privateJson({ items: result.data?.map((row) => ({ ...row, primaryContactName: primaryByOrg.get(row.id) ?? null, openOpportunityCount: openByOrg.get(row.id) ?? 0 })), total: result.count, offset });
  }
  if (view === "contacts") {
    let query = client.from("crm_contacts").select("*,crm_organisations(name)", { count: "exact" }).order("last_name").order("id");
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,business_email.ilike.%${search}%`);
    const result = await query.range(offset, offset + 24);
    if (result.error) return privateJson({ error: "CRM unavailable" }, 503);
    return privateJson({ items: result.data, total: result.count, offset });
  }
  let query = client.from("crm_opportunities").select("*,crm_organisations(name)", { count: "exact" }).order("created_at", { ascending: false }).order("id");
  if (search) query = query.ilike("title", `%${search}%`);
  if (stage) query = query.eq("stage", stage);
  if (type) query = query.eq("opportunity_type", type);
  if (owner) query = query.eq("owner_person_id", owner);
  const result = await query.range(offset, offset + 24);
  if (result.error) return privateJson({ error: "CRM unavailable" }, 503);
  return privateJson({ items: result.data, total: result.count, offset });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!hasCapability(principal, "CRM_USE")) return forbidden();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return privateJson({ error: "Invalid CRM request" }, 400);
  const action = body.action;
  let operation: string | null = null;
  let args: Record<string, unknown> = {};
  if (action === "createOrganisation" && text(body.name, 160) && maybe(body.tradingName, 160)
    && maybe(body.website, 300) && maybe(body.email, 254) && maybe(body.phone, 30)
    && (!body.ownerId || isUuid(body.ownerId))) {
    operation = "crm_create_organisation";
    args = { p_name: body.name, p_trading_name: body.tradingName ?? null, p_website: body.website ?? null,
      p_email: body.email ?? null, p_phone: body.phone ?? null, p_owner: body.ownerId ?? null };
  } else if (action === "updateOrganisation" && isUuid(body.id) && text(body.name, 160) && maybe(body.tradingName, 160)
    && maybe(body.website, 300) && maybe(body.email, 254) && maybe(body.phone, 30)
    && (!body.ownerId || isUuid(body.ownerId))) {
    operation = "crm_update_organisation";
    args = { p_id: body.id, p_name: body.name, p_trading_name: body.tradingName ?? null, p_website: body.website ?? null,
      p_email: body.email ?? null, p_phone: body.phone ?? null, p_owner: body.ownerId ?? null };
  } else if (action === "createContact" && isUuid(body.organisationId) && text(body.firstName, 100)
    && text(body.lastName, 100) && maybe(body.jobTitle, 120) && maybe(body.email, 254) && maybe(body.phone, 30)) {
    operation = "crm_create_contact";
    args = { p_organisation: body.organisationId, p_first: body.firstName, p_last: body.lastName,
      p_title: body.jobTitle ?? null, p_email: body.email ?? null, p_phone: body.phone ?? null,
      p_primary: body.primary === true, p_duplicate_confirmed: body.duplicateConfirmed === true };
  } else if (action === "updateContact" && isUuid(body.id) && text(body.firstName, 100)
    && text(body.lastName, 100) && maybe(body.jobTitle, 120) && maybe(body.email, 254) && maybe(body.phone, 30)) {
    operation = "crm_update_contact";
    args = { p_id: body.id, p_first: body.firstName, p_last: body.lastName, p_title: body.jobTitle ?? null,
      p_email: body.email ?? null, p_phone: body.phone ?? null, p_active: body.active !== false,
      p_primary: body.primary === true, p_duplicate_confirmed: body.duplicateConfirmed === true };
  } else if (action === "createOpportunity" && isUuid(body.organisationId) && isUuid(body.ownerId)
    && (!body.contactId || isUuid(body.contactId)) && text(body.title, 180) && types.has(body.type)
    && (body.valuePence == null || (Number.isSafeInteger(body.valuePence) && body.valuePence >= 0))
    && (body.decisionDate == null || /^\d{4}-\d{2}-\d{2}$/.test(body.decisionDate))
    && maybe(body.summary, 1000)) {
    operation = "crm_create_opportunity";
    args = { p_organisation: body.organisationId, p_title: body.title, p_type: body.type,
      p_owner: body.ownerId, p_contact: body.contactId ?? null, p_value: body.valuePence ?? null,
      p_decision: body.decisionDate ?? null, p_summary: body.summary ?? null };
  } else if (action === "transition" && isUuid(body.id) && stages.has(body.stage) && maybe(body.reason, 500)) {
    operation = "crm_transition_opportunity"; args = { p_id: body.id, p_stage: body.stage, p_reason: body.reason ?? null };
  } else if (action === "changeOwner" && isUuid(body.id) && isUuid(body.ownerId)) {
    operation = "crm_change_opportunity_owner"; args = { p_id: body.id, p_owner: body.ownerId };
  } else if (action === "changeValue" && isUuid(body.id) && (body.valuePence == null || (Number.isSafeInteger(body.valuePence) && body.valuePence >= 0))) {
    operation = "crm_change_opportunity_value"; args = { p_id: body.id, p_value: body.valuePence ?? null };
  }
  if (!operation) return privateJson({ error: "Invalid CRM request" }, 400);
  const { data, error } = await client.rpc(operation, args);
  if (error) return privateJson({ error: "CRM action denied", detail: error.message.includes("duplicate") ? "Possible duplicate. Confirm before creating." : undefined }, 403);
  return privateJson({ id: data ?? body.id ?? null }, action.startsWith("create") ? 201 : 200);
}
