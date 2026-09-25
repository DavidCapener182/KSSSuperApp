"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StaffingPlanClient } from "@/components/staffing-plan-client";
import journey from "./commercial-journey.module.css";
import record from "./event-record.module.css";
import { RecordSectionTracker } from "./record-section-tracker";

type Row = Record<string, unknown>;
type Choice = { id: string; name: string };
const types = ["FOOTBALL_MATCH","FESTIVAL","CONCERT","PARADE","CONFERENCE","CORPORATE_EVENT","OTHER"];
const statusOptions = ["PLANNING","CONFIRMED","LIVE","COMPLETED","CANCELLED"];
const label = (value: unknown) => String(value ?? "").replaceAll("_"," ").toLowerCase().replace(/(^|\s)\S/g,(s)=>s.toUpperCase());
const london = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}) : "—";
const localInput = (value: unknown) => {
  if (!value) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"})
    .formatToParts(new Date(String(value))).map((part)=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
async function read(path: string, init?: RequestInit) {
  const response = await fetch(path,{...init,cache:"no-store"}); const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error ?? "Operational request denied"); return data;
}

export function EventsClient({ roles, id, organisation, opportunity, mobilisation, focusRequirement }: { roles: string[]; id?: string; organisation?: string; opportunity?: string; mobilisation?: string; focusRequirement?: string }) {
  const router = useRouter(); const office = roles.includes("OFFICE_ADMIN") || roles.includes("SUPER_ADMIN");
  const [items,setItems] = useState<Row[]>([]); const [total,setTotal] = useState(0); const [event,setEvent] = useState<Row|null>(null);
  const [clients,setClients] = useState<Choice[]>([]); const [sites,setSites] = useState<Row[]>([]); const [owners,setOwners] = useState<Choice[]>([]);
  const [contacts,setContacts] = useState<Choice[]>([]);
  const [filters,setFilters] = useState({search:"",organisation:organisation ?? "",site:"",status:"UPCOMING",type:"",owner:"",fromDate:"",untilDate:""});
  const [applied,setApplied] = useState(filters); const [offset,setOffset] = useState(0);
  const [draft,setDraft] = useState({name:"",organisationId:organisation ?? "",siteId:"",type:"FESTIVAL",startLocal:"",endLocal:"",ownerId:"",contactId:"",opportunityId:opportunity ?? ""});
  const [action,setAction] = useState({kind:"",status:"",ownerId:"",startLocal:"",endLocal:"",reason:""});
  const [creating,setCreating] = useState(false); const [loading,setLoading] = useState(true); const [busy,setBusy] = useState(false);
  const [showMobileFilters,setShowMobileFilters] = useState(false);
  const [error,setError] = useState(""); const [notice,setNotice] = useState("");
  const dialogRef = useRef<HTMLElement | null>(null); const returnFocus = useRef<HTMLElement | null>(null);
  const emptyAction = {kind:"",status:"",ownerId:"",startLocal:"",endLocal:"",reason:""};
  const closeDialog = () => { setCreating(false); setAction(emptyAction); returnFocus.current?.focus(); };
  const openCreate = () => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setCreating(true); };
  const openChange = (next: typeof action) => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setAction(next); };
  useEffect(() => {
    if (!creating && !action.kind) return;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("input, select, button")?.focus();
    const onKey = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape" && !busy) { closeDialog(); return; }
      if (keyboardEvent.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")];
      if (!controls.length) return;
      if (keyboardEvent.shiftKey && document.activeElement === controls[0]) { keyboardEvent.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!keyboardEvent.shiftKey && document.activeElement === controls[controls.length - 1]) { keyboardEvent.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // Dialog focus follows only open/close and busy state; field edits retain their current focus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating, action.kind, busy]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (id) { const result = await read(`/api/events/${id}`); setEvent(result.event); }
      else { const params=new URLSearchParams({offset:String(offset)});
        Object.entries(applied).forEach(([key,value])=>{if(value)params.set(key,value);});
        const result=await read(`/api/events?${params}`);setItems(result.items ?? []);setTotal(result.total ?? 0); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Events unavailable"); }
    finally { setLoading(false); }
  },[id,offset,applied]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
  useEffect(()=>{void read("/api/events/choices").then((result)=>{setClients(result.clients ?? []);setOwners(result.owners ?? []);setSites(result.sites ?? []);}).catch(()=>{});},[]);
  useEffect(()=>{
    if (!draft.organisationId || !office) return;
    void Promise.all([read(`/api/operational-sites?organisation=${draft.organisationId}`),read(`/api/events/contacts?organisation=${draft.organisationId}`)])
      .then(([siteResult,contactResult])=>{setSites(siteResult.items ?? []);setContacts(contactResult.contacts ?? []);}).catch(()=>{setSites([]);setContacts([]);});
  },[draft.organisationId,office]);
  async function create(eventForm: React.FormEvent) {
    eventForm.preventDefault();setBusy(true);setError("");
    try {const result=await read("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)});
      const confirmed=await read(`/api/events/${result.id}`);
      if(confirmed.event?.id!==result.id)throw new Error("Event creation could not be confirmed from the record. Refresh before retrying.");
      setCreating(false);router.push(`/events/${result.id}${mobilisation ? `?mobilisation=${mobilisation}` : ""}`);}
    catch(caught){setError(caught instanceof Error?caught.message:"Event could not be created");}
    finally{setBusy(false);}
  }
  async function change() {
    if (!id || !action.kind) return;setBusy(true);setError("");
    try {const previous=event;await read(`/api/events/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:action.kind,
      status:action.status,ownerId:action.ownerId,startLocal:action.startLocal,endLocal:action.endLocal,reason:action.reason})});
      const confirmed=await read(`/api/events/${id}`);setEvent(confirmed.event);
      const changed=confirmed.event?.id===id && (action.kind==="STATUS" ? confirmed.event.status===action.status :
        action.kind==="OWNER" ? confirmed.event.owner_person_id===action.ownerId :
        previous && (confirmed.event.starts_at!==previous.starts_at || confirmed.event.ends_at!==previous.ends_at));
      if(!changed)throw new Error("The server responded, but the updated Event could not be confirmed. Refresh before another change.");
      closeDialog();setNotice("Event change confirmed from the Event record.");}
    catch(caught){setError(caught instanceof Error?caught.message:"Event change denied");}
    finally{setBusy(false);}
  }
  const nextStatus = event?.status === "PLANNING" ? "CONFIRMED" : event?.status === "CONFIRMED" ? "LIVE" : event?.status === "LIVE" ? "COMPLETED" : "";
  return <main className={`enterprise-main events-page ${journey.controls}`}>
    <p className="eyebrow">Operations · synthetic development data</p>
    {!id && <><div className="crm-heading"><div><h1>Events</h1>
      <p className="enterprise-intro">Client, venue, overall Event times, staffing demand and current allocations. Attendance and worked hours are not recorded here.</p></div>
      {office && <Button onClick={openCreate}>Create Event</Button>}</div>
    <nav className="crm-tabs" aria-label="Operational sections"><Link href="/events" aria-current="page">Events</Link><Link href="/sites">Sites / Venues</Link></nav></>}
    {!id && office && <nav className={journey.path} aria-label="Commercial to Event journey">
      <span><small>01 · Client</small><Link href="/crm?view=organisations">Confirm Client</Link></span>
      <span><small>02 · Site / Venue</small><Link href="/sites">Choose linked Site</Link></span>
      <span><small>03 · Event</small><strong aria-current="step">Plan exact Event</strong></span>
      <span><small>04 · Staffing</small><Link href="/workforce">Review separate demand</Link></span>
    </nav>}
    {error && <p className="enterprise-error" role="alert">{error} <Button variant="ghost" onClick={()=>void load()}>Retry</Button></p>}
    {notice && <p role="status" className="enterprise-honesty">{notice}</p>}
    {loading && <p role="status" className="crm-skeleton">Loading authorised Events…</p>}
    {!loading && !id && <>
      <form className={`events-filters${showMobileFilters ? " is-expanded" : ""}`} onSubmit={(e)=>{e.preventDefault();setOffset(0);setApplied({...filters});setShowMobileFilters(false);}}>
        <label>Search<Input value={filters.search} maxLength={80} onChange={(e)=>setFilters({...filters,search:e.target.value})}/></label>
        <Button className="events-mobile-filter-toggle" type="button" variant="outline" aria-expanded={showMobileFilters} onClick={()=>setShowMobileFilters(!showMobileFilters)}>{showMobileFilters ? "Hide filters" : "More filters"}</Button>
        <label>Client<select value={filters.organisation} onChange={(e)=>setFilters({...filters,organisation:e.target.value})}><option value="">All Clients</option>{clients.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Site<select value={filters.site} onChange={(e)=>setFilters({...filters,site:e.target.value})}><option value="">All Sites</option>{sites.map((s)=><option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}</select></label>
        <label>Status<select value={filters.status} onChange={(e)=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option>{statusOptions.map((s)=><option key={s} value={s}>{label(s)}</option>)}</select></label>
        <label>Type<select value={filters.type} onChange={(e)=>setFilters({...filters,type:e.target.value})}><option value="">All types</option>{types.map((s)=><option key={s} value={s}>{label(s)}</option>)}</select></label>
        <label>Owner<select value={filters.owner} onChange={(e)=>setFilters({...filters,owner:e.target.value})}><option value="">All owners</option>{owners.map((o)=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label>From<Input type="date" value={filters.fromDate} onChange={(e)=>setFilters({...filters,fromDate:e.target.value})}/></label>
        <label>Until<Input type="date" value={filters.untilDate} onChange={(e)=>setFilters({...filters,untilDate:e.target.value})}/></label>
        <Button>Apply filters</Button></form>
      <div className="crm-view-switch events-view-switch">{[["UPCOMING","Upcoming"],["PLANNING","Planning"],["LIVE","Live"],["COMPLETED","Completed"],["CANCELLED","Cancelled"],["","All"]].map(([value,text])=><Button type="button" key={value} variant={applied.status===value?"default":"outline"}
        onClick={()=>{setOffset(0);setFilters({...filters,status:value});setApplied({...filters,status:value});}}>{text}</Button>)}</div>
      <p className="enterprise-honesty">{total} authorised Event{total===1?"":"s"}. Status is recorded by Office or Operations, not inferred from the clock.</p>
      {items.length===0?<p className="crm-empty">No Events match these filters.</p>:<div className="crm-list events-list">
        {items.map((row)=><Link className="crm-row" key={String(row.id)} href={`/events/${row.id}${mobilisation ? `?mobilisation=${mobilisation}` : ""}`}>
          <strong>{String(row.name)}</strong><span>{String(row.client_name)} · {String(row.site_name)} · {label(row.event_type)}</span>
          <span>{london(row.starts_at)} → {london(row.ends_at)} · {label(row.status)}</span></Link>)}</div>}
      <div className="people-pagination"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous</Button>
        <span>{items.length?offset+1:0}–{offset+items.length} of {total}</span><Button variant="outline" disabled={offset+25>=total} onClick={()=>setOffset(offset+25)}>Next</Button></div>
    </>}
    {!loading && id && event && <div className={record.record}>
      {mobilisation && office && <p role="status" className="enterprise-honesty">This Event is an independent source record. <Link href={`/mobilisations/${mobilisation}?sourceType=EVENT&sourceId=${id}#links-heading`}>Return to Mobilisation with exact Event ID</Link>; review and link it explicitly there.</p>}
      <header className={record.recordHeader} aria-label="Event record">
        <h1>{String(event.name)}</h1>
        <div className={record.identity}><span className={record.kind}>Event</span><span className="crm-state">{label(event.status)}</span><span>{label(event.event_type)}</span></div>
        <div className={record.headerFacts}><span><small>Client</small><strong>{String(event.client_name)}</strong></span><span><small>Site / Venue</small><strong>{String(event.site_name)}</strong></span><span><small>Event window · Europe/London</small><strong>{london(event.starts_at)} → {london(event.ends_at)}</strong></span></div>
      </header>
      {(event.site_status!=="ACTIVE" || event.client_status!=="CLIENT") && <p role="status" className="enterprise-honesty">Operational context changed: Site is {label(event.site_status)}; Client relationship is {label(event.client_status)}. Historical Event state is retained.</p>}
      <nav className={record.sectionNav} aria-label="Event sections">{[["event-context","Context"],["event-staffing","Staffing"],["event-attendance","Attendance"],["event-history","History"]].map(([section,name])=><a key={section} href={`#${section}`}>{name}</a>)}</nav>
      <RecordSectionTracker label="Event sections" />
      <div className={record.content}>
      <nav className={record.related} aria-label="Related Event workflows"><h2>Related workflows</h2><div><Link href={`/events/${id}/attendance`}>Event attendance <span aria-hidden="true">→</span></Link><Link href={`/events/${id}/work-time`}>Worked-time review <span aria-hidden="true">→</span></Link><Link href={`/operational-contacts/manage?kind=EVENT&id=${id}`}>Operational contacts <span aria-hidden="true">→</span></Link></div></nav>
      <div className="crm-detail-grid"><section id="event-context" className="crm-panel"><h2>Event context</h2><dl>
        <div><dt>Client</dt><dd>{office?<Link href={`/crm/organisations/${event.organisation_id}`}>{String(event.client_name)}</Link>:String(event.client_name)}</dd></div>
        <div><dt>Site / Venue</dt><dd><Link href={`/sites?view=operational&selected=${event.site_id}`}>{String(event.site_name)}</Link> · {String(event.site_reference)}</dd></div>
        <div><dt>Address</dt><dd>{String(event.site_address_line1)}, {String(event.site_town_city)} {String(event.site_postcode)}</dd></div>
        <div><dt>Reporting point</dt><dd>{String(event.site_reporting_point)}</dd></div>
        <div><dt>Client Contact</dt><dd>{String(event.contact_name ?? "Not selected")}{event.contact_job_title?` · ${event.contact_job_title}`:""}</dd></div>
        <div><dt>Operational owner</dt><dd>{String(event.owner_name)}</dd></div>
        {office && Boolean(event.source_opportunity_id) && <div><dt>Won Opportunity source</dt><dd><Link href={`/crm/opportunities/${event.source_opportunity_id}`}>View commercial source</Link></dd></div>}
      </dl></section><section className="crm-panel"><h2>Operational actions</h2>
        {nextStatus && <div className={record.actions}>
          <Button onClick={()=>openChange({...action,kind:"STATUS",status:nextStatus})}>Move to {label(nextStatus)}</Button>
          <Button variant="outline" onClick={()=>openChange({...action,kind:"OWNER",ownerId:"",reason:""})}>Change owner</Button>
          <Button variant="outline" onClick={()=>openChange({...action,kind:"DATES",startLocal:localInput(event.starts_at),endLocal:localInput(event.ends_at),reason:""})}>Change Event dates</Button>
          <Button variant="outline" className={record.destructive} onClick={()=>openChange({...action,kind:"STATUS",status:"CANCELLED"})}>Cancel Event</Button>
        </div>}
        {!nextStatus && <p>Terminal Event history is read-only.</p>}
      </section></div>
      <div id="event-staffing"><StaffingPlanClient eventId={id} eventStatus={String(event.status)} eventStarts={String(event.starts_at)} eventEnds={String(event.ends_at)} focusRequirement={focusRequirement}/></div>
      <section id="event-attendance" className="crm-panel"><h2>Attendance</h2><p>Record and review factual attendance against this Event’s allocations. Attendance does not calculate worked time.</p><Button asChild><Link href={`/events/${id}/attendance`}>Open Event attendance</Link></Button></section>
      <section id="event-history" className="crm-panel"><h2>History</h2>{((event.history as Row[])??[]).map((row)=><div className="crm-timeline-entry" key={String(row.id)}>
        <strong>{label(row.kind)} {row.new_status?`· ${label(row.new_status)}`:""}</strong><span>{london(row.occurred_at)} · {String(row.actor_name ?? "Office / Operations")}</span>
        {Boolean(row.reason) && <p>Reason: {String(row.reason)}</p>}</div>)}</section>
      </div>
    </div>}
    {creating && <div className="crm-dialog-backdrop"><section ref={dialogRef} className="crm-dialog" role="dialog" aria-modal="true" aria-label="Create Event">
      <h2>Create operational Event</h2><p>One multi-day Event can span several dates. Staffing times come later.</p>{error && <p role="alert" className="enterprise-error">{error}</p>}
      <form className="crm-operational-form" onSubmit={(e)=>void create(e)}>
        <label className="crm-field">Client<select required value={draft.organisationId} onChange={(e)=>setDraft({...draft,organisationId:e.target.value,siteId:"",contactId:"",opportunityId:""})}><option value="">Choose Client</option>{clients.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="crm-field">Active linked Site<select required value={draft.siteId} onChange={(e)=>setDraft({...draft,siteId:e.target.value})}><option value="">Choose Site</option>{sites.filter((s)=>s.organisation_id===draft.organisationId&&s.status==="ACTIVE").map((s)=><option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}</select></label>
        <label className="crm-field">Name<Input required maxLength={180} value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})}/></label>
        <label className="crm-field">Type<select value={draft.type} onChange={(e)=>setDraft({...draft,type:e.target.value})}>{types.map((t)=><option key={t} value={t}>{label(t)}</option>)}</select></label>
        <label className="crm-field">Starts · London<Input required type="datetime-local" value={draft.startLocal} onChange={(e)=>setDraft({...draft,startLocal:e.target.value})}/></label>
        <label className="crm-field">Ends · London<Input required type="datetime-local" value={draft.endLocal} onChange={(e)=>setDraft({...draft,endLocal:e.target.value})}/></label>
        <label className="crm-field">Operational owner<select required value={draft.ownerId} onChange={(e)=>setDraft({...draft,ownerId:e.target.value})}><option value="">Choose owner</option>{owners.map((o)=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="crm-field">Primary Client Contact<select value={draft.contactId} onChange={(e)=>setDraft({...draft,contactId:e.target.value})}><option value="">None</option>{contacts.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {draft.opportunityId && <p>Exact Won Opportunity selected as provenance. The server checks it before creating the Event.</p>}
        <div className="crm-dialog-actions"><Button type="button" variant="outline" onClick={closeDialog}>Close</Button><Button disabled={busy}>Create Event</Button></div>
      </form></section></div>}
    {action.kind && <div className="crm-dialog-backdrop"><section ref={dialogRef} className="crm-dialog" role="dialog" aria-modal="true" aria-label="Change Event">
      <h2>{action.kind==="STATUS"?`Move to ${label(action.status)}`:action.kind==="OWNER"?"Change operational owner":"Change Event dates"}</h2>{error && <p role="alert" className="enterprise-error">{error}</p>}
      {action.kind==="OWNER" && <label className="crm-field">New owner<select value={action.ownerId} onChange={(e)=>setAction({...action,ownerId:e.target.value})}><option value="">Choose owner</option>{owners.map((o)=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
      {action.kind==="DATES" && <><label className="crm-field">Starts · London<Input type="datetime-local" value={action.startLocal} onChange={(e)=>setAction({...action,startLocal:e.target.value})}/></label>
        <label className="crm-field">Ends · London<Input type="datetime-local" value={action.endLocal} onChange={(e)=>setAction({...action,endLocal:e.target.value})}/></label></>}
      {(action.kind!=="STATUS" || action.status==="CANCELLED") && <label className="crm-field">Reason<Input maxLength={500} value={action.reason} onChange={(e)=>setAction({...action,reason:e.target.value})}/></label>}
      <div className="crm-dialog-actions"><Button variant="outline" onClick={closeDialog}>Back</Button>
        <Button disabled={busy || (action.kind==="OWNER"&&!action.ownerId) || ((action.kind==="OWNER"||action.status==="CANCELLED"||(action.kind==="DATES"&&event?.status!=="PLANNING"))&&action.reason.trim().length<3)} onClick={()=>void change()}>Confirm change</Button></div>
    </section></div>}
  </main>;
}
