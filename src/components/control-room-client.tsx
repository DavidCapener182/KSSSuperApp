"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import "./control-room.css";

type Card = { source:"EVENT"|"SITE_SHIFT"; source_id:string; site_id:string; service_date:string|null;
  name:string;site_name:string;source_state:string;kind:string;starts_at:string;ends_at:string;area:string;
  required:number;allocated:number;accepted:number;awaiting_response:number;conflicts:number;
  checked_in:number;attendance_reviews:number;recorded_no_shows:number };
type Snapshot = { as_of:string;today:string;upcoming_until:string;recent_from:string;total:number;attention_total:number;attention:Card[];
  cards:Card[];sites:{id:string;name:string}[];incidents:{count:number;items:{id:string;status:string;created_at:string;context_label:string}[]}|null;
  horizon:{window_until:string;last_success_at:string|null;overdue:boolean;latest_partial:boolean}|null };
type Tab = "attention"|"staffing"|"attendance"|"incidents"|"handover"|"operations";
type Initial = { source?:"EVENT"|"SITE_SHIFT";site?:string;offset?:number;tab?:Tab;focus?:string };
const tabs: {id:Tab;label:string}[] = [{id:"attention",label:"All attention"},{id:"staffing",label:"Staffing"},{id:"attendance",label:"Attendance"},{id:"incidents",label:"Incidents"},{id:"handover",label:"Handover"},{id:"operations",label:"All operations"}];
const clock = (value:string) => new Date(value).toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const linkFor = (card:Card) => card.source === "EVENT" ? `/events/${card.source_id}` : `/sites/${card.site_id}/services/${card.source_id}`;
const attendanceLink = (card:Card) => card.source === "EVENT" ? `/events/${card.source_id}/attendance` : `/sites/${card.site_id}/services/${card.source_id}/attendance`;
export function ControlRoomClient({initial={}}:{initial?:Initial}) {
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null); const [source,setSource]=useState(initial.source??""); const [site,setSite]=useState(initial.site??"");
  const [offset,setOffset]=useState(initial.offset??0); const [tab,setTab]=useState<Tab>(initial.tab??"attention"); const [error,setError]=useState(""); const [loading,setLoading]=useState(true);
  const [visibleCount,setVisibleCount]=useState(10);
  const [large,setLarge]=useState(false); const [now,setNow]=useState(0); const sequence=useRef(0);
  const load=useCallback(async()=>{const id=++sequence.current;setLoading(true);setError("");
    const query=new URLSearchParams({offset:String(offset)});if(source)query.set("source",source);if(site)query.set("site",site);
    try{const response=await fetch(`/api/control-room?${query}`,{cache:"no-store"});
      if(!response.ok)throw new Error("Control Room unavailable. The previous snapshot is stale.");
      const data=await response.json();if(id===sequence.current){setSnapshot(data.snapshot);setNow(Date.now());}
    }catch(caught){if(id===sequence.current)setError(caught instanceof Error?caught.message:"Control Room unavailable");}
    finally{if(id===sequence.current)setLoading(false);}},[source,site,offset]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
  useEffect(()=>{const timer=setInterval(()=>{setNow(Date.now());if(!document.hidden)void load();},60000);return()=>clearInterval(timer);},[load]);
  useEffect(()=>{const onVisible=()=>{if(document.visibilityState==="visible")void load();};document.addEventListener("visibilitychange",onVisible);return()=>document.removeEventListener("visibilitychange",onVisible);},[load]);
  const stale=!snapshot||Boolean(error)||now-Date.parse(snapshot.as_of)>60000;
  const cards=snapshot?.cards??[];
  const attention=[...(snapshot?.attention??[])].sort((a,b)=>{
    const aPast=Date.parse(a.ends_at)<now,bPast=Date.parse(b.ends_at)<now;
    if(aPast!==bPast)return aPast?1:-1;
    return aPast?Date.parse(b.starts_at)-Date.parse(a.starts_at):Date.parse(a.starts_at)-Date.parse(b.starts_at);
  });
  const staffing=(card:Card)=>[card.required>card.allocated?`${card.required-card.allocated} positions open`:null,card.awaiting_response>0?`${card.awaiting_response} awaiting Staff response`:null,card.conflicts>0?`${card.conflicts} explicit availability conflicts`:null].filter(Boolean) as string[];
  const attendance=(card:Card)=>[card.attendance_reviews>0?`${card.attendance_reviews} attendance reviews required`:null,card.recorded_no_shows>0?`${card.recorded_no_shows} recorded no-shows`:null].filter(Boolean) as string[];
  const visible=tab==="staffing"?attention.filter(card=>staffing(card).length>0):tab==="attendance"?attention.filter(card=>attendance(card).length>0):tab==="operations"?cards:attention;
  const key=(card:Card)=>`${card.source}:${card.source_id}:${card.service_date??""}`;
  const focusedIndex=initial.focus?visible.findIndex(card=>key(card)===initial.focus):-1;
  const shownCount=Math.max(visibleCount,focusedIndex+1);
  const returnPath=(card:Card)=>{const query=new URLSearchParams({tab,offset:String(offset),focus:key(card)});if(source)query.set("source",source);if(site)query.set("site",site);return `/control-room?${query}`;};
  const linked=(path:string,card:Card)=>`${path}?returnTo=${encodeURIComponent(returnPath(card))}`;
  return <main className={`enterprise-main control-room ${large?"control-large":""}`}>
    <header className="control-desk-header"><div><p className="enterprise-eyebrow">Operations / source facts</p><h1>Control Room</h1><p>Find an exception, act in its source, then return to a fresh desk view.</p></div><span>{snapshot?new Date(`${snapshot.today}T12:00:00Z`).toLocaleDateString("en-GB",{timeZone:"Europe/London",weekday:"long",day:"numeric",month:"long"}):"Today"}</span></header>
    <nav className="control-tabs" aria-label="Control Room views">{tabs.map(item=><button key={item.id} type="button" aria-current={tab===item.id?"page":undefined} onClick={()=>{setTab(item.id);setVisibleCount(10);}}>{item.label}</button>)}</nav>
    <div className="control-toolbar"><label>Source <select value={source} onChange={(e)=>{setSource(e.target.value);setOffset(0);setVisibleCount(10);}}><option value="">Events and Site shifts</option><option value="EVENT">Events</option><option value="SITE_SHIFT">Site shifts</option></select></label>
      <label>Site <select value={site} onChange={(e)=>{setSite(e.target.value);setOffset(0);setVisibleCount(10);}}><option value="">All Sites</option>{snapshot?.sites?.map((choice)=><option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>
      <Button type="button" variant="outline" onClick={()=>void load()} disabled={loading}>Refresh</Button>
      <Button type="button" variant="outline" aria-pressed={large} onClick={()=>setLarge(!large)}>{large?"Standard view":"Large display"}</Button></div>
    <p className="control-freshness" aria-live="polite">{snapshot?`Snapshot ${clock(snapshot.as_of)} · ${stale?"Stale — refresh required":"Current as of snapshot"}`:"Loading snapshot"}{loading?" · Refreshing…":""}</p>
    {error&&<p role="alert" className="enterprise-error">{error}</p>}
    {snapshot&&<><p className="control-window">Today {snapshot.today} · Upcoming through {snapshot.upcoming_until} · Recent from {snapshot.recent_from}.</p>
      {initial.focus&&!visible.some(card=>key(card)===initial.focus)&&tab!=="handover"&&tab!=="incidents"&&<p className="control-return-note" role="status">The source you returned from is no longer on this page of this view. It may have changed, moved or disappeared from these filters. Refresh or change filters to inspect current facts.</p>}
      {tab==="handover"?<section className="control-desk-empty"><h2>Handover needs a separate read</h2><p>Site Book owns current handover and outstanding items. This snapshot has no Site Book attention facts, so this view cannot show a current duty-level count.</p><Link href="/site-book">Open authorised Site Books →</Link></section>:
      tab==="incidents"?<section className="control-desk-list"><div className="control-list-intro"><h2>Incidents</h2><p>Open references appear only under separate Incident Reviewer authority.</p></div>{snapshot.incidents===null?<p className="control-desk-empty">Incident review is unavailable under your current authority.</p>:snapshot.incidents.count===0?<p className="control-desk-empty">No open Incident references in this snapshot.</p>:<><p>{snapshot.incidents.count} open Incident references.</p>{!large&&snapshot.incidents.items.map(item=><article className="control-desk-row" key={item.id}><div><span className="control-reason">Incident · {item.status}</span><h3>{item.context_label}</h3><p>{clock(item.created_at)}</p></div><Link href={`/incidents/${item.id}`}>Open Incident →</Link></article>)}{large&&<p>Individual Incident links are hidden in large display.</p>}</>}</section>:
      <section className="control-desk-list" aria-label={tab==="operations"?"All operations":"Needs attention"}><div className="control-list-intro"><h2>{tab==="operations"?"All operations":tab==="staffing"?"Staffing attention":tab==="attendance"?"Attendance attention":"Needs attention"}</h2><p>{tab==="operations"?`Showing ${cards.length} of ${snapshot.total} source records.`:`Showing ${visible.length} matching records on this page · ${snapshot.attention_total} attention records in the snapshot.`}</p></div>
        {visible.length===0&&<p className="control-desk-empty">No matching source records on this page. This is not a readiness verdict.</p>}
        {visible.slice(0,shownCount).map(card=><article className={`control-desk-row${key(card)===initial.focus?" control-desk-focused":""}`} id={key(card)===initial.focus?"returned-source":undefined} key={key(card)}><div className="control-row-main"><div className="control-row-top"><span>{card.source==="EVENT"?"Event":"Site shift"} · {card.source_state.replaceAll("_"," ")} · {card.area.replaceAll("_"," ")}</span><span>{clock(card.starts_at)} – {clock(card.ends_at)}</span></div><h3>{card.name}</h3><p>{card.site_name} · {card.kind.replaceAll("_"," ")}</p><div className="control-reasons">{(tab==="staffing"?staffing(card):tab==="attendance"?attendance(card):[...staffing(card),...attendance(card)]).map(reason=><span className="control-reason" key={reason}>{reason}</span>)}{tab==="operations"&&staffing(card).length+attendance(card).length===0&&<span className="control-neutral">No attention fact in this snapshot</span>}</div><div className="control-row-facts"><span><strong>{card.required}</strong> required</span><span><strong>{card.allocated}</strong> allocated</span><span><strong>{card.accepted}</strong> accepted</span><span><strong>{card.checked_in}</strong> checked in</span></div></div>{!large&&<div className="control-row-actions"><Link href={linked(linkFor(card),card)}>Open {card.source==="EVENT"?"Event":"Site Service"} →</Link>{(card.attendance_reviews>0||card.recorded_no_shows>0||tab==="attendance")&&<Link href={linked(attendanceLink(card),card)}>Review attendance →</Link>}</div>}</article>)}
        {visible.length>shownCount&&<Button variant="outline" onClick={()=>setVisibleCount(shownCount+10)}>Show 10 more · {visible.length-shownCount} remaining on this page</Button>}
      </section>}
      {snapshot.horizon&&(snapshot.horizon.overdue||snapshot.horizon.latest_partial)&&<p className="control-return-note" role="status">Static horizon maintenance {snapshot.horizon.overdue?"overdue":"latest run needs review"}. Materialisation may be incomplete. Window ends {snapshot.horizon.window_until}.</p>}
      {tab!=="incidents"&&tab!=="handover"&&<div className="control-pages"><Button variant="outline" disabled={offset===0||loading} onClick={()=>{setOffset(Math.max(0,offset-30));setVisibleCount(10);}}>Previous</Button><span>{offset+1}–{Math.min(offset+cards.length,snapshot.total)} of {snapshot.total} source records</span><Button variant="outline" disabled={offset+cards.length>=snapshot.total||loading} onClick={()=>{setOffset(offset+30);setVisibleCount(10);}}>Next</Button></div>}
      <p className="control-note">Checked in is a recorded attendance fact. Missing attendance does not establish a no-show. Staffing, attendance, Incidents and Site Book remain independently authorised. No worked or payable time is shown.</p>
    </>}
  </main>;
}
