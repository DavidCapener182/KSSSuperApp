"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { london, serviceRequest } from "./service-delivery-api";
import styles from "./service-delivery.module.css";

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
export function ServiceDeliveryList({ superAdmin, mobilisationId }: { superAdmin: boolean; mobilisationId?: string }) {
  const router = useRouter(); const requestKey = useRef(crypto.randomUUID());
  const [rows,setRows] = useState<Row[]>([]); const [total,setTotal] = useState(0); const [offset,setOffset] = useState(0);
  const [portfolioOwners,setPortfolioOwners] = useState<{ id: string; name: string }[]>([]);
  const [view,setView] = useState("all"); const [draftFilters,setDraftFilters] = useState<Filters>(emptyFilters); const [filters,setFilters] = useState<Filters>(emptyFilters);
  const [asOf,setAsOf] = useState<string | null>(null); const [loading,setLoading] = useState(true); const [portfolioError,setPortfolioError] = useState("");
  const [services,setServices] = useState<Service[]>([]); const [owners,setOwners] = useState<Owner[]>([]);
  const [serviceId,setServiceId] = useState(""); const [source,setSource] = useState("MOBILISATION_HANDOVER");
  const [handover,setHandover] = useState(""); const [ownerId,setOwnerId] = useState(""); const [superOversight,setSuperOversight] = useState(false);
  const [explanation,setExplanation] = useState(""); const [error,setError] = useState(""); const [busy,setBusy] = useState(false);
  const [showStart,setShowStart] = useState(Boolean(mobilisationId));
  const load = useCallback(async () => {
    setLoading(true); setPortfolioError("");
    const params = new URLSearchParams({ view, offset: String(offset) });
    for (const [key,value] of Object.entries(filters)) if (value) params.set(key,value);
    try { const data = await serviceRequest(`/api/service-delivery/portfolio?${params}`); setRows(data.items ?? []); setTotal(data.total ?? 0); setAsOf(data.asOf ?? null); setPortfolioOwners(data.owners ?? []); }
    catch (e) { setRows([]); setTotal(0); setAsOf(null); setPortfolioError(e instanceof Error ? e.message : "Portfolio unavailable"); }
    finally { setLoading(false); }
  },[offset,view,filters]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); },[load]);
  useEffect(() => { void serviceRequest("/api/service-delivery?choices=1").then(data => { setServices(data.services ?? []); setOwners(data.owners ?? []); }).catch(() => setError("Start choices unavailable")); },[]);
  const selected = services.find(x => x.id === serviceId);
  const hasFilters = Object.values(filters).some(Boolean);
  const matchingServices = mobilisationId ? services.filter(service => service.handoverChoices.some(choice => choice.mobilisationId === mobilisationId)) : services;
  async function start(e: React.FormEvent) {
    e.preventDefault(); if (!selected) return;
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
      const confirmed = await serviceRequest(`/api/service-delivery/${data.id}`);
      if (confirmed.id !== data.id || confirmed.siteServiceId !== serviceId || confirmed.startSource !== source ||
        (source === "MOBILISATION_HANDOVER" && (confirmed.mobilisationId !== chosen?.mobilisationId || confirmed.handoverDecisionId !== chosen?.decisionId)))
        throw new Error("The Service Delivery record could not be confirmed from its source. Refresh before trying again.");
      requestKey.current = crypto.randomUUID(); router.push(`/service-delivery/${data.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Start denied"); }
    finally { setBusy(false); }
  }
  return <main className={`enterprise-main ${styles.page}`}>
    <p className="eyebrow">Office · synthetic Dev</p><h1>Service Delivery</h1>
    <p className={styles.intro}>Manage reviews, meetings and actions for an exact Client → Site → Site Service. Each record keeps its own history.</p>
    {mobilisationId && <p className={styles.muted}>Starting from a Mobilisation handover. Select its exact eligible Site Service and decision below; no record is started automatically.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <section className={styles.listHeader}><div><p className={styles.sectionLabel}>Service records</p><h2>Continuing delivery <small>{loading || portfolioError ? "—" : total}</small></h2><p className={styles.muted}>Open a service to review its periods, actions and source facts.</p></div><button className={styles.button} type="button" aria-expanded={showStart} aria-controls="start-service-delivery" onClick={() => setShowStart(value => !value)}>{showStart ? "Close start form" : "Start Service Delivery"}</button></section>
    {showStart && <section id="start-service-delivery" className={`${styles.card} ${styles.startCard}`}><h2>Start Service Delivery</h2><p className={styles.muted}>Select the exact service and an authorised start path. This creates a separate management record.</p><form className={styles.form} onSubmit={start}>
      <label>Site Service<select required value={serviceId} onChange={e => { setServiceId(e.target.value); setHandover(""); }}><option value="">Choose exact Service</option>{matchingServices.map(s => <option key={s.id} value={s.id}>{s.clientName} → {s.siteName} → {s.name} ({s.state})</option>)}</select></label>
      <label>Start path<select value={source} onChange={e => setSource(e.target.value)}><option value="MOBILISATION_HANDOVER">Exact Mobilisation handover</option>{!mobilisationId && <option value="LEGACY_EXISTING">Legacy existing Service</option>}</select></label>
      {source === "MOBILISATION_HANDOVER" ? <label>Handover decision<select required value={handover} onChange={e => setHandover(e.target.value)}><option value="">Choose exact handed over Mobilisation</option>{selected?.handoverChoices.filter(h => !mobilisationId || h.mobilisationId === mobilisationId).map(h => <option key={h.decisionId} value={`${h.mobilisationId}:${h.decisionId}`}>{h.title} · {h.decisionId.slice(0,8)}</option>)}</select></label>
      : <label>Why this existing Service did not use native Mobilisation<textarea required minLength={10} maxLength={500} value={explanation} onChange={e => setExplanation(e.target.value)} /></label>}
      <label>Accountable owner<select required value={ownerId} onChange={e => setOwnerId(e.target.value)}><option value="">Choose active Office Admin</option>{owners.filter(o => o.office || (superAdmin && o.super)).map(o => <option key={o.id} value={o.id}>{o.name}{!o.office ? " · Super oversight" : ""}</option>)}</select></label>
      {superAdmin && owners.find(o => o.id === ownerId && !o.office) && <label><input type="checkbox" checked={superOversight} onChange={e => setSuperOversight(e.target.checked)} /> Explicit Super Admin oversight</label>}
      <button className={styles.button} disabled={busy}>{busy ? "Starting…" : "Start Service Delivery"}</button>
    </form></section>}
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
    <section aria-label="Service Delivery records">{portfolioError && <p role="alert" className={styles.error}>{portfolioError}</p>}<p className={styles.meta} role="status">{loading ? "Loading services…" : portfolioError ? "Portfolio read unconfirmed" : `${total} matching services · current read ${london(asOf)}`}</p><div className={styles.grid}>{rows.map(r => <Link key={r.id} href={`/service-delivery/${r.id}`} className={`${styles.card} ${styles.row}`}>
      <span className={styles.path}>{r.client_name} <span aria-hidden="true">/</span> {r.site_name}</span><strong>{r.service_name}</strong><span className={styles.state}>{r.state.replaceAll("_"," ")}</span>
      {!r.owner_eligible && <span className={styles.attention}>Owner reassignment required</span>}
      <span className={styles.meta}>Owner: {r.owner_name} · next review: {r.next_review_on ?? "not set"} · next meeting: {london(r.next_meeting_at)}</span>
      <span className={styles.rowFacts}><span><b>{r.review_due_count}</b> reviews due</span><span><b>{r.open_action_count}</b> open actions</span><span><b>{r.overdue_action_count}</b> overdue</span><span><b>{r.open_blocker_count}</b> blockers</span><span><b>{r.changes_awaiting_count}</b> awaiting source application</span></span>
      {r.source_drift_count > 0 && <span className={styles.attention}>{r.source_drift_count} applied changes with later source drift</span>}
    </Link>)}</div>{!loading && !portfolioError && rows.length === 0 && <p>No Service Delivery records match this view and filter.</p>}
      <div className={styles.inline}><button className={`${styles.button} ${styles.secondary}`} disabled={offset===0} onClick={() => setOffset(Math.max(0,offset-25))}>Previous</button><button className={`${styles.button} ${styles.secondary}`} disabled={offset+25>=total} onClick={() => setOffset(offset+25)}>Next</button></div>
    </section>
  </main>;
}
