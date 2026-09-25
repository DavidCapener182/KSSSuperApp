"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCivilDays, londonToday, londonWeekStart } from "@/lib/events/workforce-week";
import { londonDueToIso } from "@/lib/crm/due-time";

type Work = { source:"EVENT"|"SITE_SHIFT";id:string;status:string;service_date:string;report_at:string;shift_starts_at:string;shift_ends_at:string;
  area_label:string;role_name:string;event_name:string;site_name:string;reporting_point:string;
  availability:string;availability_conflict:string|null };
type Declaration = { id:string;state:"AVAILABLE"|"UNAVAILABLE";starts_at:string;ends_at:string };
type Schedule = { week_start:string;work_total:number;work:Work[];availability:Declaration[] };
const dayLabel=(date:string)=>new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB",{timeZone:"Europe/London",weekday:"long",day:"numeric",month:"long"});
const clock=(date:string)=>new Date(date).toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const availabilityLabel=(item:Work)=>item.availability_conflict==="UNAVAILABLE_CONFLICT"?"Availability conflict with this deployment":
  item.availability_conflict==="COVERAGE_NO_LONGER_DECLARED"?"Declaration no longer covers this deployment":
  item.availability==="DECLARED_AVAILABLE"?"Declared available":item.availability==="DECLARED_UNAVAILABLE"?"Declared unavailable":
  item.availability==="NOT_FULLY_COVERED"?"Not fully covered":"Not declared";

export function MyScheduleClient({initialWeek}:{initialWeek?:string}) {
  const requestSequence=useRef(0);
  const [week,setWeek]=useState(()=>initialWeek??londonWeekStart(londonToday())!);
  const [date,setDate]=useState(()=>londonToday()); const [offset,setOffset]=useState(0);
  const [schedule,setSchedule]=useState<Schedule|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const load=useCallback(async()=>{const sequence=++requestSequence.current;setLoading(true);setError("");try{const q=new URLSearchParams({week,offset:String(offset)});
    const response=await fetch(`/api/my-schedule?${q}`,{cache:"no-store"});const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error??"My Schedule unavailable");if(sequence===requestSequence.current)setSchedule(data.schedule);
  }catch(caught){if(sequence===requestSequence.current)setError(caught instanceof Error?caught.message:"My Schedule unavailable");}
    finally{if(sequence===requestSequence.current)setLoading(false);}},[week,offset]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
  function change(value:string){const monday=londonWeekStart(value);if(!monday)return;setWeek(monday);setDate(value);setOffset(0);}
  const days=Array.from({length:7},(_,index)=>addCivilDays(week,index));
  return <main className="enterprise-main my-schedule-page"><header className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Your operational week</p><h1>My Schedule</h1>
    <p>Your allocated work and availability declarations, shown separately. Accepted work is not attendance or worked time.</p></div></header>
    <div className="workforce-toolbar"><Button variant="outline" onClick={()=>change(addCivilDays(week,-7))}>Previous week</Button>
      <Button variant="outline" onClick={()=>change(londonToday())}>This week</Button><Button variant="outline" onClick={()=>change(addCivilDays(week,7))}>Next week</Button>
      <label>Go to date <Input type="date" value={date} onChange={(event)=>change(event.target.value)} /></label></div>
    <p className="enterprise-honesty">Review offers from each duty below. Change declarations in <Link href="/my-availability">My Availability</Link>.</p>
    {error&&<p role="alert" className="enterprise-error">{error} <Button variant="outline" onClick={()=>void load()}>Retry</Button></p>}
    {loading?<p role="status" className="crm-skeleton">Loading your schedule…</p>:schedule&&<>
      <div className="my-schedule-days">{days.map((day)=>{const work=schedule.work.filter((item)=>item.service_date===day);
        const dayStart=londonDueToIso(`${day}T00:00`)!;
        const dayEnd=londonDueToIso(`${addCivilDays(day,1)}T00:00`)!;
        const declarations=schedule.availability.filter((item)=>item.ends_at>dayStart&&item.starts_at<dayEnd);
        return <section key={day} className="my-schedule-day"><h2>{dayLabel(day)}</h2>
          {work.length===0&&declarations.length===0?<p className="crm-empty">No work or declaration shown for this day.</p>:<>
            {work.map((item)=><article className="crm-panel my-schedule-work" key={item.id}><p className="enterprise-eyebrow">{item.source==="EVENT"?"Event work":"Ongoing Site shift"} · {item.status==="ALLOCATED"?"Awaiting your response":"Accepted"}</p>
              <h3>{item.event_name}</h3><p>{item.site_name} · {item.role_name} · {item.area_label}</p>
              {item.reporting_point&&<p>Reporting point: {item.reporting_point}</p>}
              <p>Report {clock(item.report_at)} · Shift {clock(item.shift_starts_at)} → {clock(item.shift_ends_at)}</p>
              <p className={item.availability_conflict?"workforce-alert":""}>{availabilityLabel(item)}</p>
              <Link href={`/my-deployments?allocationId=${encodeURIComponent(item.id)}&source=${item.source}&returnWeek=${week}`}>{item.status==="ALLOCATED"?"Review offer":"View deployment"}</Link></article>)}
            {declarations.map((item)=><article className="my-schedule-declaration" key={item.id}><strong>{item.state==="AVAILABLE"?"Available":"Unavailable"} declaration</strong>
              <span>{clock(item.starts_at)} → {clock(item.ends_at)}</span></article>)}
          </>}</section>;})}</div>
      {schedule.work_total>50&&<div className="deployment-pagination"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</Button>
        <span>{offset+1}–{Math.min(offset+50,schedule.work_total)} of {schedule.work_total} allocations</span>
        <Button variant="outline" disabled={offset+50>=schedule.work_total} onClick={()=>setOffset(offset+50)}>Next</Button></div>}
    </>}
  </main>;
}
