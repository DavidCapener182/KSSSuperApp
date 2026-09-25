"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkforcePlanner } from "@/components/workforce-planner";
import { addCivilDays, londonToday, londonWeekStart } from "@/lib/events/workforce-week";
import type { WorkforceReturnState } from "@/lib/events/workforce-navigation";

const dayLabel = (value:string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB",{timeZone:"Europe/London",weekday:"long",day:"numeric",month:"long"});

export function WorkforceClient({ initial = {}, allowLocalSample = false }: { initial?: Partial<WorkforceReturnState>; allowLocalSample?: boolean }) {
  const [week,setWeek]=useState(()=>initial.week ?? londonWeekStart(londonToday())!);
  const [selectedDay,setSelectedDay]=useState(()=>initial.day ?? londonToday());
  function changeWeek(value:string){const next=londonWeekStart(value);if(!next)return;setWeek(next);setSelectedDay(value);}
  const days=Array.from({length:7},(_,index)=>addCivilDays(week,index));
  return <main className="enterprise-main workforce-page">
    <header className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Operational planning · synthetic development data</p><h1>Workforce</h1><p>People, assigned shifts and unfilled Event and Site Shift demand in one week.</p></div></header>
    <section className="workforce-toolbar" aria-label="Choose schedule week"><Button variant="outline" onClick={()=>changeWeek(addCivilDays(week,-7))}>Previous week</Button><Button variant="outline" onClick={()=>changeWeek(londonToday())}>Today</Button><Button variant="outline" onClick={()=>changeWeek(addCivilDays(week,7))}>Next week</Button><label>Go to date <Input type="date" value={selectedDay} onChange={event=>changeWeek(event.target.value)} /></label><strong>Week of {dayLabel(week)}</strong></section>
    <WorkforcePlanner week={week} selectedDay={days.includes(selectedDay)?selectedDay:week} onSelectDay={setSelectedDay} initial={initial} allowLocalSample={allowLocalSample} onShowSample={()=>{setWeek("2026-09-21");setSelectedDay("2026-09-24");}} />
  </main>;
}
