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
const headings = [["LIVE_NOW","Live Now"],["UPCOMING","Upcoming"],["NEEDS_ATTENTION","Needs Attention"],["RECENT_OPERATIONS","Recent Operations"]] as const;
const clock = (value:string) => new Date(value).toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const linkFor = (card:Card) => card.source === "EVENT" ? `/events/${card.source_id}` : `/sites/${card.site_id}/services/${card.source_id}`;
const attendanceLink = (card:Card) => card.source === "EVENT" ? `/events/${card.source_id}/attendance` : `/sites/${card.site_id}/services/${card.source_id}/attendance`;
function CardView({card,large=false}:{card:Card;large?:boolean}) {
  return <article className="control-card"><div className="control-card-head"><div><p className="control-source">{card.source === "EVENT" ? "Event" : "Site shift"} · {card.source_state.replaceAll("_"," ")}</p><h3>{card.name}</h3><p>{card.site_name}</p></div><span className="control-kind">{card.kind.replaceAll("_"," ")}</span></div>
    <p className="control-time">{clock(card.starts_at)} – {clock(card.ends_at)}</p>
    <div className="control-metrics" aria-label="Staffing facts"><span><strong>{card.required}</strong> required</span><span><strong>{card.allocated}</strong> allocated</span><span><strong>{card.accepted}</strong> accepted</span><span><strong>{card.required-card.allocated}</strong> remaining</span></div>
    <p className="control-facts">{card.checked_in} checked in · {card.attendance_reviews} attendance reviews · {card.conflicts === 0 ? "No explicit availability conflict" : `${card.conflicts} explicit availability conflicts`}</p>
    {!large&&<div className="control-links"><Link href={linkFor(card)}>Open {card.source === "EVENT" ? "Event" : "Site Service"} →</Link><Link href={attendanceLink(card)}>Attendance →</Link></div>}
  </article>;
}
export function ControlRoomClient() {
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null); const [source,setSource]=useState(""); const [site,setSite]=useState("");
  const [offset,setOffset]=useState(0); const [error,setError]=useState(""); const [loading,setLoading]=useState(true);
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
  const stale=!snapshot||Boolean(error)||now-Date.parse(snapshot.as_of)>60000;
  const cards=snapshot?.cards??[];
  const attention=snapshot?.attention??[];
  return <main className={`enterprise-main control-room ${large?"control-large":""}`}>
    <header className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Synthetic development · operational facts</p><h1>Control Room</h1><p>Event and Site Service facts from their authoritative modules.</p></div></header>
    <div className="control-toolbar"><label>Source <select value={source} onChange={(e)=>{setSource(e.target.value);setOffset(0);}}><option value="">Events and Site shifts</option><option value="EVENT">Events</option><option value="SITE_SHIFT">Site shifts</option></select></label>
      <label>Site <select value={site} onChange={(e)=>{setSite(e.target.value);setOffset(0);}}><option value="">All Sites</option>{snapshot?.sites?.map((choice)=><option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>
      <Button type="button" variant="outline" onClick={()=>void load()} disabled={loading}>Refresh</Button>
      <Button type="button" variant="outline" aria-pressed={large} onClick={()=>setLarge(!large)}>{large?"Standard view":"Large display"}</Button></div>
    <p className="control-freshness" aria-live="polite">{snapshot?`Snapshot ${clock(snapshot.as_of)} · ${stale?"Stale — refresh required":"Current as of snapshot"}`:"Loading snapshot"}{loading?" · Refreshing…":""}</p>
    {error&&<p role="alert" className="enterprise-error">{error}</p>}
    {snapshot&&<><p className="control-window">Today {snapshot.today} · Upcoming through {snapshot.upcoming_until} · Recent from {snapshot.recent_from}. Showing {cards.length} of {snapshot.total} source records.</p>
      {headings.map(([key,title])=><section key={key} aria-labelledby={`control-${key}`} className="control-section"><h2 id={`control-${key}`}>{title}</h2>
        {key==="NEEDS_ATTENTION"?<div className="control-attention"><p className="control-attention-count">Showing {attention.length} of {snapshot.attention_total} source records needing attention.</p>
          {attention.map((card)=><article key={`${card.source}-${card.source_id}-${card.service_date??""}`} className="control-alert"><strong>{card.name} · {card.site_name}</strong><span>{clock(card.starts_at)}</span>
            <ul>{card.required>card.allocated&&<li>{card.required-card.allocated} staffing positions remaining</li>}{card.awaiting_response>0&&<li>{card.awaiting_response} Staff awaiting response</li>}{card.conflicts>0&&<li>{card.conflicts} explicit availability conflicts</li>}{card.attendance_reviews>0&&<li>{card.attendance_reviews} attendance reviews required</li>}{card.recorded_no_shows>0&&<li>{card.recorded_no_shows} explicitly recorded no-shows</li>}</ul>
            {!large&&<Link href={linkFor(card)}>Open source →</Link>}</article>)}
          {snapshot.horizon&&(snapshot.horizon.overdue||snapshot.horizon.latest_partial)&&<p className="control-alert">Static horizon maintenance {snapshot.horizon.overdue?"overdue":"latest run needs review"}. Materialisation may be incomplete. Window ends {snapshot.horizon.window_until}.</p>}
          {snapshot.incidents&&snapshot.incidents.count>0&&<div className="control-alert"><strong>{snapshot.incidents.count} open Incidents</strong>{!large&&snapshot.incidents.items.map((item)=><p key={item.id}><Link href={`/incidents/${item.id}`}>{item.status} Incident · {item.context_label} · {clock(item.created_at)} →</Link></p>)}</div>}
          {attention.length===0&&!snapshot.incidents?.count&&!snapshot.horizon?.overdue&&!snapshot.horizon?.latest_partial&&<p>No attention facts in this page of the snapshot.</p>}
        </div>:<div className="control-grid">{cards.filter((card)=>card.area===key).map((card)=><CardView key={`${card.source}-${card.source_id}-${card.service_date??""}`} card={card} large={large}/>)}{!cards.some((card)=>card.area===key)&&<p>No source records in this page.</p>}</div>}</section>)}
      {snapshot.incidents&&<p className="control-note">Incident follow-up is visible under your separate Incident Reviewer authority.</p>}
      <div className="control-pages"><Button variant="outline" disabled={offset===0||loading} onClick={()=>setOffset(Math.max(0,offset-30))}>Previous</Button><Button variant="outline" disabled={offset+cards.length>=snapshot.total||loading} onClick={()=>setOffset(offset+30)}>Next</Button></div>
      <p className="control-note">Checked in means a recorded attendance fact. Missing attendance and unavailable sources are not zero or no-show. No worked or payable time is shown.</p>
    </>}
  </main>;
}
