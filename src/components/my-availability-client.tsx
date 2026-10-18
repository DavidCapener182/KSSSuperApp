"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import styles from "./my-availability.module.css";

type Declaration = { id: string; state: "AVAILABLE"|"UNAVAILABLE"; starts_at: string; ends_at: string;
  lifecycle: "CURRENT"|"SUPERSEDED"|"CANCELLED"; note: string|null };
type HistoryEvent = { id: string; kind: string; old_state: string|null; new_state: string|null;
  old_starts_at: string|null; old_ends_at: string|null; new_starts_at: string|null; new_ends_at: string|null;
  occurred_at: string; new_revision: number; new_lifecycle: string|null };
type Preview = { revision: number; replaced: Array<{id:string;state:string;starts_at:string;ends_at:string}>;
  deployments: Array<{id:string;event_name:string;report_at:string;shift_ends_at:string;status:string}>;
  range: {starts:string;ends:string}; requestKey?: string };
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
  if (!response.ok) throw Object.assign(new Error(data.error ?? "Availability request failed"),{status:response.status});
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
  const live = useRef(false);const readSequence = useRef(0);const pending = useRef(false);
  const [available,setAvailable] = useState(false);
  const declarationTrigger = useRef<HTMLButtonElement>(null);
  const actionTrigger = useRef<HTMLButtonElement|null>(null);
  function restoreActionFocus(event:Event){event.preventDefault();const trigger=actionTrigger.current;if(trigger?.isConnected&&!trigger.disabled)trigger.focus();else declarationTrigger.current?.focus();}
  function clearCurrent() { setItems([]);setHistory([]);setTotal(0);setHistoryTotal(0);setRevision(0);setAvailable(false);setPreview(null);setCancelPreview(null);setCancelling(null);setOpen(false);setNotice(""); }
  const load = useCallback(async (page = 0, expectedRevision?: number, expectedChange?: {kind:"CREATED"|"CANCELLED";state:string;starts:string;ends:string}) => {
    const sequence=++readSequence.current;const current=()=>live.current&&sequence===readSequence.current;
    setLoading(true);setNotice("");
    try {
      const [currentPage,prior] = await Promise.all([json(`/api/availability/me?offset=${page}`),json("/api/availability/me/history")]);
      if(!current())return false;
      const data=currentPage.availability;
      if(!data||!Array.isArray(data.items)||!Number.isInteger(data.revision)||data.revision<0||!Number.isInteger(data.total)||data.total<0||!Array.isArray(prior.history?.items)||!Number.isInteger(prior.history.total)||
        (expectedRevision!==undefined&&data.revision!==expectedRevision))throw new Error("Current availability is not confirmed. Reload before making another change.");
      if(expectedChange){
        const sameInstant=(first:string|null,second:string)=>!!first&&Number.isFinite(Date.parse(first))&&Date.parse(first)===Date.parse(second);
        if(!prior.history.items.some((event:HistoryEvent)=>event.kind===expectedChange.kind&&event.new_revision===expectedRevision&&
          (expectedChange.kind==="CREATED"?event.new_state===expectedChange.state&&event.new_lifecycle==="CURRENT"&&sameInstant(event.new_starts_at,expectedChange.starts)&&sameInstant(event.new_ends_at,expectedChange.ends):
          event.old_state===expectedChange.state&&event.new_lifecycle==="CANCELLED"&&sameInstant(event.old_starts_at,expectedChange.starts)&&sameInstant(event.old_ends_at,expectedChange.ends))))
          throw new Error("The exact availability change is not confirmed by current history. Reload before another action.");
      }
      setItems(data.items);setRevision(data.revision);setTotal(data.total);setOffset(page);setHistory(prior.history.items);setHistoryTotal(prior.history.total);setAvailable(true);setError("");return true;
    } catch(caught){if(!current())return false;setItems([]);setHistory([]);setTotal(0);setHistoryTotal(0);setRevision(0);setAvailable(false);setPreview(null);setCancelPreview(null);setCancelling(null);setOpen(false);setError(caught instanceof Error?caught.message:"My Availability unavailable");return false;}
    finally{if(current())setLoading(false);}
  },[]);
  useEffect(()=>{live.current=true;const sequence=readSequence;const timer=setTimeout(()=>void load(),0);return()=>{live.current=false;sequence.current++;clearTimeout(timer);};},[load]);
  const body = { mode, startDate, endDate, startsLocal, endsLocal };
  function startEntry(trigger?:HTMLButtonElement){if(pending.current||loading||!available)return;actionTrigger.current=trigger??declarationTrigger.current;setPreview(null);setConfirmReplace(false);setAckConflict(false);setNote("");setStartDate("");setEndDate("");setStartsLocal("");setEndsLocal("");setOpen(true);}
  function changeEntry(item:Declaration,trigger?:HTMLButtonElement){if(pending.current||loading||!available)return;actionTrigger.current=trigger??declarationTrigger.current;setState(item.state);setMode("CUSTOM");setStartsLocal(localInput(item.starts_at));setEndsLocal(localInput(item.ends_at));setNote(item.note??"");setPreview(null);setConfirmReplace(false);setAckConflict(false);setOpen(true);}
  async function check(){
    if(pending.current||!live.current||!available)return;
    const view=readSequence.current;const current=()=>live.current&&view===readSequence.current;const requestKey=JSON.stringify(body);
    pending.current=true;setBusy(true);setError("");
    try{const result=await json("/api/availability/me/preview",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      if(!current())return;
      if(!Number.isInteger(result.preview?.revision)||!Array.isArray(result.preview.replaced)||!Array.isArray(result.preview.deployments)||!result.range?.starts||!result.range.ends)throw new Error("Availability preview unavailable");
      setPreview({...result.preview,range:result.range,requestKey});setConfirmReplace(false);setAckConflict(false);
    }catch(caught){if(current()){if(caught instanceof Error&&"status" in caught&&(caught.status===401||caught.status===403))clearCurrent();setPreview(null);setError(caught instanceof Error?caught.message:"Preview unavailable");}}
    finally{if(live.current){pending.current=false;setBusy(false);}}
  }
  async function save(){
    if(pending.current||!live.current||!available||!preview)return;
    if(preview.requestKey!==JSON.stringify(body)){setPreview(null);setError("Review the changed period again before saving.");return;}
    if((preview.replaced.length>0&&!confirmReplace)||(preview.deployments.length>0&&(state==="UNAVAILABLE"||preview.replaced.length>0)&&!ackConflict))return;
    const view=readSequence.current;const current=()=>live.current&&view===readSequence.current;
    pending.current=true;setBusy(true);setError("");setNotice("");
    try{
      const result=await json("/api/availability/me",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,state,note,expectedRevision:preview.revision,confirmReplace,acknowledgeConflict:ackConflict})});
      if(!current())return;
      if(result.revision!==preview.revision+1)throw new Error("The requested availability revision is not confirmed. It may have been saved. Reload before another action.");
      setOpen(false);setPreview(null);const readbackSequence=readSequence.current+1;
      const confirmed=await load(0,result.revision,{kind:"CREATED",state,starts:preview.range.starts,ends:preview.range.ends});
      if(live.current&&readSequence.current===readbackSequence){if(confirmed)setNotice("Availability saved and exact current revision refreshed. This does not change any deployment.");else setError("The returned change is not confirmed by current availability. It may have been saved. Reload before another action.");}
    }catch(caught){if(current()){clearCurrent();setError(`${caught instanceof Error?caught.message:"Availability not confirmed"} The outcome is unconfirmed; reload before another action.`);}}
    finally{if(live.current){pending.current=false;setBusy(false);}}
  }
  async function cancel(){
    if(pending.current||!live.current||!available||!cancelling||!cancelPreview)return;
    if(cancelling.state==="AVAILABLE"&&cancelPreview.deployments.length>0&&!cancelAck)return;
    const view=readSequence.current;const current=()=>live.current&&view===readSequence.current;
    pending.current=true;setBusy(true);setError("");setNotice("");
    try{
      const result=await json(`/api/availability/me/${cancelling.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"CANCEL",expectedRevision:cancelPreview.revision,acknowledgeConflict:cancelAck})});
      if(!current())return;
      if(result.revision!==cancelPreview.revision+1)throw new Error("Cancellation is not confirmed. It may have been saved.");
      setCancelling(null);setCancelPreview(null);const readbackSequence=readSequence.current+1;
      const confirmed=await load(offset,result.revision,{kind:"CANCELLED",state:cancelling.state,starts:cancelling.starts_at,ends:cancelling.ends_at});
      if(live.current&&readSequence.current===readbackSequence){if(confirmed)setNotice("Future declaration cancelled and exact current revision refreshed. Any deployment remains in place.");else setError("The cancellation is not confirmed by current availability. It may have been saved. Reload before another action.");}
    }catch(caught){if(current()){clearCurrent();setError(`${caught instanceof Error?caught.message:"Cancellation not confirmed"} The outcome is unconfirmed; reload before another action.`);}}
    finally{if(live.current){pending.current=false;setBusy(false);}}
  }
  async function reviewCancel(item:Declaration,trigger?:HTMLButtonElement){
    if(pending.current||!live.current||!available)return;
    actionTrigger.current=trigger??declarationTrigger.current;
    const view=readSequence.current;const current=()=>live.current&&view===readSequence.current;
    pending.current=true;setBusy(true);setError("");setCancelAck(false);setCancelPreview(null);
    try{
      const result=await json("/api/availability/me/preview",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({mode:"EXACT",startsIso:item.starts_at,endsIso:item.ends_at})});
      if(!current())return;
      if(!Number.isInteger(result.preview?.revision)||!Array.isArray(result.preview.replaced)||!Array.isArray(result.preview.deployments)||!result.preview.replaced.some((entry:Declaration)=>entry.id===item.id&&entry.state===item.state&&entry.starts_at===item.starts_at&&entry.ends_at===item.ends_at))throw new Error("The selected declaration changed. Reload before cancellation.");
      setCancelPreview({...result.preview,range:result.range});setCancelling(item);
    }catch(caught){if(current()){clearCurrent();setError(caught instanceof Error?caught.message:"Cancellation preview unavailable");}}
    finally{if(live.current){pending.current=false;setBusy(false);}}
  }

  const current = items.filter((item) => item.lifecycle === "CURRENT" && new Date(item.ends_at) > new Date());
  const past = items.filter((item) => !current.includes(item));
  return <main className={`enterprise-main availability-self ${styles.workspace}`}>
    <div className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Your future work</p><h1>My Availability</h1>
      <p>Tell KSS when you can or cannot work. Availability does not allocate or accept a deployment.</p></div>
      <Button ref={declarationTrigger} disabled={busy || loading || !available} onClick={event=>startEntry(event.currentTarget)}>Declare availability</Button></div>
    <p className="enterprise-honesty">No declaration means Not declared. Your allocations remain separate in <Link href="/my-deployments">My Deployments</Link>. <Link href="/my-time-away">Time Away requests</Link> are a separate decision workflow.</p>
    {notice && <p role="status" className="enterprise-honesty">{notice}</p>}
    {error && <p role="alert" className="enterprise-error">{error} <Button variant="outline" disabled={busy} onClick={() => void load(offset)}>Reload</Button></p>}
    {loading ? <p role="status" className="crm-skeleton">Loading availability…</p> : !available ? <p role="status">Current availability is unavailable. Reload to read the current source.</p> : <>
      <section className={styles.agenda} aria-label="Current availability"><header className={styles.sectionHead}><div><p className={styles.eyebrow}>Your declared periods</p><h2>Upcoming availability</h2></div><span>{current.length} on this page</span></header><p className={styles.scope}>Current revision {revision} · Showing {items.length} of {total} declarations. No declaration means Not declared.</p>
        {current.length === 0 ? <div className="crm-empty">Nothing declared for the upcoming period.</div> :
          <div className="availability-list">{current.map((item) => <article className={styles.declaration} data-declaration={item.state} key={item.id}>
            <div><span className={styles.state}>{item.state === "AVAILABLE" ? "Available" : "Unavailable"}</span><p className={styles.period}>{format(item.starts_at)}<span aria-hidden="true"> → </span><span className={styles.periodEnd}>{format(item.ends_at)}</span></p>
              {item.note && <p className="availability-note">Your note: {item.note}</p>}</div>
            <div className={styles.actions}><Button variant="outline" disabled={busy || new Date(item.starts_at) <= new Date()} onClick={event => changeEntry(item,event.currentTarget)}>Change</Button>
              <Button variant="outline" disabled={busy || new Date(item.starts_at) <= new Date()} onClick={event => void reviewCancel(item,event.currentTarget)}>Cancel future declaration</Button></div>
          </article>)}</div>}</section>
      <details className={styles.history}><summary>History · {historyTotal} changes</summary>
        <div className={styles.historyList}>{history.map((event) => <article className={styles.historyEntry} key={event.id}>
          <div><strong>{event.kind.replaceAll("_", " ").toLowerCase()}</strong><p>{format(event.occurred_at)}</p>
            <small>{event.new_state ?? event.old_state} · {event.new_starts_at ? format(event.new_starts_at) : event.old_starts_at ? format(event.old_starts_at) : ""} → {event.new_ends_at ? format(event.new_ends_at) : event.old_ends_at ? format(event.old_ends_at) : ""}</small></div></article>)}</div>
        {historyTotal > 25 && <p className="enterprise-honesty">Showing the latest 25 changes.</p>}
      </details>
      {past.length > 0 && <p className="enterprise-honesty">{past.length} earlier declarations on this page are retained in history.</p>}
      {total > 25 && <div className="deployment-pagination"><Button variant="outline" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - 25))}>Previous</Button><span>{offset + 1}–{Math.min(offset + 25, total)} of {total}</span><Button variant="outline" disabled={offset + 25 >= total} onClick={() => void load(offset + 25)}>Next</Button></div>}
    </>}
    <Sheet open={open} onOpenChange={(value) => { if (!value && !busy) setOpen(false); }}><SheetContent className={`staffing-sheet availability-sheet ${styles.sheet}`} onCloseAutoFocus={restoreActionFocus}><SheetTitle>Declare availability</SheetTitle><SheetDescription>Choose a declaration and period, then review the exact times, replaced ranges and any deployment conflicts before saving.</SheetDescription>
      <fieldset disabled={busy || loading || !available} className="availability-form" style={{border:0,padding:0,margin:0,minWidth:0}}><label>Declaration<select value={state} onChange={(event) => { setState(event.target.value as typeof state); setPreview(null); }}><option value="AVAILABLE">Available</option><option value="UNAVAILABLE">Unavailable</option></select></label>
        <label>Range<select value={mode} onChange={(event) => { setMode(event.target.value as typeof mode); setPreview(null); }}><option value="ALL_DAY">Whole day or days</option><option value="CUSTOM">Custom London times</option><option value="REST_TODAY">Rest of today</option></select></label>
        {mode === "ALL_DAY" && <><label>First day<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPreview(null); }} /></label>
          <label>Last day<input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPreview(null); }} /></label></>}
        {mode === "CUSTOM" && <><label>Starts · Europe/London<input type="datetime-local" value={startsLocal} onChange={(event) => { setStartsLocal(event.target.value); setPreview(null); }} /></label>
          <label>Ends · Europe/London<input type="datetime-local" value={endsLocal} onChange={(event) => { setEndsLocal(event.target.value); setPreview(null); }} /></label></>}
        {mode === "REST_TODAY" && <p className="enterprise-honesty">From now until the next London-local midnight.</p>}
        <label className="availability-wide">Optional note — do not include medical or sensitive personal information<textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      </fieldset>
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
    <Sheet open={Boolean(cancelling)} onOpenChange={(value) => { if (!value && !busy) setCancelling(null); }}><SheetContent className={`staffing-sheet ${styles.sheet}`} onCloseAutoFocus={restoreActionFocus}><SheetTitle>Cancel future declaration?</SheetTitle><SheetDescription>{cancelling?.state === "AVAILABLE" ? "Available" : "Unavailable"} · {cancelling ? `${format(cancelling.starts_at)} → ${format(cancelling.ends_at)}` : ""}</SheetDescription>
      <p>The declaration will leave current availability. Its history remains attributable. Any deployment stays unchanged.</p>
      {cancelling?.state === "AVAILABLE" && cancelPreview && cancelPreview.deployments.length > 0 && <><p className="enterprise-error">These existing deployments may no longer have declared coverage:</p>
        <ul>{cancelPreview.deployments.map((item) => <li key={item.id}>{item.event_name} · {format(item.report_at)} · {item.status}</li>)}</ul>
        <label className="staffing-confirm"><input type="checkbox" checked={cancelAck} onChange={(event) => setCancelAck(event.target.checked)} /> I understand these deployments remain in place</label></>}
      <div className="deployment-actions"><Button variant="outline" disabled={busy} onClick={() => setCancelling(null)}>Keep</Button><Button disabled={busy || Boolean(cancelling?.state === "AVAILABLE" && cancelPreview && cancelPreview.deployments.length > 0 && !cancelAck)} onClick={() => void cancel()}>Cancel declaration</Button></div></SheetContent></Sheet>
  </main>;
}
