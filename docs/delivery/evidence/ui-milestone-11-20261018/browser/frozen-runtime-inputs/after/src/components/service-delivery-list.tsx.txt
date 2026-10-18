"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { london, serviceRequest } from "./service-delivery-api";
import styles from "./service-delivery.module.css";
import work from "./service-delivery-workspace.module.css";
import { servicePortfolioReturn, serviceDeliveryRecordHref, type ServicePortfolioContext } from "./service-delivery-return-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";

type Service = { id: string; name: string; siteName: string; clientName: string; linkId: string; state: string; handoverChoices: { mobilisationId: string; decisionId: string; title: string }[] };
type Owner = { id: string; name: string; office: boolean; super: boolean };
type Row = { id: string; client_name: string; site_name: string; service_name: string; state: string; owner_name: string; owner_eligible: boolean; next_review_on: string | null; review_due_count: number; open_action_count: number; overdue_action_count: number; open_blocker_count: number; next_meeting_at: string | null; changes_awaiting_count: number; source_drift_count: number };
type Filters = { client: string; site: string; service: string; owner: string; state: string; from: string; to: string };
const emptyFilters: Filters = { client: "", site: "", service: "", owner: "", state: "", from: "", to: "" };
const views = [
  { id: "all", label: "All services" }, { id: "mine", label: "My services" },
  { id: "reviews_due", label: "Reviews due" }, { id: "actions_overdue", label: "Actions overdue" },
  { id: "meetings_upcoming", label: "Meetings upcoming" }, { id: "changes_awaiting", label: "Changes awaiting application" },
];
const dateMeaning: Record<string,string> = { all: "next review, then next meeting, then created date", mine: "next review, then next meeting, then created date", reviews_due: "next review end date", actions_overdue: "earliest overdue action date", meetings_upcoming: "next scheduled meeting date", changes_awaiting: "earliest requested effective date" };
type ListProps = { superAdmin: boolean; mobilisationId?: string; initialContext?: ServicePortfolioContext };
export function ServiceDeliveryList(props: ListProps) { return <ServiceDeliveryPortfolio key={`${props.superAdmin}:${props.mobilisationId ?? ""}:${JSON.stringify(props.initialContext ?? null)}`} {...props} />; }
function ServiceDeliveryPortfolio({ superAdmin, mobilisationId, initialContext }: ListProps) {
  const lifetime = useRef({ active: true, sequence: 0, writing: false });
  useEffect(() => { const token = lifetime.current; token.active = true; return () => { token.active = false; token.sequence++; }; }, []);
  const router = useRouter(); const requestKey = useRef(crypto.randomUUID());
  const [rows,setRows] = useState<Row[]>([]); const [total,setTotal] = useState(0); const [offset,setOffset] = useState(initialContext?.offset ?? 0);
  const [portfolioOwners,setPortfolioOwners] = useState<{ id: string; name: string }[]>([]);
  const [view,setView] = useState(initialContext?.view ?? "all"); const [draftFilters,setDraftFilters] = useState<Filters>(initialContext?.filters ?? emptyFilters); const [filters,setFilters] = useState<Filters>(initialContext?.filters ?? emptyFilters);
  const [asOf,setAsOf] = useState<string | null>(null); const [loading,setLoading] = useState(true); const [portfolioError,setPortfolioError] = useState("");
  const [services,setServices] = useState<Service[]>([]); const [owners,setOwners] = useState<Owner[]>([]);
  const [serviceId,setServiceId] = useState(""); const [source,setSource] = useState("MOBILISATION_HANDOVER");
  const [handover,setHandover] = useState(""); const [ownerId,setOwnerId] = useState(""); const [superOversight,setSuperOversight] = useState(false);
  const [explanation,setExplanation] = useState(""); const [error,setError] = useState(""); const [busy,setBusy] = useState(false);
  const [showStart,setShowStart] = useState(Boolean(mobilisationId));
  useEffect(() => {
    const path = servicePortfolioReturn({ view, offset, filters });
    window.history.replaceState(null, "", mobilisationId ? `${path}${path.includes("?") ? "&" : "?"}mobilisation=${encodeURIComponent(mobilisationId)}` : path);
  }, [view, offset, filters, mobilisationId]);
  const load = useCallback(async () => {
    const token = lifetime.current, sequence = ++token.sequence;
    const current = () => token.active && token.sequence === sequence;
    if (!current()) return;
    setLoading(true); setPortfolioError("");
    const params = new URLSearchParams({ view, offset: String(offset) });
    for (const [key,value] of Object.entries(filters)) if (value) params.set(key,value);
    try { const data = await serviceRequest(`/api/service-delivery/portfolio?${params}`); if (!current()) return; setRows(data.items ?? []); setTotal(data.total ?? 0); setAsOf(data.asOf ?? null); setPortfolioOwners(data.owners ?? []); }
    catch (e) { if (current()) { setRows([]); setTotal(0); setAsOf(null); setPortfolioError(e instanceof Error ? e.message : "Portfolio unavailable"); } }
    finally { if (current()) setLoading(false); }
  },[offset,view,filters]);
  useEffect(() => { const token = lifetime.current; const timer = setTimeout(() => void load(), 0); return () => { clearTimeout(timer); token.sequence++; }; },[load]);
  useEffect(() => { let active = true; void serviceRequest("/api/service-delivery?choices=1").then(data => { if (active) { setServices(data.services ?? []); setOwners(data.owners ?? []); } }).catch(() => { if (active) setError("Start choices unavailable"); }); return () => { active = false; }; },[]);
  const selected = services.find(x => x.id === serviceId);
  const hasFilters = Object.values(filters).some(Boolean);
  const matchingServices = mobilisationId ? services.filter(service => service.handoverChoices.some(choice => choice.mobilisationId === mobilisationId)) : services;
  async function start(e: React.FormEvent) {
    e.preventDefault(); const token = lifetime.current;
    if (!selected || busy || token.writing || !token.active) return;
    token.writing = true;
    setBusy(true); setError("");
    const chosen = selected.handoverChoices.find(x => `${x.mobilisationId}:${x.decisionId}` === handover);
    try {
      if (mobilisationId && (source !== "MOBILISATION_HANDOVER" || chosen?.mobilisationId !== mobilisationId))
        throw new Error("Choose an exact handover decision from this Mobilisation before starting Service Delivery.");
      const data = await serviceRequest("/api/service-delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        serviceId, linkId: selected.linkId, source, mobilisationId: source === "MOBILISATION_HANDOVER" ? chosen?.mobilisationId : null,
        decisionId: source === "MOBILISATION_HANDOVER" ? chosen?.decisionId : null, ownerId,
        superOversight, reasonCode: source === "LEGACY_EXISTING" ? "LEGACY_EXISTING_SERVICE" : null,
        explanation: source === "LEGACY_EXISTING" ? explanation : null, requestKey: requestKey.current,
      }) });
      if (!token.active) return;
      const confirmed = await serviceRequest(`/api/service-delivery/${data.id}`);
      if (!token.active) return;
      if (confirmed.id !== data.id || confirmed.siteServiceId !== serviceId || confirmed.startSource !== source ||
        (source === "MOBILISATION_HANDOVER" && (confirmed.mobilisationId !== chosen?.mobilisationId || confirmed.handoverDecisionId !== chosen?.decisionId)))
        throw new Error("The Service Delivery record could not be confirmed from its source. Refresh before trying again.");
      requestKey.current = crypto.randomUUID(); router.push(`/service-delivery/${data.id}`);
    } catch (caught) { if (token.active) setError(caught instanceof Error ? caught.message : "Start not confirmed. Check current records before another attempt."); }
    finally { token.writing = false; if (token.active) setBusy(false); }
  }
  return <main className={`enterprise-main ${styles.page} ${work.page}`}>
    <p className="eyebrow">Office · continuing service management</p><h1>Service Delivery</h1>
    <p className={styles.intro}>Manage reviews, meetings and actions for an exact Client → Site → Site Service. Each record keeps its own history.</p>
    {mobilisationId && <p className={styles.muted}>Starting from a Mobilisation handover. Select its exact eligible Site Service and decision below; no record is started automatically.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <Sheet open={showStart} onOpenChange={open => { if (!busy) setShowStart(open); }}><section className={styles.listHeader}><div><p className={styles.sectionLabel}>Service records</p><h2>Continuing delivery <small>{loading || portfolioError ? "—" : total}</small></h2><p className={styles.muted}>Open a service to review its periods, actions and source facts.</p></div><SheetTrigger asChild><button className={styles.button} type="button" disabled={busy} aria-expanded={showStart} aria-controls="start-service-delivery" onClick={() => setShowStart(value => !value)}>{showStart ? "Close start form" : "Start Service Delivery"}</button></SheetTrigger></section>
    <SheetContent className={work.startSheet} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>{showStart && <section id="start-service-delivery"><SheetHeader><SheetTitle>Start Service Delivery</SheetTitle><SheetDescription>Select the exact service and an authorised start path. This creates a separate management record.</SheetDescription></SheetHeader><form className={styles.form} onSubmit={start}><fieldset disabled={busy} className={work.startFields}>
      <label>Site Service<select required value={serviceId} onChange={e => { setServiceId(e.target.value); setHandover(""); }}><option value="">Choose exact Service</option>{matchingServices.map(s => <option key={s.id} value={s.id}>{s.clientName} → {s.siteName} → {s.name} ({s.state})</option>)}</select></label>
      <label>Start path<select value={source} onChange={e => setSource(e.target.value)}><option value="MOBILISATION_HANDOVER">Exact Mobilisation handover</option>{!mobilisationId && <option value="LEGACY_EXISTING">Legacy existing Service</option>}</select></label>
      {source === "MOBILISATION_HANDOVER" ? <label>Handover decision<select required value={handover} onChange={e => setHandover(e.target.value)}><option value="">Choose exact handed over Mobilisation</option>{selected?.handoverChoices.filter(h => !mobilisationId || h.mobilisationId === mobilisationId).map(h => <option key={h.decisionId} value={`${h.mobilisationId}:${h.decisionId}`}>{h.title} · {h.decisionId.slice(0,8)}</option>)}</select></label>
      : <label>Why this existing Service did not use native Mobilisation<textarea required minLength={10} maxLength={500} value={explanation} onChange={e => setExplanation(e.target.value)} /></label>}
      <label>Accountable owner<select required value={ownerId} onChange={e => setOwnerId(e.target.value)}><option value="">Choose active Office Admin</option>{owners.filter(o => o.office || (superAdmin && o.super)).map(o => <option key={o.id} value={o.id}>{o.name}{!o.office ? " · Super oversight" : ""}</option>)}</select></label>
      {superAdmin && owners.find(o => o.id === ownerId && !o.office) && <label><input type="checkbox" checked={superOversight} onChange={e => setSuperOversight(e.target.checked)} /> Explicit Super Admin oversight</label>}
      {selected && <div className={work.startReview} aria-live="polite"><strong>{selected.name}</strong><span>{selected.clientName} → {selected.siteName}</span><span>Owner: {owners.find(o => o.id === ownerId)?.name ?? "Choose an accountable owner"}</span><span>{source === "MOBILISATION_HANDOVER" ? `Exact handover: ${selected.handoverChoices.find(h => `${h.mobilisationId}:${h.decisionId}` === handover)?.title ?? "Choose a handover decision"}` : "Legacy existing Service — explanation required"}</span></div>}
      <button className={styles.button} disabled={busy}>{busy ? "Starting…" : "Start Service Delivery"}</button>
    </fieldset></form></section>}</SheetContent></Sheet>
    <nav className={styles.portfolioViews} aria-label="Service Delivery views">{views.map(item => <button key={item.id} type="button" className={view === item.id ? styles.portfolioViewActive : styles.portfolioView} aria-current={view === item.id ? "page" : undefined} onClick={() => { setView(item.id); setOffset(0); }}>{item.label}</button>)}</nav>
    <details className={`${styles.card} ${styles.portfolioFilters}`}><summary>Filter services{hasFilters ? " · active" : ""}</summary>
    <form className={styles.form} onSubmit={event => { event.preventDefault(); setFilters({ ...draftFilters }); setOffset(0); }}><div className={styles.filterGrid}>
        <label>Client<input value={draftFilters.client} maxLength={80} onChange={event => setDraftFilters({ ...draftFilters, client: event.target.value })} /></label>
        <label>Site<input value={draftFilters.site} maxLength={80} onChange={event => setDraftFilters({ ...draftFilters, site: event.target.value })} /></label>
        <label>Service<input value={draftFilters.service} maxLength={80} onChange={event => setDraftFilters({ ...draftFilters, service: event.target.value })} /></label>
        <label>Owner<select value={draftFilters.owner} onChange={event => setDraftFilters({ ...draftFilters, owner: event.target.value })}><option value="">All owners</option>{portfolioOwners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
        <label>State<select value={draftFilters.state} onChange={event => setDraftFilters({ ...draftFilters, state: event.target.value })}><option value="">All states</option>{["PROPOSED","ACTIVE","CLOSING","CLOSED","CANCELLED"].map(state => <option key={state} value={state}>{state}</option>)}</select></label>
        <label>Date from<input type="date" value={draftFilters.from} onChange={event => setDraftFilters({ ...draftFilters, from: event.target.value })} /></label>
        <label>Date to<input type="date" value={draftFilters.to} onChange={event => setDraftFilters({ ...draftFilters, to: event.target.value })} /></label>
      </div><p className={styles.muted}>Date filters use the {dateMeaning[view]}. All filters apply to the full authorised portfolio.</p>
      <div className={styles.inline}><button className={styles.button} type="submit">Apply filters</button><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => { setDraftFilters(emptyFilters); setFilters(emptyFilters); setOffset(0); }}>Clear</button></div>
    </form></details>
    {hasFilters && <p className={work.appliedFilters} aria-label="Applied portfolio filters">{Object.entries(filters).filter(([,value]) => value).map(([key,value]) => <span key={key}>{key === "owner" ? `Owner: ${portfolioOwners.find(owner => owner.id === value)?.name ?? "Selected owner"}` : `${key}: ${value}`}</span>)}</p>}
    <section aria-label="Service Delivery records">{portfolioError && <p role="alert" className={styles.error}>{portfolioError}</p>}<p className={styles.meta} role="status">{loading ? "Loading services…" : portfolioError ? "Portfolio read unconfirmed" : `${total} matching services · current read ${london(asOf)}`}</p><div className={work.registerHead} aria-hidden="true"><span>Service / Client / Site</span><span>Accountability</span><span>Next obligation</span></div><div className={work.register}>{rows.map(r => <Link key={r.id} href={serviceDeliveryRecordHref(r.id, { view, offset, filters })} className={`${styles.row} ${work.registerRow}`}>
      <div className={work.serviceIdentity}><strong>{r.service_name}</strong><span className={styles.path}>{r.client_name} <span aria-hidden="true">/</span> {r.site_name}</span></div>
      <div className={work.accountability}><span className={styles.state}>{r.state.replaceAll("_"," ")}</span><span className={styles.meta}>Owner: {r.owner_name}</span>{!r.owner_eligible && <span className={styles.attention}>Owner reassignment required</span>}</div>
      <div className={work.obligation}><strong>{view === "reviews_due" ? `Review ${r.next_review_on ?? "date not returned"}` : view === "actions_overdue" ? `${r.overdue_action_count} overdue actions` : view === "meetings_upcoming" ? `Meeting ${london(r.next_meeting_at)}` : view === "changes_awaiting" ? `${r.changes_awaiting_count} changes awaiting source application` : r.next_review_on ? `Next review ${r.next_review_on}` : r.next_meeting_at ? `Next meeting ${london(r.next_meeting_at)}` : `${r.open_action_count} open actions`}</strong><span className={work.sourceNote}>Current portfolio source</span></div>
      <div className={`${styles.rowFacts} ${work.obligationFacts}`}><span><b>{r.review_due_count}</b> reviews due</span><span><b>{r.open_action_count}</b> open actions</span><span><b>{r.overdue_action_count}</b> overdue</span><span><b>{r.open_blocker_count}</b> blockers</span><span><b>{r.changes_awaiting_count}</b> awaiting source application</span>{r.source_drift_count > 0 && <span className={styles.attention}>{r.source_drift_count} applied changes with later source drift</span>}</div>
    </Link>)}</div>{!loading && !portfolioError && rows.length === 0 && <p>No Service Delivery records match this view and filter.</p>}
      <div className={styles.inline}><button className={`${styles.button} ${styles.secondary}`} disabled={offset===0} onClick={() => setOffset(Math.max(0,offset-25))}>Previous</button><button className={`${styles.button} ${styles.secondary}`} disabled={offset+25>=total} onClick={() => setOffset(offset+25)}>Next</button></div>
    </section>
  </main>;
}
