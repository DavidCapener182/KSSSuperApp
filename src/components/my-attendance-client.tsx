"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./attendance.module.css";

type Item = { allocation_id:string; status:string; service_date:string; report_at:string; shift_starts_at:string; shift_ends_at:string; area_label:string; role_name:string; event_name:string; site_name:string; reporting_point:string|null; attendance:{revision:number;state:string;check_in_at:string|null;check_out_at:string|null;events:{id:string;type:string;actual_at:string|null;effective_actual_at:string|null;recorded_at:string;actor_name:string;reason:string|null}[]} };
const PAGE_SIZE=25;
const time=(value:string|null)=>value?new Date(value).toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"Not recorded";

export function MyAttendanceClient({allocationId}:{allocationId?:string}){
 const [items,setItems]=useState<Item[]>([]);const [total,setTotal]=useState(0);const [offset,setOffset]=useState(0);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const load=useCallback(async(pageOffset:number,append=false)=>{setLoading(true);try{const params=new URLSearchParams({offset:String(pageOffset)});if(allocationId)params.set("allocationId",allocationId);const response=await fetch(`/api/attendance/me?${params}`,{cache:"no-store"});if(!response.ok)throw new Error("Attendance is unavailable. Retry to refresh.");const data=await response.json();const nextItems:Item[]=data.attendance?.items??[];setItems(current=>{if(!append)return nextItems;const seen=new Set(current.map(item=>item.allocation_id));return [...current,...nextItems.filter(item=>!seen.has(item.allocation_id))];});setTotal(data.attendance?.total??0);setOffset(pageOffset);setError("");}catch(e){setError(e instanceof Error?e.message:"Attendance unavailable");}finally{setLoading(false);}},[allocationId]);
 useEffect(()=>{const t=setTimeout(()=>void load(0),0);return()=>clearTimeout(t);},[load]);
 async function act(item:Item,action:"CHECK_IN"|"CHECK_OUT"){
  setBusy(item.allocation_id);setError("");setNotice("");const storageKey=`kss-attendance-retry:${item.allocation_id}`;
  let pending:{action:string;actualAt:string;idempotencyKey:string;expectedRevision:number}|null=null;
  try{const saved=localStorage.getItem(storageKey);if(saved){const candidate=JSON.parse(saved);if(candidate.action===action)pending=candidate;}}
  catch{/* A malformed local retry token is discarded below. */}
  if(!pending){pending={action,actualAt:new Date().toISOString(),idempotencyKey:crypto.randomUUID(),expectedRevision:item.attendance.revision};localStorage.setItem(storageKey,JSON.stringify(pending));}
  try{const response=await fetch(`/api/attendance/me/${item.allocation_id}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(pending)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error??"Attendance was not recorded. Retry safely.");localStorage.removeItem(storageKey);setNotice(action==="CHECK_IN"?"Check-in recorded.":"Check-out recorded. This records attendance only; it does not calculate worked time.");await load(0);}
  catch(e){setError(e instanceof Error?e.message:"Attendance was NOT recorded. Check your connection and retry safely.");}
  finally{setBusy("");}
 }
 const currentItems=items.filter(item=>item.status==="ALLOCATED"||(item.status==="ACCEPTED"&&!item.attendance.check_out_at)||(item.status==="CANCELLED"&&Boolean(item.attendance.check_in_at)&&!item.attendance.check_out_at));
 const historyItems=items.filter(item=>!currentItems.includes(item));
 const renderItem=(item:Item)=>{
  const canIn=item.status==="ACCEPTED"&&!item.attendance.check_in_at&&!item.attendance.events.some(e=>e.type==="NO_SHOW_RECORDED");const canOut=Boolean(item.attendance.check_in_at)&&!item.attendance.check_out_at&&["ACCEPTED","CANCELLED"].includes(item.status);
  return <article className={styles.card} key={item.allocation_id}><p><span className={styles.state}>{item.attendance.state.replaceAll("_"," ")}</span> <span className={styles.state}>Your response: {item.status.replaceAll("_"," ")}</span></p><h2>{item.event_name}</h2><p>{item.site_name} · {item.role_name}{item.area_label?` · ${item.area_label}`:""}</p>
   <dl className={styles.facts}><div><dt>Reporting point</dt><dd>{item.reporting_point||"Not specified"}</dd></div><div><dt>Report time · London</dt><dd>{time(item.report_at)}</dd></div><div><dt>Scheduled shift · London</dt><dd>{time(item.shift_starts_at)} – {time(item.shift_ends_at)}</dd></div><div><dt>Actual check-in</dt><dd>{time(item.attendance.check_in_at)}</dd></div>{item.attendance.check_in_at&&<div><dt>Actual check-out</dt><dd>{time(item.attendance.check_out_at)}</dd></div>}</dl>
   {canIn&&<Button className={styles.action} disabled={Boolean(busy)} onClick={()=>void act(item,"CHECK_IN")}>{busy===item.allocation_id?"Recording…":"Check In"}</Button>}{canOut&&<Button className={styles.action} disabled={Boolean(busy)} onClick={()=>void act(item,"CHECK_OUT")}>{busy===item.allocation_id?"Recording…":"Check Out"}</Button>}
   {item.status==="ALLOCATED"&&!item.attendance.check_in_at&&<p className={styles.muted}>Accept this allocation in My Deployments before self check-in.</p>}
   {item.attendance.events.length>0&&<details className={styles.events}><summary>Attendance history</summary>{item.attendance.events.map(e=><div className={styles.event} key={e.id}><span><strong>{e.type.replaceAll("_"," ")}</strong>{e.reason?` · ${e.reason}`:""}</span><span className={styles.muted}>{time(e.effective_actual_at??e.recorded_at)} · {e.actor_name}</span></div>)}</details>}
  </article>;
 };
 return <section className={styles.wrap}>
  <header className={styles.heading}><p className="enterprise-eyebrow">Your attendance · Event work</p><h1>My Attendance</h1><p>Record your own attendance for accepted Event allocations. Times use Europe/London; attendance does not calculate worked or payable time.</p></header>
  {notice&&<p role="status" className={styles.success}>{notice}</p>}{error&&<p role="alert" className={styles.error}>{error} <Button variant="outline" onClick={()=>void load(0)}>Refresh</Button></p>}
  {!loading&&allocationId&&items.length>0&&<p className={styles.focusNotice}>Showing the selected Event allocation. <Link href="/my-attendance">Show all my attendance</Link></p>}
  {!loading&&allocationId&&items.length===0&&<p className={styles.empty}>This Event allocation is not available in your own attendance view.</p>}
  {!loading&&!allocationId&&total>0&&<p className={styles.pageCount} aria-live="polite">Showing {items.length} of {total}</p>}
  {loading?<p role="status">Loading your attendance…</p>:!allocationId&&items.length===0?<p className={styles.empty}>No Event allocations are available.</p>:<>
   {currentItems.length>0&&<section className={styles.group} aria-label="Current allocations"><h2>Current allocations</h2>{currentItems.map(renderItem)}</section>}
   {historyItems.length>0&&<section className={styles.group} aria-label="Attendance history"><h2>Attendance history</h2>{historyItems.map(renderItem)}</section>}
  </>}
  {!loading&&!allocationId&&items.length>0&&items.length<total&&<nav className={styles.pagination} aria-label="Attendance history"><Button variant="outline" disabled={loading} onClick={()=>void load(offset+PAGE_SIZE,true)}>Load more attendance</Button></nav>}
 </section>;
}
