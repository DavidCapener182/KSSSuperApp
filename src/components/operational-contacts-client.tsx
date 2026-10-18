"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Route = { id:string; purpose:string; state:string; priority:number; display_name:string|null;
 role_organisation:string|null; phone:string|null; email:string|null; effective_from:string; effective_until:string;
 london_start:string|null; london_end:string|null; reviewed_on:string };
type Context = { context_kind:"SITE"|"SITE_SERVICE"|"EVENT"; context_id:string; context_name?:string; routes:Route[] };
type Result = { contexts:Context[] };
const purpose = (value:string) => value.split("_").map((word) => word==="KSS"?word:word[0]+word.slice(1).toLowerCase()).join(" ");
const date = (value:string) => new Date(value).toLocaleString("en-GB", { timeZone:"Europe/London", day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
const state = (value:string) => value === "REVIEW_REQUIRED" ? "Contact requires review" : value === "SOURCE_UNAVAILABLE" ? "Contact source unavailable" : value === "EXPIRED" ? "Contact expired" : "Contact is not applicable now";

export function OperationalContactsClient({allocationId,source}:{allocationId?:string;source?:"EVENT"|"SITE_SHIFT"}) {return <ContactAllocationScope key={`${source}:${allocationId}`} allocationId={allocationId} source={source}/>;}
function ContactAllocationScope({allocationId,source}:{allocationId?:string;source?:"EVENT"|"SITE_SHIFT"}) {
 const active=useRef(true),sequence=useRef(0);
 const expire=useCallback(()=>{active.current=false;sequence.current++},[]);
 useEffect(()=>{active.current=true;return expire},[expire]);
 const [data,setData]=useState<Result|null>(null); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
 const refresh=useCallback(async()=>{
  if (!allocationId||!source) return;
  const ticket=++sequence.current;setData(null);setLoading(true);
  try {
   const response=await fetch(`/api/operational-contacts?view=allocation&source=${source}&allocationId=${encodeURIComponent(allocationId)}`,{cache:"no-store"});
   if (!response.ok) throw new Error("Current contact access is unavailable. Your allocation or time window may have changed.");
   const result=await response.json();if(!active.current||ticket!==sequence.current)return;setData(result);setError("");
  } catch(caught) {if(!active.current||ticket!==sequence.current)return;setData(null);setError(caught instanceof Error?caught.message:"Current contact access is unavailable."); }
  finally {if(active.current&&ticket===sequence.current)setLoading(false);}
 },[allocationId,source]);
 useEffect(()=>{const timer=setTimeout(()=>void refresh(),0); const poll=window.setInterval(()=>{if(document.visibilityState==="visible") void refresh();},15000);
  const onFocus=()=>void refresh(); const onVisible=()=>{if(document.visibilityState==="visible") void refresh();};
  window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onVisible);
  return()=>{clearTimeout(timer);clearInterval(poll);window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisible);};},[refresh]);
 if (!allocationId||!source) return <p className="contact-gap">Open Operational contacts from your exact accepted <Link href="/my-deployments">My Deployment or Site Shift</Link>.</p>;
 return <div className="contact-contexts">
  <div className="contact-duty-context"><div><p className="enterprise-eyebrow">Exact accepted duty</p><p>{source==="EVENT"?"Event allocation":"Site Shift allocation"} · <code>{allocationId}</code></p></div><div className="contact-toolbar"><Link href="/my-deployments">Back to My Deployments</Link><button type="button" onClick={()=>void refresh()} disabled={loading}>Refresh current contacts</button></div></div>
  {loading&&<p role="status">Checking current access…</p>}
  {error&&<p className="enterprise-error" role="alert">{error}</p>}
  {data&&data.contexts.length===0&&<p className="contact-gap" role="status">No published contact contexts were returned for this exact duty. Refresh current contacts before relying on an older contact sheet.</p>}{data?.contexts.map((context)=><section key={context.context_id} aria-label={`${context.context_kind.replace("_"," ")} contacts`}>
   <div className="contact-context-heading"><p className="enterprise-eyebrow">Published for this allocation</p><h2>{context.context_name} <span>· {context.context_kind==="SITE_SERVICE"?"Site Service":context.context_kind==="SITE"?"Site":"Event"}</span></h2><p>Exact context: {context.context_id}</p></div>
   <div className="contact-purpose-groups">
    {Array.from(new Set(context.routes.map(route=>route.purpose))).map(group=><section key={group} className="contact-purpose-group"><h3>{purpose(group)}</h3><div className="contact-cards">{context.routes.filter(route=>route.purpose===group).map((route)=><article className="contact-card" key={route.id}>
     <div className="contact-card-top"><span>Published route</span><strong>{route.priority===1?"Primary contact":`Backup ${route.priority-1}`}</strong></div>
     {route.state==="CURRENT"?<><h4>{route.display_name}</h4><p>{route.role_organisation}</p>
      <div className="contact-actions">{route.phone&&<a href={`tel:${route.phone}`} aria-label={`Call ${route.display_name} on the published telephone number`}>Call {route.phone}</a>}
       {route.email&&<a href={`mailto:${route.email}`} aria-label={`Email ${route.display_name} at the published email address`}>Email {route.email}</a>}</div>
      <p className="contact-handoff">Opens your device’s phone or email app. KSS does not send or track the contact.</p></>
      :<p className="contact-gap" role="status">{state(route.state)}</p>}
     <dl><div><dt>Applicable</dt><dd>{date(route.effective_from)} to {date(route.effective_until)}{route.london_start&&route.london_end?` · Daily London ${route.london_start}–${route.london_end}`:""}</dd></div>
      <div><dt>Last reviewed</dt><dd>{route.reviewed_on.split("-").reverse().join("/")}</dd></div></dl>
    </article>)}</div></section>)}
    {!context.routes.some((route)=>route.purpose==="KSS_ESCALATION"&&route.state==="CURRENT")&&
     <p className="contact-gap">No current KSS escalation contact published for this {context.context_kind==="SITE_SERVICE"?"Site Service":context.context_kind.toLowerCase()}.</p>}
   </div>
  </section>)}
 </div>;
}
