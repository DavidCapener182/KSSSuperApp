"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./attendance.module.css";

type Fact = {id:string;revision:number;type:string;actual_at:string|null;effective_actual_at:string|null;recorded_at:string;actor_name:string;reason:string|null;correction_code:string|null;corrects_event_id:string|null};
type Row = {allocation_id:string;demand_id:string;service_id:string;service_name:string;service_state:string;demand_state:string;person_name:string;status:string;service_date:string;report_at:string;shift_starts_at:string;shift_ends_at:string;area_label:string;role_name:string;site_name:string;reporting_point:string|null;attendance:{revision:number;state:string;check_in_at:string|null;check_out_at:string|null;no_show_recorded:boolean;review_required:boolean;events:Fact[]}};
const london = (value:string|null) => value ? new Date(value).toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "Not recorded";
const londonInput=(value:string)=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;};
function londonInstant(value:string){const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);if(!m)return null;const wall=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]));const matches=[0,60].map(offset=>new Date(wall-offset*60000)).filter(d=>londonInput(d.toISOString())===value);return matches.length===1?matches[0].toISOString():null;}

export function SiteAttendanceClient({siteId,serviceId,demandId}:{siteId:string;serviceId:string;demandId?:string}){
  const [rows,setRows]=useState<Row[]>([]);const [total,setTotal]=useState(0);const [offset,setOffset]=useState(0);
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const [notes,setNotes]=useState<Record<string,string>>({});const [correctionDrafts,setCorrectionDrafts]=useState<Record<string,{eventId:string;local:string}>>({});
  const base=`/api/site-services/${serviceId}/attendance`;
  const load=useCallback(async(page=0)=>{setLoading(true);try{const q=new URLSearchParams({offset:String(page)});if(demandId)q.set("demandId",demandId);const response=await fetch(`${base}?${q}`,{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error??"Attendance unavailable");setRows(body.attendance?.items??[]);setTotal(body.attendance?.total??0);setOffset(page);setError("");}catch(caught){setError(caught instanceof Error?caught.message:"Attendance unavailable");}finally{setLoading(false);}},[base,demandId]);
  useEffect(()=>{const t=setTimeout(()=>void load(),0);return()=>clearTimeout(t);},[load]);
  async function submit(row:Row,action:string,targetEventId?:string,actualAt?:string){
    const reason=notes[row.allocation_id]?.trim()??"";
    const reasoned=!["CHECK_IN","CHECK_OUT"].includes(action);
    if(reasoned&&(reason.length<3||reason.length>300)){setError("Enter a short operational reason before recording this fact.");return;}
    const key=`kss-site-attendance-retry:${row.allocation_id}:${action}:${targetEventId??""}`;
    let payload:{allocationId:string;action:string;actualAt:string|null;reasonCode:string|null;reason:string|null;targetEventId:string|null;expectedRevision:number;idempotencyKey:string};
    try{const saved=localStorage.getItem(key);const previous=saved?JSON.parse(saved):null;
      if(previous?.reason===reason&&previous?.action===action)payload=previous;
      else throw new Error("new");}
    catch{payload={allocationId:row.allocation_id,action,actualAt:actualAt??(["CHECK_IN","CHECK_OUT","RESOLVE_NO_SHOW_FOR_CHECK_IN"].includes(action)?new Date().toISOString():null),
      reasonCode:action==="NO_SHOW_RECORDED"?"NO_SHOW":action==="EXCUSED_ABSENCE_RECORDED"?"EXCUSED":action==="CHECK_IN_NOT_POSSIBLE"?"CHECK_IN_NOT_POSSIBLE":action==="REVIEW_REQUIRED"?"OTHER":null,
      reason:reasoned?reason:null,targetEventId:targetEventId??null,expectedRevision:row.attendance.revision,idempotencyKey:crypto.randomUUID()};localStorage.setItem(key,JSON.stringify(payload));}
    setBusy(row.allocation_id);setError("");setNotice("");
    try{const response=await fetch(base,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error??"Attendance was not recorded. Refresh and retry safely.");localStorage.removeItem(key);setNotice("Attendance fact recorded with your identity.");await load(offset);}
    catch(caught){setError(caught instanceof Error?caught.message:"Attendance was not recorded.");}
    finally{setBusy("");}
  }
  return <main className="enterprise-main"><section className={styles.wrap}>
    <header className={styles.heading}><p className="enterprise-eyebrow">Ongoing Site shift · factual attendance</p><h1>Site shift attendance</h1><p>Observed attendance is separate from scheduled, worked and payable time. Times use Europe/London.</p><p><Link href={`/sites/${siteId}/services/${serviceId}`}>← Site Service</Link></p></header>
    {notice&&<p role="status" className={styles.success}>{notice}</p>}{error&&<p role="alert" className={styles.error}>{error} <Button variant="outline" onClick={()=>void load(offset)}>Refresh</Button></p>}
    {loading?<p role="status">Loading attendance…</p>:rows.length===0?<p className={styles.empty}>No named allocations with attendance in this selection.</p>:rows.map(row=>{
      const noShow=row.attendance.events.find(e=>e.type==="NO_SHOW_RECORDED"&&!row.attendance.events.some(x=>x.corrects_event_id===e.id&&x.correction_code==="RESOLVE_NO_SHOW_FOR_CHECK_IN"));
      const review=row.attendance.events.find(e=>e.type==="REVIEW_REQUIRED"&&!row.attendance.events.some(x=>x.corrects_event_id===e.id&&x.correction_code==="RESOLVE_CANCELLED_ALLOCATION_REVIEW"));
      const active=row.status!=="CANCELLED";const reasonReady=(notes[row.allocation_id]?.trim().length??0)>=3;
      return <article className={styles.card} key={row.allocation_id}>
        <p><span className={styles.state}>{row.attendance.state.replaceAll("_"," ")}</span> <span className={styles.state}>{row.status}</span></p>
        <h2>{row.person_name}</h2><p>{row.service_name} · {row.site_name} · {row.role_name}{row.area_label?` · ${row.area_label}`:""}</p>
        <p className={styles.muted}>Demand {row.service_date} · {row.demand_state} · Service {row.service_state}</p>
        <dl className={styles.facts}><div><dt>Reporting point</dt><dd>{row.reporting_point||"Not specified"}</dd></div><div><dt>Report · London</dt><dd>{london(row.report_at)}</dd></div><div><dt>Scheduled shift · London</dt><dd>{london(row.shift_starts_at)} – {london(row.shift_ends_at)}</dd></div><div><dt>Actual check-in</dt><dd>{london(row.attendance.check_in_at)}</dd></div><div><dt>Actual check-out</dt><dd>{london(row.attendance.check_out_at)}</dd></div></dl>
        <label className={styles.muted}>Operational reason · avoid sensitive personal details<input maxLength={300} value={notes[row.allocation_id]??""} onChange={e=>setNotes({...notes,[row.allocation_id]:e.target.value})}/></label>
        <div className={styles.actions}>
          {!row.attendance.check_in_at&&active&&<><Button disabled={Boolean(busy)} onClick={()=>void submit(row,"CHECK_IN")}>Record observed check-in</Button><Button variant="outline" disabled={Boolean(busy)||!reasonReady||row.attendance.no_show_recorded} onClick={()=>void submit(row,"NO_SHOW_RECORDED")}>Record no-show</Button><Button variant="outline" disabled={Boolean(busy)||!reasonReady} onClick={()=>void submit(row,"EXCUSED_ABSENCE_RECORDED")}>Record excused absence</Button><Button variant="outline" disabled={Boolean(busy)||!reasonReady} onClick={()=>void submit(row,"CHECK_IN_NOT_POSSIBLE")}>Check-in not possible</Button></>}
          {row.attendance.check_in_at&&!row.attendance.check_out_at&&<Button disabled={Boolean(busy)} onClick={()=>void submit(row,"CHECK_OUT")}>Record observed check-out</Button>}
          {noShow&&active&&<Button disabled={Boolean(busy)||!reasonReady} onClick={()=>void submit(row,"RESOLVE_NO_SHOW_FOR_CHECK_IN",noShow.id)}>Resolve no-show and record observed check-in</Button>}
          {review&&row.status==="CANCELLED"&&<Button variant="outline" disabled={Boolean(busy)||!reasonReady} onClick={()=>void submit(row,"RESOLVE_CANCELLED_ALLOCATION_REVIEW",review.id)}>Resolve cancellation review</Button>}
        </div>
        {row.attendance.events.length>0&&<div className={styles.events}><h3>Factual history</h3>{row.attendance.events.map(fact=><div className={styles.event} key={fact.id}><span><strong>{fact.type.replaceAll("_"," ")}</strong>{fact.reason?` · ${fact.reason}`:""}</span><span className={styles.muted}>{london(fact.effective_actual_at??fact.recorded_at)} · {fact.actor_name}</span>{["CHECK_IN","CHECK_OUT"].includes(fact.type)&&!row.attendance.events.some(x=>x.corrects_event_id===fact.id)&&<div><Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={()=>setCorrectionDrafts({...correctionDrafts,[row.allocation_id]:{eventId:fact.id,local:londonInput(fact.effective_actual_at??fact.actual_at??fact.recorded_at)}})}>Correct actual time</Button>{correctionDrafts[row.allocation_id]?.eventId===fact.id&&<div className={styles.actions}><label>Correct actual time · London<input type="datetime-local" value={correctionDrafts[row.allocation_id].local} onChange={e=>setCorrectionDrafts({...correctionDrafts,[row.allocation_id]:{eventId:fact.id,local:e.target.value}})}/></label><Button disabled={Boolean(busy)||!reasonReady||!londonInstant(correctionDrafts[row.allocation_id].local)} onClick={()=>{const instant=londonInstant(correctionDrafts[row.allocation_id].local);if(instant)void submit(row,"CORRECT_TIMESTAMP",fact.id,instant);}}>Save correction</Button></div>}</div>}</div>)}</div>}
      </article>;
    })}
    {total>100&&<nav className={styles.pagination} aria-label="Site attendance pages"><Button variant="outline" disabled={offset===0||loading} onClick={()=>void load(Math.max(0,offset-100))}>Previous</Button><span>{offset+1}–{Math.min(offset+100,total)} of {total}</span><Button variant="outline" disabled={offset+100>=total||loading} onClick={()=>void load(offset+100)}>Next</Button></nav>}
  </section></main>;
}
