"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCivilDays, londonToday, londonWeekStart } from "@/lib/events/workforce-week";
import { londonDueToIso } from "@/lib/crm/due-time";
import { LeaveReconciliation } from "@/components/leave-reconciliation";
import journey from "./commercial-journey.module.css";

type Service = { id:string;name:string;type:string;state:string;effective_from:string;effective_until:string|null;
  revision:number;client_name:string;site_name:string };
type Template = { id:string;line_id:string;version:number;effective_from:string;effective_until:string|null;
  weekdays:number[];role_id:string;role_name:string;required_quantity:number;report_time:string;shift_start_time:string;
  shift_end_time:string;area_label:string;reporting_point:string };
type Demand = { id:string;service_date:string;role_id:string;role_name:string;required_quantity:number;
  report_at:string;shift_starts_at:string;shift_ends_at:string;area_label:string;reporting_point:string;
  state:string;origin:string;revision:number;allocated:number;accepted:number };
type Detail = { service:Service;templates:Template[];demands:Demand[];pauses:{id:string;starts_on:string;ends_before:string}[] };
type Role = { id:string;code:string;display_name:string };
type Candidate = { id:string;display_name:string;check:{result:string;availability:string;reasons:string[]} };
type Allocation = { id:string;person_name:string;status:string;revision:number };
const weekdays=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const time=(value:string)=>new Date(value).toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const dateInput=(day:string,clock:string)=>`${day}T${clock}`;
async function read(url:string,init?:RequestInit){const response=await fetch(url,{...init,cache:"no-store"});const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error??"Service unavailable");return data;}

export function SiteServiceDetailClient({siteId,serviceId,canAdmin,initialDemandId}:{siteId:string;serviceId:string;canAdmin:boolean;initialDemandId?:string}){
 const [week,setWeek]=useState(()=>londonWeekStart(londonToday())!);const [detail,setDetail]=useState<Detail|null>(null);
 const [roles,setRoles]=useState<Role[]>([]);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [reason,setReason]=useState("");const [effectiveOn,setEffectiveOn]=useState(londonToday());const [resumeOn,setResumeOn]=useState(addCivilDays(londonToday(),7));
 const [lineId,setLineId]=useState("");const [days,setDays]=useState([1,2,3,4,5,6,7]);const [roleId,setRoleId]=useState("");
 const [quantity,setQuantity]=useState(1);const [reportTime,setReportTime]=useState("06:00");const [startTime,setStartTime]=useState("06:00");
 const [endTime,setEndTime]=useState("18:00");const [area,setArea]=useState("Gatehouse");const [reporting,setReporting]=useState("Main gate");
 const [selected,setSelected]=useState<string|null>(null);const [allocations,setAllocations]=useState<Allocation[]>([]);
 const [search,setSearch]=useState("");const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [warningReason,setWarningReason]=useState("");const [exceptionQuantity,setExceptionQuantity]=useState(1);
 const [history,setHistory]=useState<{source:string;kind:string;record_id:string;revision:number;occurred_at:string;actor_name:string;reason:string|null}[]>([]);
 const api=`/api/site-services/${serviceId}`;
 const load=useCallback(async():Promise<Detail|null>=>{setLoading(true);setError("");try{const [response,roleResponse]=await Promise.all([
   read(`${api}?site=${siteId}&from=${week}&until=${addCivilDays(week,7)}`),
   read("/api/events/staffing-roles")]);setDetail(response.detail);setRoles(roleResponse.roles??[]);
   if(initialDemandId&&response.detail?.demands?.some((demand:Demand)=>demand.id===initialDemandId)){
    const allocationResponse=await read(api,{method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({action:"allocations",demandId:initialDemandId})});
    setSelected(initialDemandId);setAllocations(allocationResponse.result?.allocations??[]);
   }
   return response.detail as Detail;
  }catch(caught){setError(caught instanceof Error?caught.message:"Service unavailable");return null;}finally{setLoading(false);}},[api,siteId,week,initialDemandId]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
 async function act(action:string,fields:Record<string,unknown>){setBusy(true);setError("");setNotice("");try{
  const result=await read(api,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...fields})});
  const confirmed=await load();
  if(!confirmed||confirmed.service.id!==serviceId)throw Error("The server responded, but the authorised Service view could not be refreshed. Check the source before another change.");
  setNotice("Server response received; current Service view refreshed. Check the dated history for the exact change.");return result.result;
 }catch(caught){setError(caught instanceof Error?caught.message:"Change could not be saved");return null;}finally{setBusy(false);}}
 async function loadAllocation(demandId:string){setSelected(demandId);setCandidates([]);try{const result=await read(api,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({action:"allocations",demandId})});setAllocations(result.result?.allocations??[]);}catch{setError("Allocations unavailable");}}
 async function loadHistory(){try{const result=await read(api,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({action:"history",siteId,offset:0})});setHistory(result.result?.items??[]);}catch{setError("Service history unavailable");}}
 async function findCandidates(){if(!selected)return;try{const result=await read(api,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({action:"candidates",demandId:selected,search,offset:0})});setCandidates(result.result?.items??[]);}catch{setError("Candidate search unavailable");}}
 async function allocate(personId:string){const demand=detail?.demands.find((item)=>item.id===selected);if(!demand)return;
  const result=await act("allocate",{demandId:demand.id,personId,expectedRevision:demand.revision,
   acknowledgeWarnings:true,reason:warningReason});if(result){setWarningReason("");await loadAllocation(demand.id);}}
 function templateDefaults(value:string){setLineId(value);const selectedTemplate=detail?.templates.find((item)=>item.line_id===value&&item.effective_until===null);
  if(selectedTemplate){setDays(selectedTemplate.weekdays);setRoleId(selectedTemplate.role_id);setQuantity(selectedTemplate.required_quantity);
   setReportTime(selectedTemplate.report_time.slice(0,5));setStartTime(selectedTemplate.shift_start_time.slice(0,5));
   setEndTime(selectedTemplate.shift_end_time.slice(0,5));setArea(selectedTemplate.area_label);setReporting(selectedTemplate.reporting_point);}}
 async function extra(){const date=effectiveOn;const report=londonDueToIso(dateInput(date,reportTime));
  const start=londonDueToIso(dateInput(date,startTime));const end=londonDueToIso(dateInput(endTime<=startTime?addCivilDays(date,1):date,endTime));
  if(!report||!start||!end){setError("Enter an unambiguous London local time.");return;}
  await act("extra",{serviceDate:date,roleId,quantity,reportAt:report,shiftStartsAt:start,shiftEndsAt:end,
   area,reporting,reason});}
 const service=detail?.service;
 return <main className={`enterprise-main ${journey.controls}`}><header className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Ongoing Site shift · synthetic development data</p>
   <h1>{service?.name??"Site Service"}</h1><p>{service?.client_name} · {service?.site_name}</p></div></header>
   <nav className={journey.context} aria-label="Site Service context"><Link href={`/sites?view=operational&selected=${siteId}`}>Site</Link><Link href={`/sites/${siteId}/services`}>All Site Services</Link><Link href="/workforce">Workforce</Link><Link href={`/sites/${siteId}/services/${serviceId}/attendance`}>Attendance</Link><Link href={`/operational-contacts/manage?kind=SITE_SERVICE&id=${serviceId}`}>Operational contacts</Link></nav>
   <nav className={journey.sections} aria-label="Service sections"><a href="#service-state">Service state</a><a href="#service-template">Weekly template</a><a href="#service-demand">Dated demand</a></nav>
   {error&&<p role="alert" className="enterprise-error">{error} <Button variant="outline" onClick={()=>void load()}>Retry</Button></p>}
   {notice&&<p role="status" className="enterprise-honesty">{notice}</p>}
   {loading?<p role="status" className="crm-skeleton">Loading Service…</p>:service&&<>
    <section id="service-state" className="crm-panel"><p><strong>{service.state}</strong> · {service.type.replaceAll("_"," ")} · Effective {service.effective_from}{service.effective_until?` to ${service.effective_until}`:" onward"}</p>
     <p>Service status and staffing counts describe planning only. They do not confirm attendance or worked hours.</p>
     {detail?.pauses.length? <p>Pause periods: {detail.pauses.map((pause)=>`${pause.starts_on} to ${pause.ends_before} (exclusive)`).join(" · ")}</p>:null}
     {canAdmin&&<div className="sites-form"><label>Effective date<Input type="date" value={effectiveOn} onChange={(event)=>setEffectiveOn(event.target.value)} /></label>
      <label>Resume on (for a pause)<Input type="date" value={resumeOn} onChange={(event)=>setResumeOn(event.target.value)} /></label>
      <label>Reason<Input value={reason} maxLength={500} onChange={(event)=>setReason(event.target.value)} /></label>
      <div className="deployment-actions">{service.state==="DRAFT"&&<Button disabled={busy} onClick={()=>void act("transition",{state:"ACTIVE",effectiveOn,expectedRevision:service.revision,reason})}>Activate</Button>}
       {service.state==="ACTIVE"&&<Button variant="outline" disabled={busy} onClick={()=>void act("transition",{state:"PAUSED",effectiveOn,resumeOn,expectedRevision:service.revision,reason})}>Set pause period</Button>}
       {service.state==="PAUSED"&&<Button variant="outline" disabled={busy} onClick={()=>void act("transition",{state:"ACTIVE",effectiveOn,expectedRevision:service.revision,reason})}>Resume</Button>}
       {service.state!=="ENDED"&&<Button variant="outline" disabled={busy} onClick={()=>void act("transition",{state:"ENDED",effectiveOn,expectedRevision:service.revision,reason})}>End Service</Button>}</div></div>}</section>
    <section id="service-template" className="crm-panel"><h2>Weekly demand template</h2><p>Published versions preserve intent; dated shifts keep their own identity and history.</p>
      {detail?.templates.length?<ul>{detail.templates.map((item)=><li key={item.id}>{item.role_name} · {item.required_quantity} · {item.report_time.slice(0,5)} / {item.shift_start_time.slice(0,5)}–{item.shift_end_time.slice(0,5)} · {item.effective_from} to {item.effective_until??"open"} · v{item.version}</li>)}</ul>:<p>No template published.</p>}
      {canAdmin&&<form className="sites-form" onSubmit={(event)=>{event.preventDefault();void act("template",{lineId:lineId||null,effectiveFrom:effectiveOn,weekdays:days,roleId,
        quantity,reportTime,startTime,endTime,area,reporting,reason});}}>
       <label>Template line<select value={lineId} onChange={(event)=>templateDefaults(event.target.value)}><option value="">New weekly line</option>
         {detail?.templates.filter((item)=>item.effective_until===null).map((item)=><option key={item.id} value={item.line_id}>{item.role_name} · {item.area_label} (v{item.version})</option>)}</select></label>
       <label>Effective from<Input type="date" value={effectiveOn} onChange={(event)=>setEffectiveOn(event.target.value)} /></label>
       <div role="group" aria-label="Weekdays" className="workforce-filters is-open">{weekdays.map((label,index)=><label key={label} className="workforce-check"><input type="checkbox" checked={days.includes(index+1)} onChange={(event)=>setDays(event.target.checked?[...days,index+1].sort():days.filter((day)=>day!==index+1))} />{label}</label>)}</div>
       <label>Role<select value={roleId} onChange={(event)=>setRoleId(event.target.value)}><option value="">Choose role</option>{roles.map((role)=><option key={role.id} value={role.id}>{role.display_name}</option>)}</select></label>
       <label>Required guards<Input type="number" min={1} max={10000} value={quantity} onChange={(event)=>setQuantity(Number(event.target.value))} /></label>
       <label>Report time<Input type="time" value={reportTime} onChange={(event)=>setReportTime(event.target.value)} /></label>
       <label>Shift start<Input type="time" value={startTime} onChange={(event)=>setStartTime(event.target.value)} /></label>
       <label>Shift end<Input type="time" value={endTime} onChange={(event)=>setEndTime(event.target.value)} /></label>
       <label>Area<Input value={area} maxLength={100} onChange={(event)=>setArea(event.target.value)} /></label>
       <label>Reporting point<Input value={reporting} maxLength={180} onChange={(event)=>setReporting(event.target.value)} /></label>
       <label>Reason<Input value={reason} maxLength={500} onChange={(event)=>setReason(event.target.value)} /></label>
       <Button disabled={busy||!roleId||days.length===0}>Publish version</Button>
       <Button type="button" variant="outline" disabled={busy} onClick={()=>void act("generate",{from:week,until:addCivilDays(week,7)})}>Reconcile this week</Button>
       <Button type="button" variant="outline" disabled={busy||!roleId} onClick={()=>void extra()}>Add one dated extra shift</Button>
      </form>}</section>
    <section id="service-demand"><div className="enterprise-page-heading"><div><h2>Dated shift demand</h2><p>Exact, stable shifts for this week. Operations may manage dated exceptions and staffing.</p></div></div>
      <div className="workforce-toolbar"><Button variant="outline" onClick={()=>setWeek(addCivilDays(week,-7))}>Previous week</Button>
       <Button variant="outline" onClick={()=>setWeek(londonWeekStart(londonToday())!)}>This week</Button>
       <Button variant="outline" onClick={()=>setWeek(addCivilDays(week,7))}>Next week</Button><strong>Week of {week}</strong></div>
      {detail?.demands.length===0?<p className="crm-empty">No dated demand in this week. Check the Service dates, pause periods and generation horizon.</p>:
       <div className="crm-list">{detail?.demands.map((demand)=><article className="crm-panel" key={demand.id}>
        <p className="enterprise-eyebrow">{demand.origin==="EXTRA"?"Dated extra shift":"Recurring Site shift"} · {demand.service_date} · {demand.state}</p>
        <h3>{demand.role_name} · {demand.area_label}</h3><p>Report {time(demand.report_at)} · Shift {time(demand.shift_starts_at)} → {time(demand.shift_ends_at)}</p>
        <p>{demand.required_quantity} required · {demand.allocated} allocated · {demand.required_quantity-demand.allocated} remaining · {demand.accepted} accepted</p>
        <p>Reporting point: {demand.reporting_point||"Not specified"}</p>
        <p><Link href={`/sites/${siteId}/services/${serviceId}/attendance?demand=${encodeURIComponent(demand.id)}`}>Open attendance for this shift</Link></p>
        {demand.state==="PLANNED"&&<div className="deployment-actions"><Button variant="outline" onClick={()=>void loadAllocation(demand.id)}>Allocations</Button>
         <Button variant="outline" disabled={busy} onClick={()=>void act("amend",{demandId:demand.id,expectedRevision:demand.revision,kind:"SKIP",reason})}>Skip this date</Button>
         <Button variant="outline" disabled={busy} onClick={()=>void act("amend",{demandId:demand.id,expectedRevision:demand.revision,kind:"CHANGE_QUANTITY",quantity:exceptionQuantity,reason})}>Set quantity</Button>
         <Input aria-label="New quantity" type="number" min={1} value={exceptionQuantity} onChange={(event)=>setExceptionQuantity(Number(event.target.value))} /></div>}
        {selected===demand.id&&<div className="staffing-sheet"><h4>Named allocations</h4><p>Active allocations consume capacity. Acceptance is a separate Staff response.</p>
          {allocations.length?<ul>{allocations.map((allocation)=><li key={allocation.id}>{allocation.person_name} · {allocation.status} {!["CANCELLED","DECLINED"].includes(allocation.status)&&<Button variant="outline" disabled={busy} onClick={()=>void act("cancelAllocation",{demandId:demand.id,allocationId:allocation.id,expectedRevision:allocation.revision,reason})}>Cancel allocation</Button>}<LeaveReconciliation source="SITE_SHIFT" allocationId={allocation.id} /></li>)}</ul>:<p>No named allocations.</p>}
          <form onSubmit={(event)=>{event.preventDefault();void findCandidates();}}><label>Search Security Staff<Input value={search} maxLength={80} onChange={(event)=>setSearch(event.target.value)} /></label><Button>Find candidates</Button></form>
          <label>Review reason for warnings<Input value={warningReason} maxLength={300} onChange={(event)=>setWarningReason(event.target.value)} /></label>
          {candidates.length?<ul>{candidates.map((candidate)=><li key={candidate.id}>{candidate.display_name} · {candidate.check.result.replaceAll("_"," ")} · {candidate.check.availability}{candidate.check.reasons.includes("APPROVED_TIME_AWAY_CONFLICT") ? " · Approved time away overlaps this duty" : ""}
            <Button variant="outline" disabled={busy||candidate.check.result==="BLOCKED"} onClick={()=>void allocate(candidate.id)}>Allocate</Button></li>)}</ul>:null}
         </div>}</article>)}</div>}
    </section>
    <section className="crm-panel"><h2>Service and shift history</h2><p>Published versions, dated amendments and allocation responses remain attributable.</p>
      <Button variant="outline" onClick={()=>void loadHistory()}>Show recent history</Button>
      {history.length>0&&<ul>{history.map((entry)=><li key={`${entry.source}-${entry.record_id}-${entry.revision}`}>
        {time(entry.occurred_at)} · {entry.source.replaceAll("_"," ")} · {entry.kind.replaceAll("_"," ")} · v{entry.revision} · {entry.actor_name}
        {entry.reason?` · ${entry.reason}`:""}</li>)}</ul>}</section></>}
 </main>;
}
