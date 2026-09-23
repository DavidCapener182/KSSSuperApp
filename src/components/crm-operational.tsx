"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { crmDueStatus } from "@/lib/crm/due-status";

type Row = Record<string, unknown>;
type Owner = { id: string; displayName: string };
const openStages = ["NEW_LEAD", "CONTACTED", "QUALIFIED", "PROPOSAL_TENDER", "NEGOTIATION"];
const label = (value: unknown) => String(value ?? "").replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const time = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "No due time";
const money = (value: unknown) => value == null ? "Not estimated" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value) / 100);
const londonLocal = (value: unknown) => {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(String(value)));
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
async function send(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "CRM action denied");
  return result;
}

export function CrmPipeline({ owners }: { owners: Owner[] }) {
  const [columns, setColumns] = useState<{ stage: string; count: number; items: Row[] }[]>([]);
  const [closed, setClosed] = useState(false);
  const [owner, setOwner] = useState("");
  const [type, setType] = useState("");
  const [orgInput, setOrgInput] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [mobileStage, setMobileStage] = useState("NEW_LEAD");
  const [pending, setPending] = useState<{ id: string; from: string; to: string } | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: "pipeline", closed: String(closed) });
      if (owner) params.set("owner", owner);
      if (type) params.set("type", type);
      if (orgSearch) params.set("orgSearch", orgSearch);
      const response = await fetch(`/api/crm/work?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Pipeline unavailable");
      setColumns((await response.json()).columns ?? []);
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Pipeline unavailable"); }
    finally { setLoading(false); }
  }, [closed, owner, type, orgSearch]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const rank = (stage: string) => openStages.indexOf(stage);
  const move = (id: string, from: string, to: string) => {
    if (!to || to === from || closed) return;
    setPending({ id, from, to }); setReason(""); setConfirm(false);
  };
  async function commit() {
    if (!pending) return;
    setBusy(true); setError("");
    try {
      await send("/api/crm", { action: "transition", id: pending.id, stage: pending.to, reason: reason || null });
      setPending(null); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Stage change denied"); }
    finally { setBusy(false); }
  }
  return <section aria-label="Opportunity pipeline">
    <div className="crm-operational-tools">
      <div className="crm-view-switch"><Button variant={!closed ? "default" : "outline"} onClick={() => { setClosed(false); setMobileStage("NEW_LEAD"); }}>Active pipeline</Button>
        <Button variant={closed ? "default" : "outline"} onClick={() => { setClosed(true); setMobileStage("WON"); }}>Closed history</Button></div>
      <label className="crm-field">Owner<select value={owner} onChange={(event) => setOwner(event.target.value)}>
        <option value="">All Office</option><option value="mine">My Opportunities</option>
        {owners.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
      </select></label>
      <label className="crm-field">Type<select value={type} onChange={(event) => setType(event.target.value)}>
        <option value="">All types</option>{["TENDER", "DIRECT_ENQUIRY", "EXISTING_CLIENT_EXPANSION", "RENEWAL", "PROSPECTING"]
          .map((item) => <option key={item} value={item}>{label(item)}</option>)}
      </select></label>
      <form className="crm-org-filter" onSubmit={(event) => { event.preventDefault(); setOrgSearch(orgInput.trim()); }}>
        <label className="crm-field">Organisation<Input value={orgInput} maxLength={80} placeholder="Search Organisation"
          onChange={(event) => setOrgInput(event.target.value)} /></label><Button variant="outline">Filter</Button>
      </form>
      <label className="crm-field crm-mobile-stage">Stage<select value={mobileStage} onChange={(event) => setMobileStage(event.target.value)}>
        {(closed ? ["WON", "LOST"] : openStages).map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}
      </select></label>
    </div>
    {error && <p role="alert" className="enterprise-error">{error} <Button variant="ghost" onClick={() => void load()}>Retry</Button></p>}
    {loading ? <p role="status" className="crm-skeleton">Loading pipeline…</p> :
      <div className={`crm-board ${closed ? "crm-board--closed" : ""}`}>
        {columns.map((column) => <section className={`crm-board-column ${column.stage !== mobileStage ? "crm-mobile-hidden" : ""}`} key={column.stage}
          aria-label={`${label(column.stage)} opportunities`}
          onDragOver={(event) => { if (!closed) event.preventDefault(); }}
          onDrop={(event) => { event.preventDefault(); const raw = event.dataTransfer.getData("application/json");
            try { const item = JSON.parse(raw) as { id: string; from: string }; move(item.id, item.from, column.stage); } catch {} }}>
          <div className="crm-board-heading"><h2>{label(column.stage)}</h2><span>{column.count}</span></div>
          {column.items.length === 0 && <p className="crm-board-empty">No opportunities in this stage.</p>}
          {column.items.map((item) => <article className="crm-board-card" key={String(item.id)} draggable={!closed}
            onDragStart={(event) => event.dataTransfer.setData("application/json", JSON.stringify({ id: item.id, from: item.stage }))}>
            <Link href={`/crm/opportunities/${item.id}`}><strong>{String(item.title)}</strong></Link>
            <span>{String((item.crm_organisations as Row)?.name ?? "Organisation")}</span>
            <span>Estimate: {money(item.estimated_value_gbp_pence)}</span>
            <span>Owner: {owners.find((person) => person.id === item.owner_person_id)?.displayName ?? "Office"}</span>
            {Boolean(item.primaryContactName) && <span>Contact: {String(item.primaryContactName)}</span>}
            {Boolean(item.expected_decision_date) && <span>Decision: {String(item.expected_decision_date)}</span>}
            {Boolean(item.nextFollowUp) && <span>Next: {String((item.nextFollowUp as Row).title)} · {crmDueStatus((item.nextFollowUp as Row).due_at as string | null)} · {time((item.nextFollowUp as Row).due_at)}</span>}
            {!closed && <label className="crm-board-stage-action">Move stage<select aria-label={`Move ${item.title} to stage`} value=""
              onChange={(event) => move(String(item.id), String(item.stage), event.target.value)}>
              <option value="">Select stage</option>{[...openStages, "WON", "LOST"].filter((stage) => stage !== item.stage)
                .map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}
            </select></label>}
          </article>)}
          {column.count > column.items.length && <p className="crm-board-empty">Showing first {column.items.length} of {column.count}. Use Opportunities search for more.</p>}
        </section>)}
      </div>}
    {pending && <div className="crm-dialog-backdrop"><section className="crm-dialog" role="dialog" aria-modal="true" aria-label="Confirm stage change">
      <h2>Move to {label(pending.to)}?</h2><p>{label(pending.from)} → {label(pending.to)}</p>
      {(pending.to === "LOST" || rank(pending.to) < rank(pending.from)) && <label className="crm-field">Reason
        <Input autoFocus value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label>}
      {pending.to === "WON" && <label className="crm-confirm"><input type="checkbox" checked={confirm}
        onChange={(event) => setConfirm(event.target.checked)} /> I confirm this commercial decision. It does not establish a signed contract.</label>}
      <div className="crm-dialog-actions"><Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
        <Button disabled={busy || (pending.to === "WON" && !confirm) ||
          ((pending.to === "LOST" || rank(pending.to) < rank(pending.from)) && reason.trim().length < 3)} onClick={() => void commit()}>
          {busy ? "Saving…" : "Record stage change"}</Button></div>
    </section></div>}
  </section>;
}

export function CrmRecordWork({ kind, id, organisationId, owners, currentPersonId, accountableOwnerId, commercialHistory }: {
  kind: "opportunity" | "organisation"; id: string; organisationId: string; owners: Owner[];
  currentPersonId: string; accountableOwnerId?: string; commercialHistory: Row[];
}) {
  const [data, setData] = useState<{ activities: Row[]; tasks: Row[]; taskEvents: Row[]; contacts: Row[] } | null>(null);
  const [activity, setActivity] = useState({ type: "PHONE_CALL", subject: "", summary: "", contactId: "", correctsId: "" });
  const [task, setTask] = useState({ title: "", assigneeId: currentPersonId, dueLocal: "" });
  const [taskChange, setTaskChange] = useState<{ id: string; kind: string; assigneeId: string; dueLocal: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch(`/api/crm/work?view=${kind}&id=${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("CRM work unavailable");
      setData(await response.json()); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "CRM work unavailable"); }
    finally { setLoading(false); }
  }, [kind, id]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function createActivity(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await send("/api/crm/work", { action: "activity", organisationId,
      opportunityId: kind === "opportunity" ? id : null, contactId: activity.contactId || null,
      type: activity.type, subject: activity.subject, summary: activity.summary, correctsId: activity.correctsId || null });
      setActivity({ type: "PHONE_CALL", subject: "", summary: "", contactId: "", correctsId: "" }); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Activity denied"); }
    finally { setBusy(false); }
  }
  async function createTask(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await send("/api/crm/work", { action: "createTask", sourceKind: kind === "opportunity" ? "CRM_OPPORTUNITY" : "CRM_ORGANISATION",
      sourceId: id, title: task.title, assigneeId: task.assigneeId, dueLocal: task.dueLocal || null });
      setTask({ title: "", assigneeId: currentPersonId, dueLocal: "" }); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Task denied"); }
    finally { setBusy(false); }
  }
  async function changeTask() {
    if (!taskChange) return; setBusy(true); setError("");
    try { await send("/api/crm/work", { action: "changeTask", ...taskChange });
      setTaskChange(null); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Task action denied"); }
    finally { setBusy(false); }
  }
  const tasks = data?.tasks ?? [];
  const open = tasks.filter((item) => item.state === "OPEN").sort((a, b) => {
    const da = a.due_at ? Date.parse(String(a.due_at)) : Number.POSITIVE_INFINITY;
    const db = b.due_at ? Date.parse(String(b.due_at)) : Number.POSITIVE_INFINITY;
    return da - db || String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id));
  });
  const elsewhere = kind === "opportunity" && accountableOwnerId
    ? open.filter((item) => item.assignee_person_id !== accountableOwnerId).length : 0;
  const timeline: (Row & { at: string; category: string })[] = [
    ...commercialHistory.map((item) => ({ ...item, at: String(item.occurred_at), category: "commercial" })),
    ...(data?.activities ?? []).map((item) => ({ ...item, at: String(item.occurred_at), category: "activity" })),
    ...(data?.taskEvents ?? []).map((item) => ({ ...item, at: String(item.occurred_at), category: "task" })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
  return <div className="crm-operational-record">
    {error && <p className="enterprise-error" role="alert">{error} <Button variant="ghost" onClick={() => void load()}>Retry</Button></p>}
    {loading && <p role="status">Loading CRM activity and follow-ups…</p>}
    {!loading && data && <>
      <section className="crm-panel"><h2>Next action</h2>
        {open[0] ? <><strong>{String(open[0].title)}</strong><p>{crmDueStatus(open[0].due_at as string | null)} · {open[0].due_at ? time(open[0].due_at) : "No due date"} · {owners.find((o) => o.id === open[0].assignee_person_id)?.displayName ?? "Assigned Office"}</p>
          {open.length > 1 && <p>{open.length - 1} additional follow-up{open.length === 2 ? "" : "s"}</p>}</> : <p>No follow-up planned</p>}
      </section>
      <section className="crm-panel"><h2>Follow-ups</h2>
        {elsewhere > 0 && <p>{elsewhere} open follow-up{elsewhere === 1 ? " is" : "s are"} assigned to someone other than the Opportunity owner. Reassign selected tasks explicitly if needed.</p>}
        <form className="crm-operational-form" onSubmit={(event) => void createTask(event)}>
          <label className="crm-field">Action title<Input required maxLength={160} value={task.title}
            onChange={(event) => setTask({ ...task, title: event.target.value })} /></label>
          <label className="crm-field">Assign to<select value={task.assigneeId}
            onChange={(event) => setTask({ ...task, assigneeId: event.target.value })}>
            {owners.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
          </select></label>
          <label className="crm-field">Due date and time · London<Input type="datetime-local" value={task.dueLocal}
            onChange={(event) => setTask({ ...task, dueLocal: event.target.value })} /></label>
          <Button disabled={busy || !task.assigneeId}>Create follow-up</Button>
        </form>
        {tasks.length === 0 && <p>No CRM follow-ups recorded.</p>}
        {tasks.map((item) => <div className="crm-task-row" key={String(item.id)}><div><strong>{String(item.title)}</strong>
          <span>{label(item.state)} · {item.state === "OPEN" ? crmDueStatus(item.due_at as string | null) : "Historical"} · {item.due_at ? time(item.due_at) : "No due date"} · {owners.find((o) => o.id === item.assignee_person_id)?.displayName ?? "Assigned Office"}</span></div>
          {item.state === "OPEN" && <div className="crm-task-actions">
            {item.assignee_person_id === currentPersonId && <Button variant="outline" disabled={busy}
              onClick={() => setTaskChange({ id: String(item.id), kind: "COMPLETE", assigneeId: "", dueLocal: "", reason: "" })}>Done</Button>}
            <Button variant="ghost" onClick={() => setTaskChange({ id: String(item.id), kind: "REASSIGN", assigneeId: "", dueLocal: "", reason: "" })}>Reassign</Button>
            <Button variant="ghost" onClick={() => setTaskChange({ id: String(item.id), kind: "RESCHEDULE", assigneeId: "", dueLocal: londonLocal(item.due_at), reason: "" })}>Reschedule</Button>
            <Button variant="ghost" onClick={() => setTaskChange({ id: String(item.id), kind: "CANCEL", assigneeId: "", dueLocal: "", reason: "" })}>Cancel</Button>
          </div>}
        </div>)}
      </section>
      <section className="crm-panel"><h2>{activity.correctsId ? "Record correction" : "Record activity"}</h2><p>Manual Office entry; this does not send a message or prove dispatch. Corrections leave the original entry intact.</p>
        {activity.correctsId && <p>Correcting an earlier activity. <Button variant="ghost" type="button" onClick={() => setActivity({ type: "PHONE_CALL", subject: "", summary: "", contactId: "", correctsId: "" })}>Cancel correction</Button></p>}
        <form className="crm-operational-form" onSubmit={(event) => void createActivity(event)}>
          <label className="crm-field">Type<select value={activity.type} onChange={(event) => setActivity({ ...activity, type: event.target.value })}>
            {["PHONE_CALL", "EMAIL", "MEETING", "NOTE", "TENDER_UPDATE", "PROPOSAL_SENT", "FOLLOW_UP"].map((type) => <option key={type} value={type}>{label(type)}</option>)}
          </select></label>
          <label className="crm-field">Contact, if relevant<select value={activity.contactId} onChange={(event) => setActivity({ ...activity, contactId: event.target.value })}>
            <option value="">No Contact</option>{data.contacts.map((contact) => <option key={String(contact.id)} value={String(contact.id)}>{String(contact.first_name)} {String(contact.last_name)}</option>)}
          </select></label>
          <label className="crm-field">Subject<Input required maxLength={160} value={activity.subject}
            onChange={(event) => setActivity({ ...activity, subject: event.target.value })} /></label>
          <label className="crm-field">Short summary<textarea maxLength={1000} value={activity.summary}
            onChange={(event) => setActivity({ ...activity, summary: event.target.value })} /></label>
          <Button disabled={busy}>Record activity</Button>
        </form>
      </section>
      <section className="crm-panel crm-timeline"><h2>Commercial timeline</h2>
        {timeline.length === 0 && <p>No commercial activity recorded yet.</p>}
        {timeline.map((item) => <div key={`${item.category}-${item.id}`} className="crm-timeline-entry">
          <strong>{item.category === "activity" ? `${label(item.activity_type)} · ${String(item.subject)}` :
            item.category === "task" ? `Follow-up ${label(item.event_kind)}` : `${label(item.kind ?? "Relationship")} changed`}</strong>
          <span>{time(item.at)} · {owners.find((o) => o.id === item.actor_person_id)?.displayName ?? "Office actor"}</span>
          {item.category === "activity" && Boolean(item.summary) && <p>{String(item.summary)}</p>}
          {item.category === "activity" && Boolean(item.corrects_activity_id) && <p>Correction of activity {String(item.corrects_activity_id).slice(0, 8)}. The original remains in history.</p>}
          {item.category === "activity" && <Button variant="ghost" type="button" onClick={() => setActivity({ type: "NOTE", subject: `Correction: ${String(item.subject).slice(0, 140)}`, summary: "", contactId: String(item.contact_id ?? ""), correctsId: String(item.id) })}>Correct with new entry</Button>}
          {item.category === "commercial" && Boolean(item.old_stage) && <p>{label(item.old_stage)} → {label(item.new_stage)}</p>}
          {item.category === "task" && Boolean(item.reason) && <p>Reason: {String(item.reason)}</p>}
        </div>)}
      </section>
    </>}
    {taskChange && <div className="crm-dialog-backdrop"><section className="crm-dialog" role="dialog" aria-modal="true" aria-label={`${label(taskChange.kind)} follow-up`}>
      <h2>{label(taskChange.kind)} follow-up</h2>
      {taskChange.kind === "REASSIGN" && <label className="crm-field">New assignee<select value={taskChange.assigneeId}
        onChange={(event) => setTaskChange({ ...taskChange, assigneeId: event.target.value })}>
        <option value="">Select Office user</option>{owners.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
      </select></label>}
      {taskChange.kind === "RESCHEDULE" && <label className="crm-field">New due date and time · London<Input type="datetime-local"
        value={taskChange.dueLocal} onChange={(event) => setTaskChange({ ...taskChange, dueLocal: event.target.value })} /></label>}
      {taskChange.kind !== "COMPLETE" && <label className="crm-field">Reason<Input maxLength={300} value={taskChange.reason}
        onChange={(event) => setTaskChange({ ...taskChange, reason: event.target.value })} /></label>}
      <div className="crm-dialog-actions"><Button variant="outline" onClick={() => setTaskChange(null)}>Back</Button>
        <Button disabled={busy || (taskChange.kind !== "COMPLETE" && taskChange.reason.trim().length < 3) ||
          (taskChange.kind === "REASSIGN" && !taskChange.assigneeId)} onClick={() => void changeTask()}>
          {busy ? "Saving…" : taskChange.kind === "COMPLETE" ? "Mark Done" : "Confirm"}</Button></div>
    </section></div>}
  </div>;
}
