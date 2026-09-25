import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { londonDueToIso } from "@/lib/crm/due-time";
import { createServerSupabase } from "@/lib/supabase/server";

const stages = ["NEW_LEAD", "CONTACTED", "QUALIFIED", "PROPOSAL_TENDER", "NEGOTIATION"];
const activityTypes = new Set(["PHONE_CALL", "EMAIL", "MEETING", "NOTE", "TENDER_UPDATE", "PROPOSAL_SENT", "FOLLOW_UP"]);
const sourceKinds = new Set(["CRM_OPPORTUNITY", "CRM_ORGANISATION"]);
const opportunityTypes = new Set(["TENDER", "DIRECT_ENQUIRY", "EXISTING_CLIENT_EXPANSION", "RENEWAL", "PROSPECTING"]);
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 &&
  value.length <= max && !/[\x00-\x1f\x7f]/.test(value);

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!hasCapability(principal, "CRM_USE")) return forbidden();
  const params = new URL(request.url).searchParams;
  const view = params.get("view") ?? "pipeline";
  const id = params.get("id");
  const owner = params.get("owner");
  const type = params.get("type");
  const organisation = params.get("organisation");
  const orgSearch = params.get("orgSearch") ?? "";
  if ((id && !isUuid(id)) || (owner && owner !== "mine" && !isUuid(owner)) ||
    (organisation && !isUuid(organisation)) || (type && !opportunityTypes.has(type)) ||
    orgSearch.length > 80 || !/^[\p{L}\p{N} .&'-]*$/u.test(orgSearch)) return privateJson({ error: "Invalid CRM query" }, 400);
  if (view === "attention") {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const weekEnd = new Date(`${today}T12:00:00Z`);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const [followUps, decisions, openSample] = await Promise.all([
      client.from("tasks").select("id,source_id,title,due_at,assignee_person_id")
        .eq("task_type", "CRM_FOLLOW_UP").eq("source_kind", "CRM_OPPORTUNITY").eq("state", "OPEN")
        .lt("due_at", weekEnd.toISOString()).order("due_at", { ascending: true }).limit(25),
      client.from("crm_opportunities").select("id,title,stage,owner_person_id,expected_decision_date,crm_organisations(name)")
        .not("stage", "in", '("WON","LOST")').gte("expected_decision_date", today)
        .lte("expected_decision_date", weekEnd.toISOString().slice(0, 10))
        .order("expected_decision_date").limit(15),
      client.from("crm_opportunities").select("id,title,stage,owner_person_id,expected_decision_date,crm_organisations(name)")
        .not("stage", "in", '("WON","LOST")').order("updated_at", { ascending: false }).limit(50),
    ]);
    if (followUps.error || decisions.error || openSample.error) return privateJson({ error: "Commercial attention unavailable" }, 503);
    const sourceIds = [...new Set((followUps.data ?? []).map(task => task.source_id).filter(isUuid))];
    const opportunities = sourceIds.length ? await client.from("crm_opportunities")
      .select("id,title,stage,organisation_id,crm_organisations(name)").in("id", sourceIds) : null;
    if (opportunities?.error) return privateJson({ error: "Commercial attention unavailable" }, 503);
    const byId = new Map((opportunities?.data ?? []).map(item => [item.id, item]));
    const sampleIds = (openSample.data ?? []).map(item => item.id);
    const sampleTasks = sampleIds.length ? await client.from("tasks").select("source_id,due_at")
      .eq("task_type", "CRM_FOLLOW_UP").eq("source_kind", "CRM_OPPORTUNITY").eq("state", "OPEN")
      .in("source_id", sampleIds).gte("due_at", new Date().toISOString()) : null;
    if (sampleTasks?.error) return privateJson({ error: "Commercial attention unavailable" }, 503);
    const planned = new Set((sampleTasks?.data ?? []).map(task => task.source_id));
    return privateJson({ followUps: (followUps.data ?? []).map(task => ({ ...task, opportunity: byId.get(task.source_id) ?? null })),
      decisions: decisions.data ?? [], noFutureSample: (openSample.data ?? []).filter(item => !planned.has(item.id)).slice(0, 12),
      asOf: new Date().toISOString(), bounded: true });
  }
  if (view === "pipeline") {
    const closed = params.get("closed") === "true";
    const selectedStages = closed ? ["WON", "LOST"] : stages;
    const results = await Promise.all(selectedStages.map(async (stage) => {
      let query = client.from("crm_opportunities")
        .select("id,title,stage,organisation_id,owner_person_id,opportunity_type,estimated_value_gbp_pence,expected_decision_date,primary_contact_id,crm_organisations!inner(name)", { count: "exact" })
        .eq("stage", stage).order("updated_at", { ascending: false }).order("id");
      if (owner) query = query.eq("owner_person_id", owner === "mine" ? principal.personId : owner);
      if (type) query = query.eq("opportunity_type", type);
      if (organisation) query = query.eq("organisation_id", organisation);
      if (orgSearch) query = query.ilike("crm_organisations.name", `%${orgSearch}%`);
      const result = await query.range(0, 49);
      return { stage, count: result.count ?? 0, items: result.data ?? [], error: result.error };
    }));
    if (results.some((result) => result.error)) return privateJson({ error: "CRM unavailable" }, 503);
    const ids = results.flatMap((result) => result.items.map((item) => item.id));
    const contactIds = [...new Set(results.flatMap((result) => result.items.map((item) => item.primary_contact_id).filter(Boolean)))];
    const contacts = contactIds.length ? await client.from("crm_contacts")
      .select("id,first_name,last_name").in("id", contactIds) : null;
    if (contacts?.error) return privateJson({ error: "CRM unavailable" }, 503);
    const contactNames = new Map((contacts?.data ?? []).map((item) => [item.id, `${item.first_name} ${item.last_name}`]));
    const tasks = ids.length ? await client.from("tasks")
      .select("id,source_id,title,due_at,created_at,state")
      .eq("task_type", "CRM_FOLLOW_UP").eq("source_kind", "CRM_OPPORTUNITY")
      .eq("state", "OPEN").in("source_id", ids).order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }).order("id", { ascending: true }) : null;
    if (tasks?.error) return privateJson({ error: "CRM unavailable" }, 503);
    const next = new Map<string, { title: string; due_at: string | null }>();
    for (const task of tasks?.data ?? []) if (!next.has(task.source_id)) next.set(task.source_id, task);
    return privateJson({ columns: results.map(({ stage, count, items }) => ({
      stage, count, items: items.map((item) => ({ ...item, primaryContactName: contactNames.get(item.primary_contact_id) ?? null,
        nextFollowUp: next.get(item.id) ?? null })),
    })) });
  }
  if (view === "opportunity" || view === "organisation") {
    if (!id) return privateJson({ error: "Invalid CRM query" }, 400);
    const sourceKind = view === "opportunity" ? "CRM_OPPORTUNITY" : "CRM_ORGANISATION";
    const source = view === "opportunity"
      ? await client.from("crm_opportunities").select("id,organisation_id").eq("id", id).maybeSingle()
      : await client.from("crm_organisations").select("id").eq("id", id).maybeSingle();
    if (source.error) return privateJson({ error: "CRM unavailable" }, 503);
    if (!source.data) return privateJson({ error: "Not found" }, 404);
    const orgId = view === "opportunity" ? String("organisation_id" in source.data ? source.data.organisation_id : "") : id;
    const [activities, tasks, contacts] = await Promise.all([
      client.from("crm_activities").select("*").eq(view === "opportunity" ? "opportunity_id" : "organisation_id", id)
        .order("occurred_at", { ascending: false }).limit(50),
      client.from("tasks").select("id,title,state,assignee_person_id,created_by_person_id,due_at,created_at,completed_at,cancelled_at,source_kind,source_id")
        .eq("task_type", "CRM_FOLLOW_UP").eq("source_kind", sourceKind).eq("source_id", id)
        .order("created_at", { ascending: false }).limit(100),
      client.from("crm_contacts").select("id,first_name,last_name").eq("organisation_id", orgId).eq("active", true).order("last_name").limit(100),
    ]);
    if (activities.error || tasks.error || contacts.error) return privateJson({ error: "CRM unavailable" }, 503);
    const taskIds = (tasks.data ?? []).map((task) => task.id);
    const history = taskIds.length ? await client.from("crm_task_events").select("*")
      .in("task_id", taskIds).order("occurred_at", { ascending: false }).limit(200) : null;
    if (history?.error) return privateJson({ error: "CRM unavailable" }, 503);
    return privateJson({ organisationId: orgId, activities: activities.data, tasks: tasks.data,
      contacts: contacts.data, taskEvents: history?.data ?? [] });
  }
  return privateJson({ error: "Invalid CRM query" }, 400);
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!hasCapability(principal, "CRM_USE")) return forbidden();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return privateJson({ error: "Invalid CRM action" }, 400);
  let operation: string | null = null;
  let args: Record<string, unknown> = {};
  if (body.action === "activity" && isUuid(body.organisationId) &&
    (!body.opportunityId || isUuid(body.opportunityId)) && (!body.contactId || isUuid(body.contactId)) &&
    (!body.correctsId || isUuid(body.correctsId)) && activityTypes.has(body.type) &&
    text(body.subject, 160) && (body.summary == null || body.summary === "" || text(body.summary, 1000))) {
    operation = "crm_record_activity";
    args = { p_organisation: body.organisationId, p_opportunity: body.opportunityId ?? null,
      p_contact: body.contactId ?? null, p_type: body.type, p_subject: body.subject,
      p_summary: body.summary ?? null, p_corrects: body.correctsId ?? null };
  } else if (body.action === "createTask" && sourceKinds.has(body.sourceKind) && isUuid(body.sourceId) &&
    isUuid(body.assigneeId) && text(body.title, 160)) {
    const due = londonDueToIso(body.dueLocal);
    if (due === undefined) return privateJson({ error: "Choose an unambiguous Europe/London due time" }, 400);
    operation = "crm_create_follow_up";
    args = { p_source_kind: body.sourceKind, p_source_id: body.sourceId, p_title: body.title,
      p_assignee: body.assigneeId, p_due_at: due };
  } else if (body.action === "changeTask" && isUuid(body.id) &&
    ["REASSIGN", "RESCHEDULE", "COMPLETE", "CANCEL"].includes(body.kind) &&
    (!body.assigneeId || isUuid(body.assigneeId)) &&
    (body.reason == null || text(body.reason, 300))) {
    const due = londonDueToIso(body.dueLocal);
    if (due === undefined) return privateJson({ error: "Choose an unambiguous Europe/London due time" }, 400);
    operation = "crm_change_follow_up";
    args = { p_id: body.id, p_action: body.kind, p_assignee: body.assigneeId ?? null,
      p_due_at: due, p_reason: body.reason ?? null };
  }
  if (!operation) return privateJson({ error: "Invalid CRM action" }, 400);
  const { data, error } = await client.rpc(operation, args);
  if (error) return privateJson({ error: "CRM action denied" }, 403);
  return privateJson({ id: data ?? body.id ?? null }, operation === "crm_change_follow_up" ? 200 : 201);
}
