"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { londonDueToIso } from "@/lib/crm/due-time";
import { addCivilDays } from "@/lib/events/workforce-week";
import s from "./workforce-planner.module.css";

type Duty = { source:"EVENT"|"SITE_SHIFT";requirement_id:string;event_id:string|null;service_id:string|null;site_id:string;service_date:string;report_at:string;shift_starts_at:string;shift_ends_at:string;allocated:number;remaining:number };
type Allocation = { id:string;person_name:string;status:string;revision:number };
type Candidate = { id:string;display_name:string;check:{result:string;availability:string;reasons:string[]} };
type Source = { revision:number;roleId:string;quantity:number;area:string;instructions:string;reportAt:string;startAt:string;endAt:string;allocations:Allocation[];remaining:number };
const local=(value:string)=>{const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value)).map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;};
async function request(path:string,init?:RequestInit){const response=await fetch(path,{...init,cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error??"The source action was denied");return data;}
const json=(body:unknown,method="POST"):RequestInit=>({method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});

export function WorkforceDutyActions({duty,onChanged}:{duty:Duty;onChanged:()=>Promise<boolean>}) {
  const [source,setSource]=useState<Source|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [search,setSearch]=useState("");
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [selected,setSelected]=useState<Candidate|null>(null);
  const [ack,setAck]=useState(false);
  const [reason,setReason]=useState("");
  const [timeEditing,setTimeEditing]=useState(false);
  const [reportLocal,setReportLocal]=useState(local(duty.report_at));
  const [startLocal,setStartLocal]=useState(local(duty.shift_starts_at));
  const [endLocal,setEndLocal]=useState(local(duty.shift_ends_at));
  const [cancel,setCancel]=useState<Allocation|null>(null);
  const eventBase=`/api/events/${duty.event_id}/staffing-requirements/${duty.requirement_id}`;
  const siteBase=`/api/site-services/${duty.service_id}`;
  const readSource=useCallback(async():Promise<Source>=>{
    if(duty.source==="EVENT"){
      const [plan,detail]=await Promise.all([request(`/api/events/${duty.event_id}/staffing-requirements`),request(`${eventBase}/allocations`)]);
      const line=plan.plan?.items?.find((item:{id:string})=>item.id===duty.requirement_id);
      if(!line||line.state!=="PLANNED")throw new Error("The exact Event requirement is no longer planned. Refresh Workforce.");
      return {revision:line.revision,roleId:line.role_id,quantity:line.required_quantity,area:line.area_label,instructions:line.instructions??"",reportAt:line.report_at,startAt:line.shift_starts_at,endAt:line.shift_ends_at,allocations:detail.deployment?.allocations??[],remaining:detail.deployment?.remaining??0};
    }
    const [detail,allocations]=await Promise.all([request(`${siteBase}?site=${duty.site_id}&from=${duty.service_date}&until=${addCivilDays(duty.service_date,1)}`),request(siteBase,json({action:"allocations",demandId:duty.requirement_id}))]);
    const line=detail.detail?.demands?.find((item:{id:string})=>item.id===duty.requirement_id);
    if(!line||line.state!=="PLANNED")throw new Error("The exact Site Shift demand is no longer planned. Refresh Workforce.");
    return {revision:line.revision,roleId:line.role_id,quantity:line.required_quantity,area:line.area_label,instructions:"",reportAt:line.report_at,startAt:line.shift_starts_at,endAt:line.shift_ends_at,allocations:allocations.result?.allocations??[],remaining:allocations.result?.remaining??0};
  },[duty.source,duty.event_id,duty.requirement_id,duty.site_id,duty.service_date,eventBase,siteBase]);
  const refresh=useCallback(async()=>{setLoading(true);setError("");try{const current=await readSource();setSource(current);setReportLocal(local(current.reportAt));setStartLocal(local(current.startAt));setEndLocal(local(current.endAt));return current;}catch(caught){setSource(null);setError(caught instanceof Error?caught.message:"The exact source could not be read");return null;}finally{setLoading(false);}},[readSource]);
  useEffect(()=>{const timer=setTimeout(()=>void refresh(),0);return()=>clearTimeout(timer);},[refresh]);
  async function findCandidates(event:React.FormEvent){event.preventDefault();setError("");try{const result=duty.source==="EVENT"?await request(`${eventBase}/candidates?search=${encodeURIComponent(search)}&offset=0`):await request(siteBase,json({action:"candidates",demandId:duty.requirement_id,search,offset:0}));setCandidates((duty.source==="EVENT"?result.candidates:result.result)?.items??[]);setSelected(null);}catch(caught){setCandidates([]);setError(caught instanceof Error?caught.message:"Candidate search unavailable");}}
  async function allocate(){if(!source||!selected)return;setBusy(true);setError("");setNotice("");try{
    const payload={personId:selected.id,expectedRevision:source.revision,acknowledgeWarnings:ack,reason:reason.trim()||null};
    const response=duty.source==="EVENT"?await request(`${eventBase}/allocations`,json(payload)):await request(siteBase,json({action:"allocate",demandId:duty.requirement_id,...payload}));
    const allocationId=duty.source==="EVENT"?response.id:response.result;
    const current=await readSource();if(!current.allocations.some(item=>item.id===allocationId&&["ALLOCATED","ACCEPTED"].includes(item.status)))throw new Error("Allocation was sent, but its exact source status could not be confirmed. Refresh before another action.");
    if(!await onChanged())throw new Error("Allocation was accepted by its source, but Workforce could not be refreshed. Refresh before another action.");
    setSource(current);setSelected(null);setCandidates([]);setAck(false);setReason("");setNotice("Allocation confirmed by the source and refreshed Workforce read. Staff response is still separate.");
  }catch(caught){setError(caught instanceof Error?caught.message:"Allocation denied");}finally{setBusy(false);}}
  async function cancelAllocation(){if(!cancel)return;setBusy(true);setError("");setNotice("");try{
    if(duty.source==="EVENT")await request(`${eventBase}/allocations/${cancel.id}`,json({action:"CANCEL",expectedRevision:cancel.revision,reason:reason.trim()},"PATCH"));
    else await request(siteBase,json({action:"cancelAllocation",demandId:duty.requirement_id,allocationId:cancel.id,expectedRevision:cancel.revision,reason:reason.trim()}));
    const current=await readSource();if(current.allocations.some(item=>item.id===cancel.id&&["ALLOCATED","ACCEPTED"].includes(item.status)))throw new Error("Cancellation was sent, but its source state could not be confirmed.");
    if(!await onChanged())throw new Error("Cancellation was accepted by its source, but Workforce could not be refreshed.");
    setSource(current);setCancel(null);setReason("");setNotice("Cancellation confirmed by the source and refreshed Workforce read.");
  }catch(caught){setError(caught instanceof Error?caught.message:"Cancellation denied");}finally{setBusy(false);}}
  async function saveTimes(event:React.FormEvent){event.preventDefault();if(!source)return;setBusy(true);setError("");setNotice("");try{
    if(source.allocations.some(item=>["ALLOCATED","ACCEPTED"].includes(item.status)))throw new Error("Active allocations must be reconciled before changing this duty's times.");
    const report=londonDueToIso(reportLocal),start=londonDueToIso(startLocal),end=londonDueToIso(endLocal);
    if(!report||!start||!end||Date.parse(report)>Date.parse(start)||Date.parse(start)>=Date.parse(end))throw new Error("Enter valid, unambiguous London times in report, start, end order.");
    if(duty.source==="EVENT")await request(eventBase,json({action:"AMEND",expectedRevision:source.revision,roleId:source.roleId,quantity:source.quantity,area:source.area,instructions:source.instructions,reportLocal,startLocal,endLocal,reason:reason.trim(),confirmException:true,confirmDuplicate:false},"PATCH"));
    else await request(siteBase,json({action:"amend",demandId:duty.requirement_id,expectedRevision:source.revision,kind:"CHANGE_TIME",reportAt:report,shiftStartsAt:start,shiftEndsAt:end,reason:reason.trim()}));
    const current=await readSource();if(current.revision<=source.revision||Date.parse(current.reportAt)!==Date.parse(report)||Date.parse(current.startAt)!==Date.parse(start)||Date.parse(current.endAt)!==Date.parse(end))throw new Error("Time change was sent, but the exact source revision and times could not be confirmed.");
    if(!await onChanged())throw new Error("Time change was accepted by its source, but Workforce could not be refreshed.");
    setSource(current);setTimeEditing(false);setReason("");setNotice("New times confirmed by source revision and refreshed Workforce read.");
  }catch(caught){setError(caught instanceof Error?caught.message:"Time change denied");}finally{setBusy(false);}}
  return <section className={s.inlineActions} aria-label="Manage exact duty here">
    <h3>Manage this duty</h3><p>Actions stay on Workforce. The Event or Site Shift source still checks authority, revision, capacity and conflicts.</p>
    {error&&<p role="alert" className={s.error}>{error} <Button variant="outline" onClick={()=>void refresh()}>Reload exact source</Button></p>}
    {notice&&<p role="status" className={s.actionNotice}>{notice}</p>}
    {loading?<p role="status">Reading exact source and revision…</p>:source&&<>
      {source.remaining>0&&<><h4>Assign a person · {source.remaining} open</h4><form onSubmit={event=>void findCandidates(event)} className={s.actionForm}><label>Search Security Staff<input value={search} maxLength={80} onChange={event=>setSearch(event.target.value)} /></label><Button type="submit" variant="outline" disabled={busy}>Find candidates</Button></form>
        {candidates.map(person=><div className={s.candidateRow} key={person.id}><div><strong>{person.display_name}</strong><small>{person.check.result.replaceAll("_"," ")} · {person.check.availability}</small><small>{person.check.reasons.join(" · ").replaceAll("_"," ")}</small></div><Button variant="outline" disabled={busy||person.check.result==="BLOCKED"} onClick={()=>{setSelected(person);setAck(false);setReason("");}}>Select</Button></div>)}
        {selected&&<div className={s.actionConfirm}><strong>Allocate {selected.display_name}?</strong><p>{selected.check.reasons.join(" · ").replaceAll("_"," ")}</p>{selected.check.result==="REVIEW_REQUIRED"&&<label><input type="checkbox" checked={ack} onChange={event=>setAck(event.target.checked)} /> I reviewed these warnings</label>}<label>Reason for warnings<textarea value={reason} maxLength={300} onChange={event=>setReason(event.target.value)} /></label><Button disabled={busy||selected.check.result==="REVIEW_REQUIRED"&&(!ack||reason.trim().length<3)} onClick={()=>void allocate()}>Assign person</Button></div>}
      </>}
      <h4>Current allocations</h4>{source.allocations.filter(item=>["ALLOCATED","ACCEPTED"].includes(item.status)).length?source.allocations.filter(item=>["ALLOCATED","ACCEPTED"].includes(item.status)).map(item=><div key={item.id} className={s.candidateRow}><span>{item.person_name} · {item.status==="ACCEPTED"?"Accepted":"Awaiting response"}</span><Button variant="outline" disabled={busy} onClick={()=>{setCancel(item);setReason("");setSelected(null);}}>Cancel allocation</Button></div>):<p>No active allocation on this duty.</p>}
      {cancel&&<div className={s.actionConfirm}><strong>Cancel {cancel.person_name}&apos;s allocation?</strong><p>This releases capacity. History remains at the source.</p><label>Reason<textarea value={reason} maxLength={300} onChange={event=>setReason(event.target.value)} /></label><Button variant="outline" onClick={()=>setCancel(null)}>Keep allocation</Button><Button disabled={busy||reason.trim().length<3} onClick={()=>void cancelAllocation()}>Confirm cancellation</Button></div>}
      <h4>Update duty times</h4>{source.allocations.some(item=>["ALLOCATED","ACCEPTED"].includes(item.status))?<p>Active allocations must be reconciled first. Cancel them deliberately above before changing the whole requirement&apos;s times.</p>:<><Button variant="outline" onClick={()=>{setTimeEditing(!timeEditing);setReason("");}}>{timeEditing?"Close time editor":"Edit report and shift times"}</Button>{timeEditing&&<form onSubmit={event=>void saveTimes(event)} className={s.timeForm}><label>Report · London<input type="datetime-local" required value={reportLocal} onChange={event=>setReportLocal(event.target.value)} /></label><label>Start · London<input type="datetime-local" required value={startLocal} onChange={event=>setStartLocal(event.target.value)} /></label><label>End · London<input type="datetime-local" required value={endLocal} onChange={event=>setEndLocal(event.target.value)} /></label><label>Reason<textarea required minLength={3} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} /></label><Button disabled={busy||reason.trim().length<3}>Save times</Button></form>}</>}
    </>}
  </section>;
}
