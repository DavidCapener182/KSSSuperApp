"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./attendance-self.module.css";

type Item = { source:"EVENT"|"SITE_SHIFT"; allocation_id:string; status:string; self_action_available:boolean; service_date:string; report_at:string; shift_starts_at:string; shift_ends_at:string; area_label:string; role_name:string; event_name:string; site_name:string; reporting_point:string|null; attendance:{revision:number;state:string;check_in_at:string|null;check_out_at:string|null;events:{id:string;revision?:number;actor_mode?:string;method?:string;type:string;actual_at:string|null;effective_actual_at:string|null;recorded_at:string;actor_name:string;reason:string|null}[]} };
const PAGE_SIZE=25;
const time=(value:string|null)=>value?new Date(value).toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"Not recorded";

export function MyAttendanceClient({allocationId,source="EVENT"}:{allocationId?:string;source?:"EVENT"|"SITE_SHIFT"}){
 const selection=allocationId?`${source}:${allocationId}`:"all";
 const requestSequence=useRef(0);const viewSequence=useRef(0);const mutationPending=useRef(false);
 const [loadedSelection,setLoadedSelection]=useState(selection);
 const [storedItems,setItems]=useState<Item[]>([]);const [storedTotal,setTotal]=useState(0);const [offset,setOffset]=useState(0);const [storedLoading,setLoading]=useState(true);const [busy,setBusy]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const items=loadedSelection===selection?storedItems:[];const total=loadedSelection===selection?storedTotal:0;const loading=storedLoading||loadedSelection!==selection;
 const load=useCallback(async(pageOffset:number,append=false)=>{
  const current=++requestSequence.current;setLoading(true);
  try{
   const params=new URLSearchParams({offset:String(pageOffset)});if(allocationId){params.set("allocationId",allocationId);params.set("source",source);}
   const response=await fetch(`/api/attendance/me?${params}`,{cache:"no-store"});if(!response.ok)throw new Error("Attendance is unavailable. Retry to refresh.");
   const data=await response.json();if(current!==requestSequence.current)return null;
   const nextItems:Item[]=data.attendance?.items;
   if(!Array.isArray(nextItems)||!Number.isInteger(data.attendance?.total)||data.attendance.total<0||nextItems.some(item=>!item||!["EVENT","SITE_SHIFT"].includes(item.source)||!item.allocation_id||!Number.isInteger(item.attendance?.revision)||item.attendance.revision<0||!Array.isArray(item.attendance.events)))throw new Error("Attendance is unavailable. Retry to refresh.");
   if(allocationId&&nextItems.some(item=>item.allocation_id!==allocationId||item.source!==source))throw new Error("This allocation is not available in your own attendance view.");
   setItems(previous=>{if(!append)return nextItems;const seen=new Set(previous.map(item=>`${item.source}:${item.allocation_id}`));return [...previous,...nextItems.filter(item=>!seen.has(`${item.source}:${item.allocation_id}`))];});
   setLoadedSelection(selection);setTotal(data.attendance?.total??0);setOffset(pageOffset);setError("");return nextItems;
  }catch(e){if(current===requestSequence.current){setItems([]);setTotal(0);setOffset(0);setNotice("");setLoadedSelection(selection);setError(e instanceof Error?e.message:"Attendance unavailable");}return null;}
  finally{if(current===requestSequence.current)setLoading(false);}
 },[allocationId,source,selection]);
 useEffect(()=>{
  const requests=requestSequence;const view=viewSequence;const mutation=mutationPending;mutation.current=false;
  const t=setTimeout(()=>{setBusy("");setNotice("");setError("");void load(0);},0);
  return()=>{clearTimeout(t);requests.current++;view.current++;mutation.current=false;};
 },[load]);
 async function act(item:Item,action:"CHECK_IN"|"CHECK_OUT"){
  const currentItem=items.find(entry=>entry.source===item.source&&entry.allocation_id===item.allocation_id&&entry.attendance.revision===item.attendance.revision);
  const canIn=currentItem?.self_action_available&&!currentItem.attendance.check_in_at&&!currentItem.attendance.events.some(event=>event.type==="NO_SHOW_RECORDED");
  const canOut=currentItem&&Boolean(currentItem.attendance.check_in_at)&&!currentItem.attendance.check_out_at&&(currentItem.self_action_available||(currentItem.source==="EVENT"&&currentItem.status==="CANCELLED"));
  if(mutationPending.current||loading||!currentItem||(action==="CHECK_IN"?!canIn:!canOut))return;
  mutationPending.current=true;
  const view=viewSequence.current;const currentView=()=>view===viewSequence.current;
  const storageKey=`kss-attendance-retry:${item.source}:${item.allocation_id}`;
  const uncertain="Attendance may have been recorded, but its current state could not be confirmed. Refresh before retrying safely.";
  const clearFacts=()=>{setItems([]);setTotal(0);setOffset(0);setNotice("");setLoadedSelection(selection);};
  const sameTime=(a:string|null,b:string|null)=>Boolean(a&&b&&Number.isFinite(Date.parse(a))&&Date.parse(a)===Date.parse(b));
  const uuid=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  let attempted=false;let rejection="";
  setBusy(`${item.source}:${item.allocation_id}`);setError("");setNotice("");
  try{
   let pending:{action:string;actualAt:string;idempotencyKey:string;expectedRevision:number}|null=null;
   try{const saved=localStorage.getItem(storageKey);if(saved){const candidate=JSON.parse(saved);if(candidate.action===action&&Number.isInteger(candidate.expectedRevision)&&candidate.expectedRevision>=0&&uuid(candidate.idempotencyKey)&&typeof candidate.actualAt==="string"&&Number.isFinite(Date.parse(candidate.actualAt)))pending=candidate;}}
   catch{/* A malformed local retry token is replaced before any request. */}
   if(!pending){pending={action,actualAt:new Date().toISOString(),idempotencyKey:crypto.randomUUID(),expectedRevision:item.attendance.revision};localStorage.setItem(storageKey,JSON.stringify(pending));}
   const submitted=pending;
   attempted=true;
   const response=await fetch(`/api/attendance/me/${item.allocation_id}?source=${item.source}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(submitted)});
   if(!currentView())return;
   const data=await response.json();if(!currentView())return;
   if(!response.ok){if([400,401,403,409].includes(response.status))rejection=data.error??"Attendance was not recorded. Refresh and retry safely.";throw new Error(rejection||uncertain);}
   const receipt=data.result;
   const attributable=(summary:Item["attendance"])=>summary&&Number.isInteger(summary.revision)&&summary.revision>=receipt.revision&&Array.isArray(summary.events)&&summary.events.some(event=>event.id===receipt.event_id&&event.revision===receipt.revision&&event.type===action&&event.actor_mode==="STAFF_SELF"&&event.method==="AUTHENTICATED_ONLINE"&&sameTime(event.actual_at,submitted.actualAt));
   if(!receipt||!uuid(receipt.event_id)||!Number.isInteger(receipt.revision)||receipt.revision!==submitted.expectedRevision+1||typeof receipt.replayed!=="boolean"||!attributable(receipt.attendance))throw new Error(uncertain);
   const exact=await fetch(`/api/attendance/me?${new URLSearchParams({offset:"0",allocationId:item.allocation_id,source:item.source})}`,{cache:"no-store"});
   if(!currentView())return;if(!exact.ok)throw new Error(uncertain);
   const checked=await exact.json();if(!currentView())return;
   const matches=(entry:Item)=>entry&&entry.source===item.source&&entry.allocation_id===item.allocation_id&&entry.attendance?.revision===receipt.attendance.revision&&attributable(entry.attendance)&&sameTime(action==="CHECK_IN"?entry.attendance.check_in_at:entry.attendance.check_out_at,action==="CHECK_IN"?receipt.attendance.check_in_at:receipt.attendance.check_out_at);
   if(!Array.isArray(checked.attendance?.items)||checked.attendance.items.length!==1||!matches(checked.attendance.items[0]))throw new Error(uncertain);
   // This exact authorised read confirms only the selected allocation, not every returned page.
   const confirmed:Item=checked.attendance.items[0];
   setItems(previous=>previous.map(entry=>entry.source===confirmed.source&&entry.allocation_id===confirmed.allocation_id?confirmed:entry));
   localStorage.removeItem(storageKey);
   setNotice(action==="CHECK_IN"?"Check-in recorded.":"Check-out recorded. This records attendance only; it does not calculate worked time.");
  }catch{if(currentView()){clearFacts();setError(!attempted?"A safe attendance retry could not be prepared. Check local browser storage before trying again.":rejection||uncertain);}}
  finally{if(currentView()){mutationPending.current=false;setBusy("");}}
 }
 const [selectedDutyKey,setSelectedDutyKey]=useState("");
 const visibleDutyKey=!allocationId&&items.some(item=>`${item.source}:${item.allocation_id}`===selectedDutyKey)?selectedDutyKey:"";
 const showItem=(item:Item)=>!visibleDutyKey||`${item.source}:${item.allocation_id}`===visibleDutyKey;
 const currentItems=items.filter(item=>item.status==="ALLOCATED"||(item.self_action_available&&!item.attendance.check_out_at)||(item.source==="EVENT"&&item.status==="CANCELLED"&&Boolean(item.attendance.check_in_at)&&!item.attendance.check_out_at));
 const historyItems=items.filter(item=>!currentItems.includes(item));
 const renderItem=(item:Item)=>{
  const canIn=item.self_action_available&&!item.attendance.check_in_at&&!item.attendance.events.some(e=>e.type==="NO_SHOW_RECORDED");const canOut=Boolean(item.attendance.check_in_at)&&!item.attendance.check_out_at&&(item.self_action_available||(item.source==="EVENT"&&item.status==="CANCELLED"));
  return <article className={styles.card} key={`${item.source}:${item.allocation_id}`}><p><span className={styles.state}>{item.source==="SITE_SHIFT"?"Site shift":"Event"}</span> <span className={styles.state}>{item.attendance.state.replaceAll("_"," ")}</span> <span className={styles.state}>Your response: {item.status.replaceAll("_"," ")}</span></p><h2>{item.event_name}</h2><p>{item.site_name} · {item.role_name}{item.area_label?` · ${item.area_label}`:""}</p>
   <section className={styles.scheduled} aria-label="Scheduled duty context"><h3>Scheduled duty</h3><dl className={styles.facts}><div><dt>Reporting point</dt><dd>{item.reporting_point||"Not specified"}</dd></div><div><dt>Report time · London</dt><dd>{time(item.report_at)}</dd></div><div><dt>Scheduled shift · London</dt><dd>{time(item.shift_starts_at)} – {time(item.shift_ends_at)}</dd></div></dl></section>
   <div className={styles.actionBlock}>
   {canIn&&<Button className={styles.action} disabled={Boolean(busy)} onClick={()=>void act(item,"CHECK_IN")}>{busy===`${item.source}:${item.allocation_id}`?"Recording…":"Check In"}</Button>}{canOut&&<Button className={styles.action} disabled={Boolean(busy)} onClick={()=>void act(item,"CHECK_OUT")}>{busy===`${item.source}:${item.allocation_id}`?"Recording…":"Check Out"}</Button>}
   {item.status==="ALLOCATED"&&!item.attendance.check_in_at&&<p className={styles.muted}>Respond to this allocation in <Link href={`/my-deployments?allocationId=${encodeURIComponent(item.allocation_id)}${item.source==="SITE_SHIFT"?"&source=SITE_SHIFT":""}`}>My Deployments</Link> before self check-in.</p>}
   {item.source==="SITE_SHIFT"&&item.status==="ACCEPTED"&&!item.self_action_available&&<p className={styles.muted}>This Site shift is no longer active for self check-in or check-out. Your attendance history remains available for manager review.</p>}
   </div><section className={styles.actual} aria-label="Recorded attendance"><h3>Recorded attendance</h3><dl className={styles.facts}><div><dt>Actual check-in</dt><dd>{time(item.attendance.check_in_at)}</dd></div>{item.attendance.check_in_at&&<div><dt>Actual check-out</dt><dd>{time(item.attendance.check_out_at)}</dd></div>}</dl></section>
   {item.attendance.events.length>0&&<details className={styles.events}><summary>Attendance history</summary>{item.attendance.events.map(e=><div className={styles.event} key={e.id}><span><strong>{e.type.replaceAll("_"," ")}</strong>{e.reason?` · ${e.reason}`:""}</span><span className={styles.muted}>{time(e.effective_actual_at??e.recorded_at)} · {e.actor_name}</span></div>)}</details>}
  </article>;
 };
 return <section className={styles.wrap}>
  <header className={styles.heading}><p className="enterprise-eyebrow">Your attendance · Event and Site shift work</p><h1>My Attendance</h1><p>Record your own attendance for accepted work. Times use Europe/London; attendance does not calculate worked or payable time.</p></header>
  {notice&&<p role="status" className={styles.success}>{notice}</p>}{error&&<p role="alert" className={styles.error}>{error} <Button variant="outline" disabled={Boolean(busy)||loading} onClick={()=>void load(0)}>Refresh</Button></p>}
  {!loading&&allocationId&&items.length>0&&<p className={styles.focusNotice}>Showing the selected {source==="SITE_SHIFT"?"Site shift":"Event"} allocation. <Link href="/my-attendance">Show all my attendance</Link></p>}
  {!loading&&!error&&allocationId&&items.length===0&&<p className={styles.empty}>This allocation is not available in your own attendance view.</p>}
  {!loading&&!allocationId&&total>0&&<p className={styles.pageCount} aria-live="polite">Showing {items.length} of {total}</p>}
  {!loading&&!allocationId&&items.length>1&&<label className={styles.selector}>Choose an allocation from this returned list<select value={visibleDutyKey} onChange={(event)=>setSelectedDutyKey(event.target.value)}><option value="">All returned allocations</option>{items.map(item=><option key={`${item.source}:${item.allocation_id}`} value={`${item.source}:${item.allocation_id}`}>{item.source==="SITE_SHIFT"?"Site shift":"Event"} · {item.event_name} · {item.role_name} · {time(item.report_at)}</option>)}</select></label>}
  {loading?<p role="status">Loading your attendance…</p>:!error&&!allocationId&&items.length===0?<p className={styles.empty}>No allocations are available.</p>:<>
   {currentItems.some(showItem)&&<section className={styles.group} aria-label="Current allocations"><h2>Current allocations</h2>{currentItems.filter(showItem).map(renderItem)}</section>}
   {historyItems.some(showItem)&&<details className={styles.historyGroup} open={Boolean(visibleDutyKey)||Boolean(allocationId)}><summary>Attendance history · {historyItems.filter(showItem).length} returned</summary><div className={styles.group}>{historyItems.filter(showItem).map(renderItem)}</div></details>}
  </>}
  {!loading&&!allocationId&&items.length>0&&items.length<total&&<nav className={styles.pagination} aria-label="Attendance history"><Button variant="outline" disabled={loading||Boolean(busy)} onClick={()=>void load(offset+PAGE_SIZE,true)}>Load more attendance</Button></nav>}
 </section>;
}
