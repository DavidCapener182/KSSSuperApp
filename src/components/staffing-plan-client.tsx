"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { londonDueToIso } from "@/lib/crm/due-time";
import { DeploymentLineClient } from "@/components/deployment-line-client";

type Line = { id:string; role_id:string; role_name:string; service_date:string; required_quantity:number;
  report_at:string; shift_starts_at:string; shift_ends_at:string; area_label:string; instructions:string;
  state:"PLANNED"|"CANCELLED"; revision:number };
type Role = { id:string; name:string; code:string; active:boolean };
type Counts = { required:number; allocated:number; remaining:number; accepted:number };
type Summary = Counts & { lines:Record<string,Counts> };
type History = { revision:number;kind:string;role_name:string;required_quantity:number;area_label:string;
  report_at:string;shift_starts_at:string;shift_ends_at:string;reason:string|null;actor_name:string;occurred_at:string };
const empty = { roleId:"",quantity:"1",reportLocal:"",startLocal:"",endLocal:"",area:"",instructions:"",reason:"",confirmException:false,confirmDuplicate:false };
type Draft = typeof empty;
const local = (value:string) => {
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"})
    .formatToParts(new Date(value)).map((item)=>[item.type,item.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
const clock = (value:string) => new Date(value).toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const dateLabel = (value:string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB",{timeZone:"Europe/London",weekday:"long",day:"numeric",month:"long",year:"numeric"});
async function request(path:string,init?:RequestInit){const response=await fetch(path,{...init,cache:"no-store"});const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error??"Staffing plan unavailable");return data;}

export function StaffingPlanClient({eventId,eventStatus,eventStarts,eventEnds}:{eventId:string;eventStatus:string;eventStarts:string;eventEnds:string}) {
  const roleSelectRef=useRef<HTMLSelectElement>(null);
  const [lines,setLines]=useState<Line[]>([]);const [roles,setRoles]=useState<Role[]>([]);const [required,setRequired]=useState(0);
  const [summary,setSummary]=useState<Summary|null>(null); const [deploymentLine,setDeploymentLine]=useState<Line|null>(null);
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const [editing,setEditing]=useState<Line|null>(null);const [creating,setCreating]=useState(false);const [draft,setDraft]=useState<Draft>(empty);
  const [cancelLine,setCancelLine]=useState<Line|null>(null);const [cancelReason,setCancelReason]=useState("");
  const [historyLine,setHistoryLine]=useState<Line|null>(null);const [history,setHistory]=useState<History[]>([]);
  const load=useCallback(async()=>{setLoading(true);try{const [plan,choice,counts]=await Promise.all([
    request(`/api/events/${eventId}/staffing-requirements`),request("/api/events/staffing-roles"),request(`/api/events/${eventId}/deployment-summary`)]);
    setLines(plan.plan.items??[]);setRequired(plan.plan.required_total??0);setRoles(choice.roles??[]);setSummary(counts.summary);setError("");}
    catch(caught){setError(caught instanceof Error?caught.message:"Staffing plan unavailable");}finally{setLoading(false);}},[eventId]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
  const terminal=eventStatus==="COMPLETED"||eventStatus==="CANCELLED";
  const report=londonDueToIso(draft.reportLocal);const start=londonDueToIso(draft.startLocal);const end=londonDueToIso(draft.endLocal);
  const duration=start&&end?(Date.parse(end)-Date.parse(start))/3_600_000:0;
  const lead=report&&start?(Date.parse(start)-Date.parse(report))/3_600_000:0;
  const unusual=Number(draft.quantity)>100||duration>24||lead>12;
  const outside=Boolean(report&&end&&(Date.parse(report)<Date.parse(eventStarts)||Date.parse(end)>Date.parse(eventEnds)));
  const groups=lines.filter((line)=>line.state==="PLANNED").reduce<Record<string,Line[]>>((result,line)=>{
    (result[line.service_date]??=[]).push(line);return result;},{});
  const cancelled=lines.filter((line)=>line.state==="CANCELLED");
  function begin(line?:Line){setEditing(line??null);setDraft(line?{roleId:line.role_id,quantity:String(line.required_quantity),
    reportLocal:local(line.report_at),startLocal:local(line.shift_starts_at),endLocal:local(line.shift_ends_at),
    area:line.area_label,instructions:line.instructions,reason:"",confirmException:false,confirmDuplicate:false}:empty);
    setCreating(true);setError("");}
  async function save(formEvent:React.FormEvent){formEvent.preventDefault();setBusy(true);setError("");try{
    const body={roleId:draft.roleId,quantity:Number(draft.quantity),reportLocal:draft.reportLocal,startLocal:draft.startLocal,
      endLocal:draft.endLocal,area:draft.area,instructions:draft.instructions,reason:draft.reason,
      confirmException:draft.confirmException,confirmDuplicate:draft.confirmDuplicate,...(editing?{action:"AMEND",expectedRevision:editing.revision}:{})};
    const path=`/api/events/${eventId}/staffing-requirements${editing?`/${editing.id}`:""}`;
    await request(path,{method:editing?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    setCreating(false);setEditing(null);setNotice(editing?"Staffing requirement amended.":"Staffing requirement added.");await load();
  }catch(caught){const message=caught instanceof Error?caught.message:"Staffing change denied";setError(message);
    if(message.includes("matching staffing line"))setDraft((current)=>({...current,confirmDuplicate:false}));}
    finally{setBusy(false);}}
  async function cancel(){if(!cancelLine)return;setBusy(true);setError("");try{
    await request(`/api/events/${eventId}/staffing-requirements/${cancelLine.id}`,{method:"PATCH",headers:{"content-type":"application/json"},
      body:JSON.stringify({action:"CANCEL",expectedRevision:cancelLine.revision,reason:cancelReason})});
    setCancelLine(null);setCancelReason("");setNotice("Staffing requirement cancelled; history retained.");await load();
  }catch(caught){setError(caught instanceof Error?caught.message:"Cancellation denied");}finally{setBusy(false);}}
  async function showHistory(line:Line){setHistoryLine(line);setHistory([]);try{const result=await request(`/api/events/${eventId}/staffing-requirements/${line.id}`);
    setHistory(result.history??[]);}catch(caught){setError(caught instanceof Error?caught.message:"History unavailable");}}
  return <section className="crm-panel staffing-plan" aria-label="Staffing plan">
    <div className="staffing-heading"><div><h2>Staffing plan</h2><p>{summary ? `${summary.required} required · ${summary.allocated} allocated · ${summary.remaining} remaining · ${summary.accepted} accepted` : `Required: ${required}`}</p></div>
      {!terminal&&<Button onClick={()=>begin()}>Add requirement</Button>}</div>
    {error&&!creating&&!cancelLine&&!historyLine&&<p className="enterprise-error" role="alert">{error} <Button variant="ghost" onClick={()=>void load()}>Retry</Button></p>}
    {notice&&<p className="enterprise-honesty" role="status">{notice}</p>}
    {loading?<p role="status" className="crm-skeleton">Loading authorised staffing plan…</p>:
      Object.keys(groups).length===0?<p className="crm-empty">No current staffing requirements. Add role, quantity and times to define demand.</p>:
      Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).map(([day,dayLines])=><div className="staffing-day" key={day}>
        <div className="staffing-day-title"><h3>{dateLabel(day)}</h3><span>{dayLines.reduce((sum,line)=>sum+line.required_quantity,0)} required</span></div>
        <div className="staffing-table-wrap"><table className="staffing-table"><thead><tr><th>Role / area</th><th>Allocation</th><th>Report</th><th>Shift</th><th>Actions</th></tr></thead><tbody>
          {dayLines.map((line)=><tr key={line.id}><td><strong>{line.role_name}</strong><small>{line.area_label}{line.instructions?` · ${line.instructions}`:""}</small></td>
            <td>{summary?.lines?.[line.id] ? `${line.required_quantity} required · ${summary.lines[line.id].allocated} allocated · ${summary.lines[line.id].remaining} remaining · ${summary.lines[line.id].accepted} accepted` : `${line.required_quantity} required`}</td><td>{clock(line.report_at)}</td><td>{clock(line.shift_starts_at)} → {clock(line.shift_ends_at)}</td>
            <td><div className="staffing-actions"><Button variant="outline" onClick={()=>setDeploymentLine(line)}>Allocations</Button><Button variant="outline" onClick={()=>void showHistory(line)}>History</Button>
              {!terminal&&<><Button variant="outline" onClick={()=>begin(line)}>Edit</Button><Button variant="outline" onClick={()=>{setCancelLine(line);setCancelReason("");}}>Cancel</Button></>}</div></td></tr>)}</tbody></table></div>
        <div className="staffing-mobile-list">{dayLines.map((line)=><article className="staffing-card" key={line.id}>
          <div><strong>{line.required_quantity} × {line.role_name}</strong><span>{line.area_label}</span></div>
          <p>Report {clock(line.report_at)}<br/>Shift {clock(line.shift_starts_at)} → {clock(line.shift_ends_at)}</p>
          <p>{summary?.lines?.[line.id] ? `${summary.lines[line.id].allocated} allocated · ${summary.lines[line.id].remaining} remaining · ${summary.lines[line.id].accepted} accepted` : "Loading allocations…"}</p>
          {line.instructions&&<p>{line.instructions}</p>}<div className="staffing-actions"><Button variant="outline" onClick={()=>setDeploymentLine(line)}>Allocations</Button><Button variant="outline" onClick={()=>void showHistory(line)}>History</Button>
            {!terminal&&<><Button variant="outline" onClick={()=>begin(line)}>Edit</Button><Button variant="outline" onClick={()=>{setCancelLine(line);setCancelReason("");}}>Cancel</Button></>}</div>
        </article>)}</div></div>)}
    {cancelled.length>0&&<details className="staffing-cancelled"><summary>{cancelled.length} cancelled requirement{cancelled.length===1?"":"s"} · history</summary>
      {cancelled.map((line)=><p key={line.id}>{line.role_name} · {dateLabel(line.service_date)} · {line.area_label} · {line.required_quantity} previously required <Button variant="ghost" onClick={()=>void showHistory(line)}>History</Button></p>)}</details>}
    {terminal&&<p className="enterprise-honesty">This Event is {eventStatus.toLowerCase()}; staffing history is read-only.</p>}
    {deploymentLine&&<DeploymentLineClient eventId={eventId} requirementId={deploymentLine.id} revision={deploymentLine.revision} roleName={deploymentLine.role_name} area={deploymentLine.area_label} disabled={terminal} open={Boolean(deploymentLine)} onClose={()=>setDeploymentLine(null)} onChanged={load}/>}
    <Sheet open={creating} onOpenChange={(open)=>{if(!open){setCreating(false);setEditing(null);setError("");}}}><SheetContent className="staffing-sheet" showCloseButton={!busy} onOpenAutoFocus={(event)=>{event.preventDefault();roleSelectRef.current?.focus();}} onEscapeKeyDown={(event)=>{if(busy)event.preventDefault();}}>
      <SheetTitle>{editing?"Edit requirement":"Add staffing requirement"}</SheetTitle><form onSubmit={(e)=>void save(e)} className="staffing-form">
        <label>Operational role<select ref={roleSelectRef} required value={draft.roleId} onChange={(e)=>setDraft({...draft,roleId:e.target.value})}><option value="">Choose role</option>
          {roles.filter((role)=>role.active||role.id===editing?.role_id).map((role)=><option key={role.id} value={role.id}>{role.name}{!role.active?" · retired":""}</option>)}</select></label>
        <label>Required quantity<Input type="number" min="1" max="10000" required value={draft.quantity} onChange={(e)=>setDraft({...draft,quantity:e.target.value})}/></label>
        <label>Report time · London<Input type="datetime-local" required value={draft.reportLocal} onChange={(e)=>setDraft({...draft,reportLocal:e.target.value})}/></label>
        <label>Shift start · London<Input type="datetime-local" required value={draft.startLocal} onChange={(e)=>setDraft({...draft,startLocal:e.target.value})}/></label>
        <label>Shift end · London<Input type="datetime-local" required value={draft.endLocal} onChange={(e)=>setDraft({...draft,endLocal:e.target.value})}/></label>
        <label>Area<Input required maxLength={100} value={draft.area} onChange={(e)=>setDraft({...draft,area:e.target.value})}/></label>
        <label className="staffing-form-wide">Short instructions<textarea maxLength={500} value={draft.instructions} onChange={(e)=>setDraft({...draft,instructions:e.target.value})}/></label>
        {outside&&<p className="enterprise-honesty staffing-form-wide">Outside Event hours. Early reporting and post-Event finishing are allowed on the Event service date.</p>}
        {unusual&&<label className="staffing-confirm staffing-form-wide"><input type="checkbox" checked={draft.confirmException} onChange={(e)=>setDraft({...draft,confirmException:e.target.checked})}/>
          Confirm unusually large demand, a duty over 24 hours, or reporting over 12 hours early.</label>}
        <label className="staffing-form-wide">Reason {eventStatus!=="PLANNING"||duration>24||lead>12?"(required)":"(optional)"}
          <textarea maxLength={500} required={eventStatus!=="PLANNING"||duration>24||lead>12} value={draft.reason} onChange={(e)=>setDraft({...draft,reason:e.target.value})}/></label>
        {error.includes("matching staffing line")&&<label className="staffing-confirm staffing-form-wide"><input type="checkbox" checked={draft.confirmDuplicate} onChange={(e)=>setDraft({...draft,confirmDuplicate:e.target.checked})}/>
          Create another matching line intentionally.</label>}
        {error&&<p className="enterprise-error staffing-form-wide" role="alert">{error}</p>}
        <div className="staffing-form-actions staffing-form-wide"><Button type="button" variant="outline" onClick={()=>{setCreating(false);setEditing(null);setError("");}}>Close</Button><Button disabled={busy}>Save requirement</Button></div>
      </form></SheetContent></Sheet>
    <Sheet open={Boolean(cancelLine)} onOpenChange={(open)=>{if(!open){setCancelLine(null);setError("");}}}><SheetContent className="staffing-sheet" showCloseButton={!busy}>
      <SheetTitle>Cancel {cancelLine?.role_name} requirement?</SheetTitle><p>Current demand will decrease by {cancelLine?.required_quantity}; history remains.</p>
      <label>Reason<textarea maxLength={500} value={cancelReason} onChange={(e)=>setCancelReason(e.target.value)}/></label>
      {error&&<p className="enterprise-error" role="alert">{error}</p>}
      <div className="staffing-form-actions"><Button variant="outline" onClick={()=>setCancelLine(null)}>Keep requirement</Button><Button disabled={busy||cancelReason.trim().length<3} onClick={()=>void cancel()}>Cancel requirement</Button></div>
    </SheetContent></Sheet>
    <Sheet open={Boolean(historyLine)} onOpenChange={(open)=>{if(!open){setHistoryLine(null);setError("");}}}><SheetContent className="staffing-sheet">
      <SheetTitle>{historyLine?.role_name} · history</SheetTitle>{error&&<p className="enterprise-error" role="alert">{error}</p>}{history.length===0?<p>Loading history…</p>:history.map((item)=><div className="crm-timeline-entry" key={item.revision}>
        <strong>Revision {item.revision} · {item.kind.toLowerCase()}</strong><span>{item.actor_name} · {clock(item.occurred_at)}</span>
        <p>{item.required_quantity} × {item.role_name} · {item.area_label}<br/>Report {clock(item.report_at)}<br/>
          Shift {clock(item.shift_starts_at)} → {clock(item.shift_ends_at)}</p>{item.reason&&<p>Reason: {item.reason}</p>}</div>)}
      <Button variant="outline" onClick={()=>setHistoryLine(null)}>Close</Button></SheetContent></Sheet>
  </section>;
}
