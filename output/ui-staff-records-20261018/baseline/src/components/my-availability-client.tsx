"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import styles from "./my-availability.module.css";

type Declaration = { id: string; state: "AVAILABLE"|"UNAVAILABLE"; starts_at: string; ends_at: string;
  lifecycle: "CURRENT"|"SUPERSEDED"|"CANCELLED"; note: string|null };
type HistoryEvent = { id: string; kind: string; old_state: string|null; new_state: string|null;
  old_starts_at: string|null; old_ends_at: string|null; new_starts_at: string|null; new_ends_at: string|null;
  occurred_at: string };
type Preview = { revision: number; replaced: Array<{id:string;state:string;starts_at:string;ends_at:string}>;
  deployments: Array<{id:string;event_name:string;report_at:string;shift_ends_at:string;status:string}>;
  range: {starts:string;ends:string} };
const format = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London",
  weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const localParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function localInput(value: string) {
  const parts = Object.fromEntries(localParts.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
async function json(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Availability request failed");
  return data;
}

export function MyAvailabilityClient() {
  const [items, setItems] = useState<Declaration[]>([]); const [revision, setRevision] = useState(0);
  const [total, setTotal] = useState(0); const [offset, setOffset] = useState(0);
  const [history, setHistory] = useState<HistoryEvent[]>([]); const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false); const [preview, setPreview] = useState<Preview|null>(null);
  const [state, setState] = useState<"AVAILABLE"|"UNAVAILABLE">("AVAILABLE");
  const [mode, setMode] = useState<"ALL_DAY"|"CUSTOM"|"REST_TODAY">("ALL_DAY");
  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const [startsLocal, setStartsLocal] = useState(""); const [endsLocal, setEndsLocal] = useState("");
  const [note, setNote] = useState(""); const [confirmReplace, setConfirmReplace] = useState(false);
  const [ackConflict, setAckConflict] = useState(false);
  const [cancelling, setCancelling] = useState<Declaration|null>(null);
  const [cancelPreview, setCancelPreview] = useState<Preview|null>(null);
  const [cancelAck, setCancelAck] = useState(false);
  const load = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const [current, prior] = await Promise.all([json(`/api/availability/me?offset=${page}`),
        json("/api/availability/me/history")]);
      setItems(current.availability.items); setRevision(current.availability.revision);
      setTotal(current.availability.total); setOffset(page);
      setHistory(prior.history.items); setHistoryTotal(prior.history.total); setError("");
      return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "My Availability unavailable"); return false; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const body = { mode, startDate, endDate, startsLocal, endsLocal };
  function startEntry() { setPreview(null); setConfirmReplace(false); setAckConflict(false); setNote("");
    setStartDate(""); setEndDate(""); setStartsLocal(""); setEndsLocal(""); setOpen(true); }
  function changeEntry(item: Declaration) { setState(item.state); setMode("CUSTOM");
    setStartsLocal(localInput(item.starts_at)); setEndsLocal(localInput(item.ends_at)); setNote(item.note ?? "");
    setPreview(null); setConfirmReplace(false); setAckConflict(false); setOpen(true); }
  async function check() { setBusy(true); setError(""); try {
    const result = await json("/api/availability/me/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setPreview({ ...result.preview, range: result.range }); setConfirmReplace(false); setAckConflict(false);
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Preview unavailable"); }
    finally { setBusy(false); } }
  async function save() { if (!preview) return; setBusy(true); setError(""); try {
    await json("/api/availability/me", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, state, note, expectedRevision: preview.revision, confirmReplace, acknowledgeConflict: ackConflict }) });
    setOpen(false); setPreview(null);
    if (await load()) setNotice("Availability saved and current declarations refreshed. This does not change any deployment.");
    else setError("The server accepted the change, but current availability could not be refreshed. Reload before making another change.");
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Availability not saved"); setPreview(null); }
    finally { setBusy(false); } }
  async function cancel() { if (!cancelling) return; setBusy(true); setError(""); try {
    await json(`/api/availability/me/${cancelling.id}`, { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "CANCEL", expectedRevision: revision, acknowledgeConflict: cancelAck }) });
    setCancelling(null); setCancelPreview(null);
    if (await load(offset)) setNotice("Future declaration cancelled and history refreshed. Any deployment remains in place.");
    else setError("The server accepted cancellation, but current availability could not be refreshed. Reload before making another change.");
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Cancellation failed"); }
    finally { setBusy(false); } }
  async function reviewCancel(item: Declaration) {
    setBusy(true); setError(""); setCancelAck(false); setCancelPreview(null);
    try {
      const result = await json("/api/availability/me/preview", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "EXACT", startsIso: item.starts_at, endsIso: item.ends_at }) });
      setCancelPreview({ ...result.preview, range: result.range }); setCancelling(item);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Cancellation preview unavailable"); }
    finally { setBusy(false); }
  }
  const current = items.filter((item) => item.lifecycle === "CURRENT" && new Date(item.ends_at) > new Date());
  const past = items.filter((item) => !current.includes(item));
  return <main className={`enterprise-main availability-self ${styles.workspace}`}>
    <div className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Your future work</p><h1>My Availability</h1>
      <p>Tell KSS when you can or cannot work. Availability does not allocate or accept a deployment.</p></div>
      <Button onClick={startEntry}>Add availability</Button></div>
    <p className="enterprise-honesty">No declaration means Not declared. Your allocations remain separate in <Link href="/my-deployments">My Deployments</Link>. <Link href="/my-time-away">Time Away requests</Link> are a separate decision workflow.</p>
    {notice && <p role="status" className="enterprise-honesty">{notice}</p>}
    {error && <p role="alert" className="enterprise-error">{error} <Button variant="outline" onClick={() => void load(offset)}>Reload</Button></p>}
    {loading ? <p role="status" className="crm-skeleton">Loading availability…</p> : <>
      <section aria-label="Current availability"><h2>Upcoming declarations</h2>
        {current.length === 0 ? <div className="crm-empty">Nothing declared for the upcoming period.</div> :
          <div className="availability-list">{current.map((item) => <article className="crm-panel availability-card" key={item.id}>
            <div><strong>{item.state === "AVAILABLE" ? "Available" : "Unavailable"}</strong><p>{format(item.starts_at)} → {format(item.ends_at)}</p>
              {item.note && <p className="availability-note">Your note: {item.note}</p>}</div>
            <div className="availability-actions"><Button variant="outline" disabled={busy || new Date(item.starts_at) <= new Date()} onClick={() => changeEntry(item)}>Change</Button>
              <Button variant="outline" disabled={busy || new Date(item.starts_at) <= new Date()} onClick={() => void reviewCancel(item)}>Cancel</Button></div>
          </article>)}</div>}</section>
      <details className="deployment-history"><summary>History · {historyTotal} changes</summary>
        <div className="availability-list">{history.map((event) => <article className="crm-panel availability-card" key={event.id}>
          <div><strong>{event.kind.replaceAll("_", " ").toLowerCase()}</strong><p>{format(event.occurred_at)}</p>
            <small>{event.new_state ?? event.old_state} · {event.new_starts_at ? format(event.new_starts_at) : event.old_starts_at ? format(event.old_starts_at) : ""}</small></div></article>)}</div>
        {historyTotal > 25 && <p className="enterprise-honesty">Showing the latest 25 changes.</p>}
      </details>
      {past.length > 0 && <p className="enterprise-honesty">{past.length} earlier declarations on this page are retained in history.</p>}
      {total > 25 && <div className="deployment-pagination"><Button variant="outline" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - 25))}>Previous</Button><span>{offset + 1}–{Math.min(offset + 25, total)} of {total}</span><Button variant="outline" disabled={offset + 25 >= total} onClick={() => void load(offset + 25)}>Next</Button></div>}
    </>}
    <Sheet open={open} onOpenChange={(value) => { if (!value && !busy) setOpen(false); }}><SheetContent className={`staffing-sheet availability-sheet ${styles.sheet}`}><SheetTitle>Declare availability</SheetTitle>
      <div className="availability-form"><label>Declaration<select value={state} onChange={(event) => { setState(event.target.value as typeof state); setPreview(null); }}><option value="AVAILABLE">Available</option><option value="UNAVAILABLE">Unavailable</option></select></label>
        <label>Range<select value={mode} onChange={(event) => { setMode(event.target.value as typeof mode); setPreview(null); }}><option value="ALL_DAY">Whole day or days</option><option value="CUSTOM">Custom London times</option><option value="REST_TODAY">Rest of today</option></select></label>
        {mode === "ALL_DAY" && <><label>First day<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPreview(null); }} /></label>
          <label>Last day<input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPreview(null); }} /></label></>}
        {mode === "CUSTOM" && <><label>Starts · Europe/London<input type="datetime-local" value={startsLocal} onChange={(event) => { setStartsLocal(event.target.value); setPreview(null); }} /></label>
          <label>Ends · Europe/London<input type="datetime-local" value={endsLocal} onChange={(event) => { setEndsLocal(event.target.value); setPreview(null); }} /></label></>}
        {mode === "REST_TODAY" && <p className="enterprise-honesty">From now until the next London-local midnight.</p>}
        <label className="availability-wide">Optional note — do not include medical or sensitive personal information<textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      </div>
      {!preview ? <Button disabled={busy} onClick={() => void check()}>Review declaration</Button> : <div className="availability-preview">
        <h3>Review this change</h3><p>{state === "AVAILABLE" ? "Available" : "Unavailable"} · {format(preview.range.starts)} → {format(preview.range.ends)}</p>
        {preview.replaced.length > 0 && <><p>These current ranges will be replaced. Unaffected time will be preserved:</p><ul>{preview.replaced.map((item) => <li key={item.id}>{item.state === "AVAILABLE" ? "Available" : "Unavailable"} · {format(item.starts_at)} → {format(item.ends_at)}</li>)}</ul>
          <label className="staffing-confirm"><input type="checkbox" checked={confirmReplace} onChange={(event) => setConfirmReplace(event.target.checked)} /> Replace the listed ranges</label></>}
        {preview.deployments.length > 0 && (state === "UNAVAILABLE" || preview.replaced.length > 0) && <><p className="enterprise-error">This overlaps your existing deployment. Changing availability does not cancel or decline it.</p>
          <ul>{preview.deployments.map((item) => <li key={item.id}>{item.event_name} · {format(item.report_at)} · {item.status}</li>)}</ul>
          <label className="staffing-confirm"><input type="checkbox" checked={ackConflict} onChange={(event) => setAckConflict(event.target.checked)} /> I understand my deployment remains in place</label></>}
        <div className="deployment-actions"><Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>Edit</Button><Button disabled={busy || (preview.replaced.length > 0 && !confirmReplace) ||
          (preview.deployments.length > 0 && (state === "UNAVAILABLE" || preview.replaced.length > 0) && !ackConflict)} onClick={() => void save()}>Save declaration</Button></div></div>}
      {error && <p role="alert" className="enterprise-error">{error}</p>}
    </SheetContent></Sheet>
    <Sheet open={Boolean(cancelling)} onOpenChange={(value) => { if (!value && !busy) setCancelling(null); }}><SheetContent className={`staffing-sheet ${styles.sheet}`}><SheetTitle>Cancel future declaration?</SheetTitle>
      <p>The declaration will leave current availability. Its history remains attributable. Any deployment stays unchanged.</p>
      {cancelling?.state === "AVAILABLE" && cancelPreview && cancelPreview.deployments.length > 0 && <><p className="enterprise-error">These existing deployments may no longer have declared coverage:</p>
        <ul>{cancelPreview.deployments.map((item) => <li key={item.id}>{item.event_name} · {format(item.report_at)} · {item.status}</li>)}</ul>
        <label className="staffing-confirm"><input type="checkbox" checked={cancelAck} onChange={(event) => setCancelAck(event.target.checked)} /> I understand these deployments remain in place</label></>}
      <div className="deployment-actions"><Button variant="outline" disabled={busy} onClick={() => setCancelling(null)}>Keep</Button><Button disabled={busy || Boolean(cancelling?.state === "AVAILABLE" && cancelPreview && cancelPreview.deployments.length > 0 && !cancelAck)} onClick={() => void cancel()}>Cancel declaration</Button></div></SheetContent></Sheet>
  </main>;
}
