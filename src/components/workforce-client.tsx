"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkforcePlanner } from "@/components/workforce-planner";
import { addCivilDays, londonToday, londonWeekStart } from "@/lib/events/workforce-week";

type PersonChoice = { id:string;display_name:string };
type PersonRow = { source:"EVENT"|"SITE_SHIFT";service_id:string|null;site_id?:string;id:string;status:string;service_date:string;report_at:string;shift_starts_at:string;shift_ends_at:string;area_label:string;role_name:string;event_name:string;site_name:string;event_id:string|null;requirement_id:string;availability:string;availability_conflict:string|null;approved_time_away_conflict:boolean };
type PersonSchedule = { total:number;items:PersonRow[] };
const dayLabel = (value:string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB",{timeZone:"Europe/London",weekday:"long",day:"numeric",month:"long"});
const clock = (value:string) => new Date(value).toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const status = (code:string) => code === "UNAVAILABLE_CONFLICT" ? "Declared unavailable conflict" : code === "COVERAGE_NO_LONGER_DECLARED" ? "Declaration no longer covers duty" : code === "DECLARED_AVAILABLE" ? "Declared available" : code === "DECLARED_UNAVAILABLE" ? "Declared unavailable" : code === "NOT_FULLY_COVERED" ? "Not fully covered" : "Not declared";
async function read(path:string) { const response=await fetch(path,{cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error??"Workforce unavailable");return data; }

export function WorkforceClient() {
  const [week,setWeek]=useState(()=>londonWeekStart(londonToday())!);
  const [selectedDay,setSelectedDay]=useState(()=>londonToday());
  const [view,setView]=useState<"week"|"staff">("week");
  const [error,setError]=useState("");
  const [staffSearch,setStaffSearch]=useState("");const [appliedStaffSearch,setAppliedStaffSearch]=useState("");
  const [staffChoices,setStaffChoices]=useState<PersonChoice[]>([]);
  const [staffTotal,setStaffTotal]=useState(0);const [staffOffset,setStaffOffset]=useState(0);
  const [person,setPerson]=useState<PersonChoice|null>(null);const [personSchedule,setPersonSchedule]=useState<PersonSchedule|null>(null);
  const [personOffset,setPersonOffset]=useState(0);
  const searchStaff=useCallback(async(search:string,page:number)=>{try{const q=new URLSearchParams({week,search,offset:String(page)});const result=await read(`/api/workforce/staff?${q}`);setStaffChoices(result.choices.items);setStaffTotal(result.choices.total);setStaffOffset(page);}catch(caught){setError(caught instanceof Error?caught.message:"Staff search unavailable");}},[week]);
  const loadPerson=useCallback(async(id:string,page:number)=>{try{const q=new URLSearchParams({week,person:id,offset:String(page)});const result=await read(`/api/workforce/staff?${q}`);setPersonSchedule(result.schedule);setPersonOffset(page);}catch(caught){setError(caught instanceof Error?caught.message:"Staff schedule unavailable");}},[week]);
  useEffect(()=>{if(view!=="staff")return;const timer=setTimeout(()=>{if(person)void loadPerson(person.id,0);else void searchStaff(appliedStaffSearch,0);},0);return()=>clearTimeout(timer);},[view,person,week,appliedStaffSearch,loadPerson,searchStaff]);
  function changeWeek(value:string){const next=londonWeekStart(value);if(!next)return;setWeek(next);setSelectedDay(value);setPersonOffset(0);}
  const days=Array.from({length:7},(_,index)=>addCivilDays(week,index));
  return <main className="enterprise-main workforce-page">
    <header className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Operational planning · synthetic development data</p><h1>Workforce</h1><p>Event and ongoing Site Shift demand, allocation, Staff response and availability remain separate facts.</p></div></header>
    <div className="workforce-tabs" role="tablist" aria-label="Workforce views"><Button role="tab" aria-selected={view==="week"} variant={view==="week"?"default":"outline"} onClick={()=>setView("week")}>Planning</Button><Button role="tab" aria-selected={view==="staff"} variant={view==="staff"?"default":"outline"} onClick={()=>setView("staff")}>Staff schedule</Button></div>
    <section className="workforce-toolbar" aria-label="Choose schedule week"><Button variant="outline" onClick={()=>changeWeek(addCivilDays(week,-7))}>Previous week</Button><Button variant="outline" onClick={()=>changeWeek(londonToday())}>This week</Button><Button variant="outline" onClick={()=>changeWeek(addCivilDays(week,7))}>Next week</Button><label>Go to date <Input type="date" value={selectedDay} onChange={event=>changeWeek(event.target.value)} /></label><strong>Week of {dayLabel(week)}</strong></section>
    {error&&view==="staff"&&<p role="alert" className="enterprise-error">{error}</p>}
    {view==="week"&&<WorkforcePlanner week={week} selectedDay={days.includes(selectedDay)?selectedDay:week} onSelectDay={setSelectedDay} />}
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
              <p>{status(item.availability_conflict??item.availability)}</p>{item.approved_time_away_conflict&&<p className="workforce-warnings">Approved time away conflict · review required</p>}<Link href={item.source==="EVENT"?`/events/${item.event_id}?requirement=${item.requirement_id}`:`/sites/${item.site_id}/services/${item.service_id}?demand=${item.requirement_id}`}>Open requirement</Link></article>)}</div>}
          {(personSchedule?.total??0)>30&&<div className="deployment-pagination"><Button variant="outline" disabled={personOffset===0} onClick={()=>void loadPerson(person.id,Math.max(0,personOffset-30))}>Previous</Button>
            <span>{personOffset+1}–{Math.min(personOffset+30,personSchedule!.total)} of {personSchedule!.total}</span><Button variant="outline" disabled={personOffset+30>=personSchedule!.total} onClick={()=>void loadPerson(person.id,personOffset+30)}>Next</Button></div>}</>}
    </section>}
  </main>;
}
