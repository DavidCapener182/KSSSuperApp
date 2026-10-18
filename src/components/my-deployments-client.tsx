"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import styles from "./deployment-offers.module.css";

type Deployment = { source:"EVENT"|"SITE_SHIFT"; id: string; status: "ALLOCATED"|"ACCEPTED"|"DECLINED"|"CANCELLED"; revision: number;
  event_name: string; event_status: string; site_name: string; reporting_point: string|null; role_name: string;
  service_date: string; report_at: string; shift_starts_at: string; shift_ends_at: string; area_label: string;
  availability_conflict: string|null };
const time = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const labels = { ALLOCATED: "Awaiting your response", ACCEPTED: "Accepted", DECLINED: "Declined", CANCELLED: "Cancelled" };

export function MyDeploymentsClient({focus,focusSource,returnWeek}:{focus?:string;focusSource?:"EVENT"|"SITE_SHIFT";returnWeek?:string}) {
  const [items, setItems] = useState<Deployment[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [declining, setDeclining] = useState<Deployment|null>(null);
  const [reasonCode, setReasonCode] = useState("CANNOT_ATTEND");
  const [note, setNote] = useState("");
  const selection = focus ? `${focusSource ?? "EVENT"}:${focus}` : "all";
  const [loadedSelection, setLoadedSelection] = useState("");
  const readSequence = useRef(0);
  const lifetime = useRef(0);
  const pending = useRef(false);
  const clearFacts = useCallback(() => {
    setItems([]); setTotal(0); setNotice(""); setDeclining(null); setLoadedSelection("");
  }, []);
  const load = useCallback(async (page = 0) => {
    const read = ++readSequence.current, view = lifetime.current;
    const currentView = () => read === readSequence.current && view === lifetime.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/deployments/me?offset=${page}${focus?`&allocationId=${encodeURIComponent(focus)}${focusSource?`&source=${focusSource}`:""}`:""}`, { cache: "no-store" });
      if (!currentView()) return null;
      if (!response.ok) throw new Error("Your deployments are unavailable. Please retry.");
      const data = await response.json();
      if (!currentView()) return null;
      const current = data.deployments?.items as Deployment[] | undefined;
      if (!Array.isArray(current) || !Number.isInteger(data.deployments?.total) || data.deployments.total < 0 ||
          current.some((entry) => !entry || !["EVENT", "SITE_SHIFT"].includes(entry.source) || !entry.id || !Number.isInteger(entry.revision) || entry.revision < 1 ||
            (focus && (entry.id !== focus || entry.source !== (focusSource ?? "EVENT")))) ||
          new Set(current.map((entry) => `${entry.source}:${entry.id}`)).size !== current.length)
        throw new Error("Your deployments could not be matched to the requested source. Please retry.");
      setItems(current); setTotal(data.deployments.total); setOffset(page); setLoadedSelection(selection); setError("");
      setDeclining((selected) => selected && current.some((entry) => entry.id === selected.id && entry.source === selected.source && entry.status === "ALLOCATED") ? selected : null);
      return current;
    } catch (caught) {
      if (currentView()) { clearFacts(); setError(caught instanceof Error ? caught.message : "Your deployments are unavailable."); }
      return null;
    } finally { if (currentView()) setLoading(false); }
  }, [focus, focusSource, selection, clearFacts]);
  useEffect(() => {
    const reads = readSequence, views = lifetime, lock = pending;
    lock.current = false;
    const timer = setTimeout(() => { setBusy(false); setDeclining(null); setNote(""); setNotice(""); void load(); }, 0);
    return () => { clearTimeout(timer); ++reads.current; ++views.current; lock.current = false; };
  }, [load]);
  const visibleItems = loadedSelection === selection ? items : [];
  const currentLoading = loading || loadedSelection !== selection && !error;
  const currentDecline = loadedSelection === selection ? declining : null;
  const canRespond = (item: Deployment) => !currentLoading && visibleItems.some((entry) => entry.id === item.id && entry.source === item.source && entry.revision === item.revision && entry.status === "ALLOCATED" && !["COMPLETED", "CANCELLED"].includes(entry.event_status));
  async function respond(item: Deployment, response: "ACCEPTED"|"DECLINED") {
    if (pending.current || !canRespond(item)) return;
    pending.current = true;
    const view = lifetime.current;
    const currentView = () => view === lifetime.current;
    const unconfirmed = "Your response may have been saved, but its current state could not be confirmed. Reload your deployments before acting again.";
    setBusy(true); setError(""); setNotice("");
    let knownRejection = false;
    try {
      const result = await fetch(item.source==="SITE_SHIFT"?`/api/deployments/site-shifts/me/${item.id}`:`/api/deployments/me/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, expectedRevision: item.revision, ...(response === "DECLINED" ? { reasonCode, note } : {}) }) });
      if (!currentView()) return;
      const receipt = await result.json();
      if (!currentView()) return;
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) { knownRejection = true; clearFacts(); throw new Error(receipt.error ?? "Your response authority is unavailable. Reload your deployments."); }
        if (result.status === 400 || result.status === 409) {
          knownRejection = true;
          await load(offset);
          if (!currentView()) return;
          throw new Error(receipt.error ?? "Response not saved. Review the current allocation before retrying.");
        }
        throw new Error(unconfirmed);
      }
      if (!Number.isInteger(receipt.revision) || receipt.revision !== item.revision + 1) throw new Error(unconfirmed);
      const matches = (entry: Deployment) => entry.id === item.id && entry.source === item.source && entry.status === response && entry.revision === receipt.revision;
      const check = await fetch(`/api/deployments/me?offset=0&allocationId=${encodeURIComponent(item.id)}&source=${item.source}`, { cache: "no-store" });
      if (!currentView()) return;
      if (!check.ok) throw new Error(unconfirmed);
      const checked = await check.json();
      if (!currentView()) return;
      if (!Array.isArray(checked.deployments?.items) || checked.deployments.items.length !== 1 || !matches(checked.deployments.items[0])) throw new Error(unconfirmed);
      const current = await load(offset);
      if (!currentView()) return;
      if (!current?.some(matches)) throw new Error(unconfirmed);
      setDeclining(null); setNote("");
      setNotice(response === "ACCEPTED" ? "Accepted allocation confirmed. Attendance and worked time remain separate." : "Declined allocation confirmed. The position is available for reassignment.");
    } catch (caught) {
      if (currentView()) {
        // Only an explicit rejection is described as rejected; all other outcomes remain uncertain.
        if (!knownRejection) { clearFacts(); setError(unconfirmed); }
        else setError(caught instanceof Error ? caught.message : "Response not saved. Review your deployments.");
      }
    } finally { if (currentView()) { pending.current = false; setBusy(false); } }
  }
  const declineTrigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const currentItems = visibleItems.filter((item) => ["ALLOCATED", "ACCEPTED"].includes(item.status) && !["COMPLETED", "CANCELLED"].includes(item.event_status));
  const historyItems = visibleItems.filter((item) => !currentItems.includes(item));
  const responseItems = currentItems.filter((item) => item.status === "ALLOCATED");
  const acceptedItems = currentItems.filter((item) => item.status === "ACCEPTED");
  const card = (item: Deployment) => <article className={`crm-panel deployment-self-card ${styles.card}`} data-focused={item.id === focus && (!focusSource || item.source === focusSource) ? "true" : undefined} key={`${item.source}:${item.id}`}>
    <div className="deployment-self-top"><div><p className="enterprise-eyebrow">{item.source==="EVENT"?"Event work":"Ongoing Site shift"}</p><h2>{item.event_name}</h2><p>{item.site_name} · {item.role_name}</p></div><span className="deployment-state">{labels[item.status]}</span></div>
    <dl className="deployment-self-facts"><div><dt>Area</dt><dd>{item.area_label}</dd></div><div><dt>Report</dt><dd>{time(item.report_at)}</dd></div><div><dt>Shift</dt><dd>{time(item.shift_starts_at)} → {time(item.shift_ends_at)}</dd></div>{item.reporting_point && <div><dt>Reporting point</dt><dd>{item.reporting_point}</dd></div>}</dl>
    {item.availability_conflict && <p className="enterprise-error" role="status">{item.availability_conflict === "UNAVAILABLE_CONFLICT" ? "Availability conflict with this allocation" : "Declaration no longer covers this allocation"}. Your response has not changed.</p>}
    {item.status === "ALLOCATED" && item.event_status !== "COMPLETED" && item.event_status !== "CANCELLED" && <div className="deployment-actions"><Button disabled={busy || currentLoading} onClick={() => void respond(item, "ACCEPTED")}>Accept allocation</Button><Button variant="outline" disabled={busy || currentLoading} onClick={(event) => { declineTrigger.current = event.currentTarget; setDeclining(item); setReasonCode("CANNOT_ATTEND"); setNote(""); setError(""); }}>Decline</Button></div>}
    {item.status === "ACCEPTED" && <div className={styles.actions}><Link className={styles.primaryAction} href={`/my-attendance?source=${item.source}&allocationId=${encodeURIComponent(item.id)}`}>{["COMPLETED", "CANCELLED"].includes(item.event_status) ? "Open attendance record" : "Next: open attendance"}</Link><Link href={`/operational-contacts?source=${item.source}&allocationId=${encodeURIComponent(item.id)}`}>Operational contacts</Link>{item.source === "EVENT" && <Link href={`/my-work-time?allocationId=${encodeURIComponent(item.id)}`}>Event worked time</Link>}</div>}
  </article>;
  return <main className={`enterprise-main deployment-self ${styles.page}`}><div className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Your operational work</p><h1 ref={heading} tabIndex={-1}>My Deployments</h1><p>See only your own allocations. Accepting does not record attendance or hours worked.</p></div></div>
    <p className="enterprise-honesty">Responses and availability are separate from attendance. <Link href={returnWeek?`/my-schedule?week=${returnWeek}`:"/my-schedule"}>{returnWeek?"Return to My Schedule":"My Schedule"}</Link> · <Link href="/my-attendance">My Attendance</Link></p>
    {loadedSelection === selection && notice && <p className="enterprise-honesty" role="status">{notice}</p>}
    {busy && <p className="enterprise-honesty" role="status">Saving your response…</p>}
    {error && <p className="enterprise-error" role="alert">{error} <Button variant="outline" disabled={busy || loading} onClick={() => void load(offset)}>Retry</Button></p>}
    {currentLoading ? <p className="crm-skeleton" role="status">Loading your deployments…</p> : visibleItems.length === 0 ? (error ? null : <div className="crm-empty">No deployments to show.</div>) : <>
      <section aria-label="Current deployments"><h2>Awaiting your response</h2>{responseItems.length ? <div className="deployment-self-list">{responseItems.map(card)}</div> : <p className="crm-empty">No offers requiring a response on this page.</p>}</section>{acceptedItems.length > 0 && <section aria-label="Accepted duties"><h2>Accepted duties</h2><div className="deployment-self-list">{acceptedItems.map(card)}</div></section>}
      {historyItems.length > 0 && <details className="deployment-history"><summary>History · {historyItems.length} on this page</summary><div className="deployment-self-list">{historyItems.map(card)}</div></details>}
    </>}
    {loadedSelection === selection && total > 25 && <div className="deployment-pagination"><Button variant="outline" disabled={offset === 0 || currentLoading || busy} onClick={() => void load(Math.max(0, offset - 25))}>Previous</Button><span>{offset + 1}–{Math.min(offset + 25, total)} of {total}</span><Button variant="outline" disabled={offset + 25 >= total || currentLoading || busy} onClick={() => void load(offset + 25)}>Next</Button></div>}
    <Sheet open={Boolean(currentDecline)} onOpenChange={(open) => { if (!open && !busy) setDeclining(null); }}><SheetContent className={styles.declineSheet} onCloseAutoFocus={(event) => { event.preventDefault(); if (declineTrigger.current?.isConnected) declineTrigger.current.focus(); else heading.current?.focus(); }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}><SheetTitle>Decline allocation</SheetTitle><SheetDescription>{currentDecline?.event_name} · {currentDecline?.site_name} · {currentDecline?.role_name}</SheetDescription>{currentDecline && <dl className={styles.selectedFacts}><div><dt>Report · London</dt><dd>{time(currentDecline.report_at)}</dd></div><div><dt>Shift · London</dt><dd>{time(currentDecline.shift_starts_at)} → {time(currentDecline.shift_ends_at)}</dd></div></dl>}<p>Tell Operations why you cannot take this allocation. Please avoid sensitive personal or medical details.</p>
      {currentDecline && !busy && !currentLoading && !canRespond(currentDecline) && <p role="status">This allocation has changed. Close this response and review the current allocation before responding.</p>}
      <fieldset disabled={busy || currentLoading}><legend className="sr-only">Decline response</legend><label>Reason<select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}><option value="CANNOT_ATTEND">Cannot attend</option><option value="TIMING_CONFLICT">Timing conflict</option><option value="OTHER">Other</option></select></label>
      <label>Short note (optional)<textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} /></label></fieldset>
      {error && <p className="enterprise-error" role="alert">{error}</p>}
      <div className="deployment-actions"><Button variant="outline" disabled={busy || currentLoading} onClick={() => setDeclining(null)}>Keep allocation</Button><Button disabled={busy || !currentDecline || !canRespond(currentDecline)} onClick={() => currentDecline && void respond(currentDecline, "DECLINED")}>Confirm decline</Button></div>
    </SheetContent></Sheet>
  </main>;
}
