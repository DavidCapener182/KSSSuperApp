"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { london, serviceRequest } from "./service-delivery-api";
import styles from "./service-delivery.module.css";

type Service = { id: string; name: string; siteName: string; clientName: string; linkId: string; state: string; handoverChoices: { mobilisationId: string; decisionId: string; title: string }[] };
type Owner = { id: string; name: string; office: boolean; super: boolean };
type Row = { id: string; client_name: string; site_name: string; service_name: string; state: string; owner_eligible: boolean; open_period_count: number; open_action_count: number; open_blocker_count: number; next_meeting_at: string | null };
export function ServiceDeliveryList({ superAdmin }: { superAdmin: boolean }) {
  const router = useRouter(); const requestKey = useRef(crypto.randomUUID());
  const [rows,setRows] = useState<Row[]>([]); const [total,setTotal] = useState(0); const [offset,setOffset] = useState(0);
  const [services,setServices] = useState<Service[]>([]); const [owners,setOwners] = useState<Owner[]>([]);
  const [serviceId,setServiceId] = useState(""); const [source,setSource] = useState("MOBILISATION_HANDOVER");
  const [handover,setHandover] = useState(""); const [ownerId,setOwnerId] = useState(""); const [superOversight,setSuperOversight] = useState(false);
  const [explanation,setExplanation] = useState(""); const [error,setError] = useState(""); const [busy,setBusy] = useState(false);
  const [showStart,setShowStart] = useState(false);
  const load = useCallback(async () => {
    try { const data = await serviceRequest(`/api/service-delivery?offset=${offset}`); setRows(data.items ?? []); setTotal(data.total ?? 0); }
    catch (e) { setError(e instanceof Error ? e.message : "List unavailable"); }
  },[offset]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); },[load]);
  useEffect(() => { void serviceRequest("/api/service-delivery?choices=1").then(data => { setServices(data.services ?? []); setOwners(data.owners ?? []); }).catch(() => setError("Start choices unavailable")); },[]);
  const selected = services.find(x => x.id === serviceId);
  async function start(e: React.FormEvent) {
    e.preventDefault(); if (!selected) return;
    setBusy(true); setError("");
    const chosen = selected.handoverChoices.find(x => `${x.mobilisationId}:${x.decisionId}` === handover);
    try {
      const data = await serviceRequest("/api/service-delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        serviceId, linkId: selected.linkId, source, mobilisationId: source === "MOBILISATION_HANDOVER" ? chosen?.mobilisationId : null,
        decisionId: source === "MOBILISATION_HANDOVER" ? chosen?.decisionId : null, ownerId,
        superOversight, reasonCode: source === "LEGACY_EXISTING" ? "LEGACY_EXISTING_SERVICE" : null,
        explanation: source === "LEGACY_EXISTING" ? explanation : null, requestKey: requestKey.current,
      }) });
      requestKey.current = crypto.randomUUID(); router.push(`/service-delivery/${data.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Start denied"); }
    finally { setBusy(false); }
  }
  return <main className={`enterprise-main ${styles.page}`}>
    <p className="eyebrow">Office · synthetic Dev</p><h1>Service Delivery</h1>
    <p className={styles.intro}>Manage reviews, meetings and actions for an exact Client → Site → Site Service. Each record keeps its own history.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <section className={styles.listHeader}><div><p className={styles.sectionLabel}>Service records</p><h2>Continuing delivery <small>{total}</small></h2><p className={styles.muted}>Open a service to review its periods, actions and source facts.</p></div><button className={styles.button} type="button" aria-expanded={showStart} aria-controls="start-service-delivery" onClick={() => setShowStart(value => !value)}>{showStart ? "Close start form" : "Start Service Delivery"}</button></section>
    {showStart && <section id="start-service-delivery" className={`${styles.card} ${styles.startCard}`}><h2>Start Service Delivery</h2><p className={styles.muted}>Select the exact service and an authorised start path. This creates a separate management record.</p><form className={styles.form} onSubmit={start}>
      <label>Site Service<select required value={serviceId} onChange={e => { setServiceId(e.target.value); setHandover(""); }}><option value="">Choose exact Service</option>{services.map(s => <option key={s.id} value={s.id}>{s.clientName} → {s.siteName} → {s.name} ({s.state})</option>)}</select></label>
      <label>Start path<select value={source} onChange={e => setSource(e.target.value)}><option value="MOBILISATION_HANDOVER">Exact Mobilisation handover</option><option value="LEGACY_EXISTING">Legacy existing Service</option></select></label>
      {source === "MOBILISATION_HANDOVER" ? <label>Handover decision<select required value={handover} onChange={e => setHandover(e.target.value)}><option value="">Choose exact handed over Mobilisation</option>{selected?.handoverChoices.map(h => <option key={h.decisionId} value={`${h.mobilisationId}:${h.decisionId}`}>{h.title} · {h.decisionId.slice(0,8)}</option>)}</select></label>
      : <label>Why this existing Service did not use native Mobilisation<textarea required minLength={10} maxLength={500} value={explanation} onChange={e => setExplanation(e.target.value)} /></label>}
      <label>Accountable owner<select required value={ownerId} onChange={e => setOwnerId(e.target.value)}><option value="">Choose active Office Admin</option>{owners.filter(o => o.office || (superAdmin && o.super)).map(o => <option key={o.id} value={o.id}>{o.name}{!o.office ? " · Super oversight" : ""}</option>)}</select></label>
      {superAdmin && owners.find(o => o.id === ownerId && !o.office) && <label><input type="checkbox" checked={superOversight} onChange={e => setSuperOversight(e.target.checked)} /> Explicit Super Admin oversight</label>}
      <button className={styles.button} disabled={busy}>{busy ? "Starting…" : "Start Service Delivery"}</button>
    </form></section>}
    <section aria-label="Service Delivery records"><div className={styles.grid}>{rows.map(r => <Link key={r.id} href={`/service-delivery/${r.id}`} className={`${styles.card} ${styles.row}`}>
      <span className={styles.path}>{r.client_name} <span aria-hidden="true">/</span> {r.site_name}</span><strong>{r.service_name}</strong><span className={styles.state}>{r.state.replaceAll("_"," ")}</span>
      {!r.owner_eligible && <span className={styles.attention}>Owner reassignment required</span>}
      <span className={styles.rowFacts}><span><b>{r.open_period_count}</b> open reviews</span><span><b>{r.open_action_count}</b> open actions</span><span><b>{r.open_blocker_count}</b> blockers</span></span>
      <span className={styles.meta}>Next meeting: {london(r.next_meeting_at)}</span>
    </Link>)}</div>{rows.length === 0 && <p>No Service Delivery records yet.</p>}
      <div className={styles.inline}><button className={`${styles.button} ${styles.secondary}`} disabled={offset===0} onClick={() => setOffset(Math.max(0,offset-25))}>Previous</button><button className={`${styles.button} ${styles.secondary}`} disabled={offset+25>=total} onClick={() => setOffset(offset+25)}>Next</button></div>
    </section>
  </main>;
}
