"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCivilDays, londonToday, londonWeekStart } from "@/lib/events/workforce-week";

type Allocation = { id:string; person_id:string; person_name:string; status:string; availability:string;
  availability_conflict:string|null; allocation_clash:boolean };
type Line = { source:"EVENT"|"SITE_SHIFT"; requirement_id:string; event_id:string|null; service_id:string|null; site_id:string; service_date:string; report_at:string; shift_starts_at:string;
  shift_ends_at:string; required_quantity:number; area_label:string; role_name:string; role_code:string;
  event_name:string; event_status:string; site_name:string; client_name:string; allocated:number; accepted:number;
  remaining:number; unavailable_conflicts:number; coverage_conflicts:number; not_declared:number; partial_coverage:number;
  awaiting_response:number; clashes:number; allocations:Allocation[] };
type Totals = { events:number;services:number;required:number;allocated:number;remaining:number;accepted:number;gap_lines:number;
  availability_conflicts:number;unavailable_conflicts:number;coverage_conflicts:number;allocation_clashes:number };
type Schedule = { week_start:string; static_horizon_covered:boolean; total_lines:number;totals:Totals;items:Line[] };
type Choice = { id:string;name:string };
type FilterChoices = { events:Choice[];sites:Choice[];clients:string[];roles:Choice[];owners:Choice[] };
type PersonChoice = { id:string;display_name:string };
type PersonRow = { source:"EVENT"|"SITE_SHIFT";service_id:string|null;site_id?:string;id:string;status:string;service_date:string;report_at:string;shift_starts_at:string;
  shift_ends_at:string;area_label:string;role_name:string;event_name:string;site_name:string;
  event_id:string|null;requirement_id:string;availability:string;availability_conflict:string|null };
type PersonSchedule = { total:number;items:PersonRow[] };
const initialFilters = { event:"",site:"",client:"",role:"",owner:"",gaps:false,conflicts:false };
const dayLabel = (value:string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB",{timeZone:"Europe/London",weekday:"long",day:"numeric",month:"long"});
const clock = (value:string) => new Date(value).toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const status = (code:string) => code === "UNAVAILABLE_CONFLICT" ? "Declared unavailable conflict" :
  code === "COVERAGE_NO_LONGER_DECLARED" ? "Declaration no longer covers duty" :
  code === "DECLARED_AVAILABLE" ? "Declared available" : code === "DECLARED_UNAVAILABLE" ? "Declared unavailable" :
  code === "NOT_FULLY_COVERED" ? "Not fully covered" : "Not declared";
async function read(path:string) { const response=await fetch(path,{cache:"no-store"}); const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error??"Workforce unavailable"); return data; }

export function WorkforceClient() {
  const requestSequence=useRef(0);
  const [week,setWeek]=useState(()=>londonWeekStart(londonToday())!);
  const [selectedDay,setSelectedDay]=useState(()=>londonToday());
  const [view,setView]=useState<"week"|"staff">("week");
  const [showFilters,setShowFilters]=useState(false);
  const [filters,setFilters]=useState(initialFilters); const [offset,setOffset]=useState(0);
  const [choices,setChoices]=useState<FilterChoices|null>(null);
  const [schedule,setSchedule]=useState<Schedule|null>(null); const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [staffSearch,setStaffSearch]=useState(""); const [appliedStaffSearch,setAppliedStaffSearch]=useState("");
  const [staffChoices,setStaffChoices]=useState<PersonChoice[]>([]);
  const [staffTotal,setStaffTotal]=useState(0); const [staffOffset,setStaffOffset]=useState(0);
  const [person,setPerson]=useState<PersonChoice|null>(null); const [personSchedule,setPersonSchedule]=useState<PersonSchedule|null>(null);
  const [personOffset,setPersonOffset]=useState(0);
  const filtered=Boolean(filters.event||filters.site||filters.client||filters.role||filters.owner||filters.gaps||filters.conflicts);
  const days=Array.from({length:7},(_,index)=>addCivilDays(week,index));
  const load=useCallback(async()=>{const sequence=++requestSequence.current;setLoading(true);setError("");try{
    const q=new URLSearchParams({week,offset:String(offset)});
    for(const key of ["event","site","client","role","owner"] as const) if(filters[key]) q.set(key,filters[key]);
    if(filters.gaps)q.set("gaps","true");if(filters.conflicts)q.set("conflicts","true");
    const [result,choiceResult]=await Promise.all([read(`/api/workforce?${q}`),read(`/api/workforce/choices?week=${week}`)]);
    if(sequence===requestSequence.current){setSchedule(result.schedule);setChoices(choiceResult.choices);}
  }catch(caught){if(sequence===requestSequence.current)setError(caught instanceof Error?caught.message:"Workforce unavailable");}
    finally{if(sequence===requestSequence.current)setLoading(false);}},[week,offset,filters]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
  const searchStaff=useCallback(async(search:string,page:number)=>{try{const q=new URLSearchParams({week,search,offset:String(page)});
    const result=await read(`/api/workforce/staff?${q}`);setStaffChoices(result.choices.items);setStaffTotal(result.choices.total);setStaffOffset(page);
  }catch(caught){setError(caught instanceof Error?caught.message:"Staff search unavailable");}},[week]);
  const loadPerson=useCallback(async(id:string,page:number)=>{try{const q=new URLSearchParams({week,person:id,offset:String(page)});
    const result=await read(`/api/workforce/staff?${q}`);setPersonSchedule(result.schedule);setPersonOffset(page);
  }catch(caught){setError(caught instanceof Error?caught.message:"Staff schedule unavailable");}},[week]);
  useEffect(()=>{if(view!=="staff")return;const timer=setTimeout(()=>{if(person)void loadPerson(person.id,0);else void searchStaff(appliedStaffSearch,0);},0);
    return()=>clearTimeout(timer);},[view,person,week,appliedStaffSearch,loadPerson,searchStaff]);
  function changeWeek(value:string){const next=londonWeekStart(value);if(!next)return;setWeek(next);setSelectedDay(value);setOffset(0);setPersonOffset(0);}
  function setFilter<K extends keyof typeof filters>(key:K,value:(typeof filters)[K]){setFilters((old)=>({...old,[key]:value}));setOffset(0);}
  const totals=schedule?.totals;
  return <main className="enterprise-main workforce-page">
    <header className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Operational planning · synthetic development data</p>
      <h1>Workforce</h1><p>Event and ongoing Site shift demand, allocation, Staff response and availability remain separate facts.</p></div></header>
    <div className="workforce-tabs" role="tablist" aria-label="Workforce views"><Button role="tab" aria-selected={view==="week"} variant={view==="week"?"default":"outline"} onClick={()=>setView("week")}>Week schedule</Button>
      <Button role="tab" aria-selected={view==="staff"} variant={view==="staff"?"default":"outline"} onClick={()=>setView("staff")}>Staff schedule</Button></div>
    <section className="workforce-toolbar" aria-label="Choose schedule week"><Button variant="outline" onClick={()=>changeWeek(addCivilDays(week,-7))}>Previous week</Button>
      <Button variant="outline" onClick={()=>changeWeek(londonToday())}>This week</Button>
      <Button variant="outline" onClick={()=>changeWeek(addCivilDays(week,7))}>Next week</Button>
      <label>Go to date <Input type="date" value={selectedDay} onChange={(event)=>changeWeek(event.target.value)} /></label>
      <strong>Week of {dayLabel(week)}</strong></section>
    {error&&<p role="alert" className="enterprise-error">{error} <Button variant="outline" onClick={()=>void load()}>Retry</Button></p>}
    {view==="week"&&<>
      <Button className="workforce-filter-toggle" variant="outline" aria-expanded={showFilters} onClick={()=>setShowFilters(!showFilters)}>{showFilters?"Hide filters":"Filters"}{filtered?" · active":""}</Button>
      <div className={`workforce-filters ${showFilters?"is-open":""}`} aria-label="Workforce filters">
        <label>Event<select value={filters.event} onChange={(event)=>setFilter("event",event.target.value)}><option value="">All Events</option>{choices?.events.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Site<select value={filters.site} onChange={(event)=>setFilter("site",event.target.value)}><option value="">All Sites</option>{choices?.sites.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Client<select value={filters.client} onChange={(event)=>setFilter("client",event.target.value)}><option value="">All Clients</option>{choices?.clients.map((item)=><option key={item} value={item}>{item}</option>)}</select></label>
        <label>Role<select value={filters.role} onChange={(event)=>setFilter("role",event.target.value)}><option value="">All roles</option>{choices?.roles.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Owner<select value={filters.owner} onChange={(event)=>setFilter("owner",event.target.value)}><option value="">All owners</option>{choices?.owners.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="workforce-check"><input type="checkbox" checked={filters.gaps} onChange={(event)=>setFilter("gaps",event.target.checked)} /> Gaps only</label>
        <label className="workforce-check"><input type="checkbox" checked={filters.conflicts} onChange={(event)=>setFilter("conflicts",event.target.checked)} /> Availability conflicts only</label>
        {filtered&&<Button variant="ghost" onClick={()=>{setFilters(initialFilters);setOffset(0);}}>Clear filters</Button>}
      </div>
      <div className="workforce-totals" aria-label="Weekly totals"><p>{filtered?"For this view":"This week"}</p>
        {[['Events',totals?.events],['Site Services',totals?.services],['Required',totals?.required],['Allocated',totals?.allocated],['Remaining',totals?.remaining],['Accepted',totals?.accepted],['Availability conflicts',totals?.availability_conflicts]].map(([name,value])=><div key={String(name)}><strong>{loading?"…":value??0}</strong><span>{name}</span></div>)}
      </div>
      {schedule&&!schedule.static_horizon_covered&&<p className="enterprise-honesty">This week is beyond the current Site shift generation horizon. Ask Office to reconcile the Service before treating missing Site demand as complete.</p>}
      <p className="enterprise-honesty">{totals?.gap_lines??0} requirement lines have remaining positions. Availability conflicts count explicit Unavailable and removed coverage only; missing declarations are separate warnings.</p>
      <div className="workforce-day-picker" aria-label="Choose day"><Button variant="outline" onClick={()=>setSelectedDay(addCivilDays(selectedDay,-1))} disabled={selectedDay===week}>Previous day</Button>
        <label>Selected day <Input type="date" min={week} max={days[6]} value={selectedDay} onChange={(event)=>{if(days.includes(event.target.value))setSelectedDay(event.target.value);}} /></label>
        <Button variant="outline" onClick={()=>setSelectedDay(addCivilDays(selectedDay,1))} disabled={selectedDay===days[6]}>Next day</Button></div>
      {loading?<p className="crm-skeleton" role="status">Loading authorised workforce schedule…</p>:schedule&&<>
        {schedule.total_lines===0?<p className="crm-empty">No planned Event or Site shift demand for this view.</p>:
          <div className="workforce-week">{days.map((day)=>{const dayLines=schedule.items.filter((line)=>line.service_date===day);
            const groupIds=[...new Set(dayLines.map((line)=>`${line.source}:${line.event_id??line.service_id}`))];return <section key={day} className={`workforce-day ${selectedDay===day?"is-selected":""}`} aria-label={dayLabel(day)}>
              <h2>{dayLabel(day)} <span>{dayLines.length} requirement lines on this page</span></h2>
              {dayLines.length===0?<p className="crm-empty">No demand on this page.</p>:groupIds.map((groupId)=>{const groupLines=dayLines.filter((line)=>`${line.source}:${line.event_id??line.service_id}`===groupId);const first=groupLines[0];
                const total=(key:"required_quantity"|"allocated"|"remaining"|"accepted"|"unavailable_conflicts"|"coverage_conflicts")=>groupLines.reduce((sum,line)=>sum+line[key],0);
                return <article className="workforce-event" key={groupId}><div className="workforce-event-head"><div><p className="enterprise-eyebrow">{first.client_name} · {first.site_name}</p>
                  <h3><Link href={first.source==="EVENT"?`/events/${first.event_id}`:`/sites/${first.site_id}/services/${first.service_id}`}>{first.event_name}</Link></h3><small>{first.source==="EVENT"?"Event work":"Ongoing Site shift"} · {first.event_status.replaceAll("_"," ")}</small></div>
                  <p>{total("required_quantity")} required · {total("allocated")} allocated · {total("remaining")} remaining · {total("accepted")} accepted
                    {total("unavailable_conflicts")+total("coverage_conflicts")>0&&<strong className="workforce-alert"> · {total("unavailable_conflicts")+total("coverage_conflicts")} availability conflicts</strong>}</p></div>
                  <div className="workforce-lines">{groupLines.map((line)=><div className="workforce-line" key={line.requirement_id}><div><strong>{line.role_name} · {line.area_label}</strong><span>Report {clock(line.report_at)} · Shift {clock(line.shift_starts_at)} → {clock(line.shift_ends_at)}</span>
                    <small>{line.required_quantity} required · {line.allocated} allocated · {line.remaining} remaining · {line.accepted} accepted</small>
                    {(line.clashes>0||line.unavailable_conflicts>0||line.remaining>0||line.coverage_conflicts>0||line.awaiting_response>0||line.not_declared>0||line.partial_coverage>0)&&<small className="workforce-warnings">{[
                      line.clashes>0?`${line.clashes} allocation clash`:null,line.unavailable_conflicts>0?`${line.unavailable_conflicts} unavailable conflict`:null,
                      line.remaining>0?`${line.remaining} staffing gap`:null,line.coverage_conflicts>0?`${line.coverage_conflicts} coverage changed`:null,
                      line.awaiting_response>0?`${line.awaiting_response} awaiting response`:null,line.not_declared>0?`${line.not_declared} not declared`:null,
                      line.partial_coverage>0?`${line.partial_coverage} partially covered`:null].filter(Boolean).join(" · ")}</small>}</div>
                    <Link className="workforce-action" href={line.source==="EVENT"?`/events/${line.event_id}?requirement=${line.requirement_id}`:`/sites/${line.site_id}/services/${line.service_id}?demand=${line.requirement_id}`}>Open allocations</Link></div>)}</div>
                </article>;})}</section>;})}</div>}
        {schedule.total_lines>40&&<div className="deployment-pagination"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-40))}>Previous page</Button>
          <span>{offset+1}–{Math.min(offset+40,schedule.total_lines)} of {schedule.total_lines} requirement lines</span>
          <Button variant="outline" disabled={offset+40>=schedule.total_lines} onClick={()=>setOffset(offset+40)}>Next page</Button></div>}
      </>}
    </>}
    {view==="staff"&&<section className="workforce-staff"><h2>Staff schedule</h2><p>Safe operational work only. This does not show Profile, credentials or private availability notes.</p>
      {!person?<><form onSubmit={(event)=>{event.preventDefault();setAppliedStaffSearch(staffSearch);void searchStaff(staffSearch,0);}}><label>Search Security Staff by name <Input value={staffSearch} maxLength={80} onChange={(event)=>setStaffSearch(event.target.value)} /></label>
        <Button type="submit">Search</Button></form>
        <div className="workforce-staff-choices">{staffChoices.map((choice)=><Button variant="outline" key={choice.id} onClick={()=>{setPerson(choice);setPersonSchedule(null);}}>{choice.display_name}</Button>)}</div>
        {staffTotal>20&&<div className="deployment-pagination"><Button variant="outline" disabled={staffOffset===0} onClick={()=>void searchStaff(staffSearch,Math.max(0,staffOffset-20))}>Previous</Button>
          <span>{staffOffset+1}–{Math.min(staffOffset+20,staffTotal)} of {staffTotal}</span><Button variant="outline" disabled={staffOffset+20>=staffTotal} onClick={()=>void searchStaff(staffSearch,staffOffset+20)}>Next</Button></div>}</>:
        <><div className="workforce-selected-person"><h3>{person.display_name}</h3><Button variant="outline" onClick={()=>{setPerson(null);setPersonSchedule(null);}}>Choose another</Button></div>
          {personSchedule?.items.length===0?<p className="crm-empty">No active allocations for this Person in this week.</p>:
            <div className="workforce-person-list">{personSchedule?.items.map((item)=><article className="crm-panel" key={item.id}><p className="enterprise-eyebrow">{item.source==="EVENT"?"Event work":"Ongoing Site shift"} · {dayLabel(item.service_date)} · {item.status==="ALLOCATED"?"Awaiting Staff response":"Accepted"}</p>
              <h3>{item.event_name}</h3><p>{item.site_name} · {item.role_name} · {item.area_label}</p><p>Report {clock(item.report_at)} · Shift {clock(item.shift_starts_at)} → {clock(item.shift_ends_at)}</p>
              <p>{status(item.availability_conflict??item.availability)}</p><Link href={item.source==="EVENT"?`/events/${item.event_id}?requirement=${item.requirement_id}`:`/sites/${item.site_id}/services/${item.service_id}?demand=${item.requirement_id}`}>Open requirement</Link></article>)}</div>}
          {(personSchedule?.total??0)>30&&<div className="deployment-pagination"><Button variant="outline" disabled={personOffset===0} onClick={()=>void loadPerson(person.id,Math.max(0,personOffset-30))}>Previous</Button>
            <span>{personOffset+1}–{Math.min(personOffset+30,personSchedule!.total)} of {personSchedule!.total}</span><Button variant="outline" disabled={personOffset+30>=personSchedule!.total} onClick={()=>void loadPerson(person.id,personOffset+30)}>Next</Button></div>}</>}
    </section>}
  </main>;
}
