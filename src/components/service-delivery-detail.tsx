"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { london, serviceRequest } from "./service-delivery-api";
import { ServiceDeliverySourceCards } from "./service-delivery-source-cards";
import { ServiceDeliveryManagement } from "./service-delivery-management";
import styles from "./service-delivery.module.css";

type Owner = { id: string; name: string; office: boolean; super: boolean };
type Period = { id: string; name: string; starts_on: string; ends_on: string; owner_person_id: string; state: string; revision: number };
type Meeting = { id: string; period_id: string; scheduled_at: string; scheduled_local: string; state: string; held_at: string | null; note: string | null; revision: number };
type Action = { id: string; period_id: string | null; title: string; category: string; owner_person_id: string; due_on: string | null; state: string; revision: number };
type Blocker = { id: string; action_id: string; reason: string; owner_person_id: string; resolved_at: string | null; resolution_note: string | null; revision: number };
type Detail = { id: string; clientName: string; siteName: string; serviceName: string; siteId: string; siteServiceId: string; state: string; sourceState: string; startSource: string; mobilisationId: string | null; handoverDecisionId: string | null; legacyReasonCode: string | null; legacyExplanation: string | null; ownerId: string; ownerName: string; ownerEligible: boolean; historicalLinkCurrent: boolean; sourceMembershipIntact: boolean; revision: number; periods: Period[]; meetings: Meeting[]; actions: Action[]; blockers: Blocker[]; openPeriodCount: number; openActionCount: number; openBlockerCount: number; nextMeetingAt: string | null };
type History = { id: string; kind: string; subject_id: string; actor_person_id: string; occurred_at: string; before_value: unknown; after_value: unknown; reason: string | null; service_revision: number };
type Field = { name: string; label: string; type?: string; required?: boolean; min?: number; max?: number; value?: string; options?: { value: string; label: string }[] };
const categories = ["SERVICE_REVIEW","STAFFING_REVIEW","EQUIPMENT_REVIEW","INSTRUCTIONS_REVIEW","CLIENT_FOLLOW_UP","OTHER"];
const actionStates = ["OPEN","IN_PROGRESS","BLOCKED","DONE","CANCELLED"];

function Editor({ title, fields, submit, busy, reason = false, children }: { title: string; fields: Field[]; submit: (data: Record<string,string>) => Promise<void>; busy: boolean; reason?: boolean; children?: React.ReactNode }) {
  return <details className={styles.card}><summary>{title}</summary><form className={styles.form} onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void submit(Object.fromEntries(form.entries()) as Record<string,string>); }}>
    {fields.map(f => <label key={f.name}>{f.label}{f.options ? <select name={f.name} required={f.required} defaultValue={f.value ?? ""}><option value="">Choose</option>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : f.type === "textarea" ? <textarea name={f.name} required={f.required} minLength={f.min} maxLength={f.max} defaultValue={f.value} /> : <input name={f.name} type={f.type ?? "text"} required={f.required} minLength={f.min} maxLength={f.max} defaultValue={f.value} />}</label>)}
    {reason && <label>Reason / explanation<textarea name="reason" required minLength={3} maxLength={500} /></label>}
    {children}<button className={styles.button} disabled={busy}>{busy ? "Saving…" : title}</button>
  </form></details>;
}
function HistoryValues({ label, value }: { label: string; value: unknown }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return <div><strong>{label}</strong><dl className={styles.historyValues}>{Object.entries(value).map(([key,item]) => <div key={key} style={{ display: "contents" }}><dt>{key.replace(/([A-Z])/g," $1").replaceAll("_"," ")}</dt><dd>{item == null ? "—" : String(item)}</dd></div>)}</dl></div>;
}
export function ServiceDeliveryDetail({ id, superAdmin }: { id: string; superAdmin: boolean }) {
  const [d,setD] = useState<Detail | null>(null); const [owners,setOwners] = useState<Owner[]>([]);
  const [history,setHistory] = useState<History[]>([]); const [historyTotal,setHistoryTotal] = useState(0); const [historyOffset,setHistoryOffset] = useState(0);
  const [error,setError] = useState(""); const [busy,setBusy] = useState(false); const requestKey = useRef<string | null>(null);
  const load = useCallback(async () => { try { setD(await serviceRequest(`/api/service-delivery/${id}`)); } catch (e) { setError(e instanceof Error ? e.message : "Detail unavailable"); } },[id]);
  const loadHistory = useCallback(async () => { try { const page = await serviceRequest(`/api/service-delivery/${id}?history=1&offset=${historyOffset}`); setHistory(page.items ?? []); setHistoryTotal(page.total ?? 0); } catch { setError("History unavailable"); } },[id,historyOffset]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); },[load]);
  useEffect(() => { const timer = setTimeout(() => void loadHistory(), 0); return () => clearTimeout(timer); },[loadHistory]);
  useEffect(() => { void serviceRequest("/api/service-delivery?choices=1").then(x => setOwners(x.owners ?? [])).catch(() => {}); },[]);
  async function change(kind: string, subjectId: string | null, data: Record<string,unknown>) {
    if (!d) return; setBusy(true); setError(""); requestKey.current ??= crypto.randomUUID();
    try { await serviceRequest(`/api/service-delivery/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, subjectId, data, expectedRevision: d.revision, requestKey: requestKey.current }) });
      requestKey.current = null; await load(); await loadHistory();
    } catch (e) { setError(e instanceof Error ? e.message : "Change denied"); }
    finally { setBusy(false); }
  }
  const ownerOptions = owners.filter(o => o.office || (superAdmin && o.super)).map(o => ({ value: o.id, label: `${o.name}${!o.office ? " · Super oversight" : ""}` }));
  if (!d) return <main className={`enterprise-main ${styles.page}`}><p role="status">Loading Service Delivery…</p>{error && <p role="alert" className={styles.error}>{error}</p>}</main>;
  const terminal = d.state === "CLOSED" || d.state === "CANCELLED";
  return <main className={`enterprise-main ${styles.page}`}>
    <p className="eyebrow">Office · synthetic Dev</p><p><Link href="/service-delivery">← Service Delivery list</Link></p>
    <h1>{d.clientName} → {d.siteName} → {d.serviceName}</h1>
    <div className={styles.flags}><span className={styles.flag}>{d.state}</span><span className={styles.flag}>Owner: {d.ownerName}</span><span className={styles.flag}>Source: {d.startSource === "MOBILISATION_HANDOVER" ? "Mobilisation" : "Legacy"}</span></div>
    <p>Next scheduled meeting: {london(d.nextMeetingAt)}</p>
    <p>Open: {d.openPeriodCount} review periods · {d.openActionCount} actions · {d.openBlockerCount} blockers</p>
    {!d.ownerEligible && <p role="status" className={styles.error}>Owner reassignment required. Historical owner remains recorded.</p>}
    {!d.historicalLinkCurrent && <p role="status">Historical Client/Site link is no longer current. This record remains attached to the original link.</p>}
    {!d.sourceMembershipIntact && <p role="alert" className={styles.error}>Exact historical source membership needs review. Changes are blocked.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <nav className={styles.links} aria-label="Service Delivery sections"><a href="#review-periods">Review periods</a><a href="#source-facts">Source facts</a><a href="#meetings">Meetings</a><a href="#actions">Actions &amp; blockers</a><a href="#commitments">Commitments</a><a href="#changes">Changes</a><a href="#history">History</a></nav>
    <section className={styles.card}><h2>Source and accountability</h2><p>Site Service: <Link href={`/sites/${d.siteId}/services/${d.siteServiceId}`}>{d.serviceName}</Link> · current source state {d.sourceState}</p>
      {d.mobilisationId ? <p>Exact handover: <Link href={`/mobilisations/${d.mobilisationId}`}>Mobilisation {d.mobilisationId}</Link> · decision {d.handoverDecisionId}</p> : <p>Legacy existing Service · {d.legacyReasonCode}: {d.legacyExplanation}</p>}
      <p className={styles.muted}>Administrative state does not change the Site Service or establish readiness.</p>
    </section>
    {!terminal && <div className={styles.grid}>
      <Editor title="Reassign owner" busy={busy} reason fields={[{ name: "ownerId", label: "Replacement owner", required: true, options: ownerOptions }]} submit={x => change("OWNER",null,{ ...x, superOversight: superAdmin && !owners.find(o => o.id === x.ownerId)?.office })} />
      <Editor title="Move administrative state" busy={busy} reason fields={[{ name: "state", label: "Next state", required: true, options: (d.state === "PROPOSED" ? ["ACTIVE","CANCELLED"] : d.state === "ACTIVE" ? ["CLOSING"] : ["CLOSED"]).map(v => ({ value: v, label: v })) }]} submit={x => change("STATE",null,x)}><p>Outstanding now: {d.openPeriodCount} periods, {d.openActionCount} actions, {d.openBlockerCount} blockers. Explain any outstanding work when closing.</p></Editor>
    </div>}
    <section id="review-periods"><h2>Review periods</h2><p>Custom Europe/London dates. Periods never close automatically.</p>
      {!terminal && <Editor title="Create review period" busy={busy} fields={[{name:"name",label:"Period name",required:true,min:3,max:120},{name:"startsOn",label:"Starts on",type:"date",required:true},{name:"endsOn",label:"Ends on",type:"date",required:true},{name:"ownerId",label:"Owner",required:true,options:ownerOptions}]} submit={x => change("PERIOD_CREATED",null,x)} />}
      <div className={styles.grid}>{d.periods.map(p => <article key={p.id} className={styles.card}><h3>{p.name}</h3><p>{p.starts_on} to {p.ends_on} · {p.state}</p>
        {p.state === "OPEN" && !terminal && <><Editor title="Correct dates" busy={busy} reason fields={[{name:"startsOn",label:"Starts on",type:"date",required:true,value:p.starts_on},{name:"endsOn",label:"Ends on",type:"date",required:true,value:p.ends_on}]} submit={x => change("PERIOD_DATES",p.id,{...x,subjectRevision:p.revision})} />
          <Editor title="Close review period" busy={busy} reason fields={[]} submit={x => change("PERIOD_CLOSED",p.id,x)}><p>Outstanding meetings, actions and blockers remain visible after closure.</p></Editor></>}
      </article>)}</div>
    </section>
    <ServiceDeliverySourceCards deliveryId={d.id} periods={d.periods} />
    <section id="meetings"><h2>Meetings</h2><p>A scheduled meeting is not a held meeting. Held records occurrence only.</p>
      {!terminal && <Editor title="Schedule meeting" busy={busy} fields={[{name:"periodId",label:"Open review period",required:true,options:d.periods.filter(p => p.state==="OPEN").map(p => ({value:p.id,label:p.name}))},{name:"scheduledLocal",label:"London date and time",type:"datetime-local",required:true}]} submit={x => change("MEETING_CREATED",null,x)} />}
      <div className={styles.grid}>{d.meetings.map(m => <article key={m.id} className={styles.card}><h3>{m.state === "HELD" ? "Held" : m.state === "CANCELLED" ? "Cancelled" : "Scheduled"} · {london(m.scheduled_at)}</h3><p>Review: {d.periods.find(p => p.id===m.period_id)?.name}</p>{m.held_at && <p>Actually held: {london(m.held_at)}</p>}{m.note && <p>{m.note}</p>}
        {m.state==="SCHEDULED" && d.periods.find(p => p.id===m.period_id)?.state==="OPEN" && !terminal && <><Editor title="Reschedule" busy={busy} reason fields={[{name:"scheduledLocal",label:"New London time",type:"datetime-local",required:true}]} submit={x => change("MEETING_RESCHEDULED",m.id,{...x,subjectRevision:m.revision})} />
          <Editor title="Record held meeting" busy={busy} reason fields={[{name:"heldLocal",label:"Actual London time",type:"datetime-local",required:true},{name:"note",label:"Factual management note",type:"textarea",min:3,max:1000}]} submit={x => change("MEETING_HELD",m.id,{...x,subjectRevision:m.revision})} />
          <Editor title="Cancel meeting" busy={busy} reason fields={[]} submit={x => change("MEETING_CANCELLED",m.id,{...x,subjectRevision:m.revision})} /></>}
      </article>)}</div>
    </section>
    <section id="actions"><h2>Actions &amp; blockers</h2>
      {!terminal && <Editor title="Create action" busy={busy} fields={[{name:"title",label:"Action",required:true,min:3,max:180},{name:"category",label:"Category",required:true,options:categories.map(c => ({value:c,label:c.replaceAll("_"," ")}))},{name:"periodId",label:"Review period (optional)",options:d.periods.map(p => ({value:p.id,label:p.name}))},{name:"ownerId",label:"Owner",required:true,options:ownerOptions},{name:"dueOn",label:"Due date",type:"date"}]} submit={x => change("ACTION_CREATED",null,{...x,periodId:x.periodId||null,dueOn:x.dueOn||null})} />}
      <div className={styles.grid}>{d.actions.map(a => <article key={a.id} className={styles.card}><h3>{a.title}</h3><p>{a.category.replaceAll("_"," ")} · {a.state} · due {a.due_on || "not set"}</p><p>Review: {d.periods.find(p => p.id===a.period_id)?.name || "Overall Service Delivery"}</p>
        {d.blockers.filter(b => b.action_id===a.id).map(b => <div key={b.id} className={styles.card}><strong>{b.resolved_at ? "Resolved blocker" : "Open blocker"}</strong><p>{b.reason}</p>{b.resolution_note && <p>Resolution: {b.resolution_note}</p>}
          {!terminal && (!b.resolved_at ? <Editor title="Resolve blocker" busy={busy} reason fields={[]} submit={x => change("BLOCKER_RESOLVED",b.id,{...x,subjectRevision:b.revision})} /> : a.state!=="DONE" && a.state!=="CANCELLED" && <Editor title="Reopen blocker" busy={busy} reason fields={[]} submit={x => change("BLOCKER_REOPENED",b.id,{...x,subjectRevision:b.revision})} />)}
        </div>)}
        {!terminal && a.state!=="CANCELLED" && <><Editor title="Change action" busy={busy} reason fields={[{name:"title",label:"Title",required:true,min:3,max:180,value:a.title},{name:"category",label:"Category",required:true,value:a.category,options:categories.map(c => ({value:c,label:c.replaceAll("_"," ")}))},{name:"ownerId",label:"Owner",required:true,value:a.owner_person_id,options:ownerOptions},{name:"dueOn",label:"Due date",type:"date",value:a.due_on??""}]} submit={x => change("ACTION_CHANGED",a.id,{...x,dueOn:x.dueOn||null,subjectRevision:a.revision})} />
          <Editor title="Change action state" busy={busy} reason fields={[{name:"state",label:"State",required:true,options:(a.state==="DONE"?["OPEN"]:actionStates).map(v => ({value:v,label:v}))}]} submit={x => change("ACTION_STATE",a.id,{...x,subjectRevision:a.revision})} />
          {a.state!=="DONE" && <Editor title="Open blocker" busy={busy} fields={[{name:"blockerReason",label:"Blocker",required:true,min:3,max:500},{name:"ownerId",label:"Owner",required:true,options:ownerOptions}]} submit={x => change("BLOCKER_OPENED",null,{...x,actionId:a.id})} />}</>}
      </article>)}</div>
    </section>
    <ServiceDeliveryManagement deliveryId={d.id} deliveryRevision={d.revision} terminal={terminal} />
    <section id="history"><h2>History <small>{historyTotal}</small></h2><p>From the first event, 25 at a time.</p>
      {history.map(h => <article className={styles.card} key={h.id}><strong>{h.kind.replaceAll("_"," ")}</strong><p className={styles.meta}>{london(h.occurred_at)} · revision {h.service_revision} · actor {h.actor_person_id}</p>{h.reason && <p>Reason: {h.reason}</p>}
        <HistoryValues label="Before" value={h.before_value} /><HistoryValues label="After" value={h.after_value} /></article>)}
      <div className={styles.inline}><button className={`${styles.button} ${styles.secondary}`} disabled={historyOffset===0} onClick={() => setHistoryOffset(Math.max(0,historyOffset-25))}>Previous history</button><button className={`${styles.button} ${styles.secondary}`} disabled={historyOffset+25>=historyTotal} onClick={() => setHistoryOffset(historyOffset+25)}>Next history</button></div>
    </section>
  </main>;
}
