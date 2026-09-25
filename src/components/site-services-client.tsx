"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { londonToday } from "@/lib/events/workforce-week";
import journey from "./commercial-journey.module.css";

type Service = { id:string;name:string;type:string;state:string;effective_from:string;effective_until:string|null;
  client_name:string;site_name:string;owner_name:string };
const types = ["STATIC_GUARDING","GATEHOUSE","RETAIL_SECURITY","PATROL","RECEPTION_SECURITY","OTHER"];
export function SiteServicesClient({siteId,personId,canAdmin,mobilisationId}:{siteId:string;personId:string;canAdmin:boolean;mobilisationId?:string}) {
  const [items,setItems]=useState<Service[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const [name,setName]=useState("");const [type,setType]=useState("STATIC_GUARDING");
  const [from,setFrom]=useState(londonToday());const [busy,setBusy]=useState(false);
  const load=useCallback(async():Promise<Service[]|null>=>{setLoading(true);setError("");try{const response=await fetch(`/api/site-services?site=${siteId}`,{cache:"no-store"});
    const result=await response.json();if(!response.ok)throw Error(result.error??"Services unavailable");const next:Service[]=result.services??[];setItems(next);return next;
  }catch(caught){setError(caught instanceof Error?caught.message:"Services unavailable");return null;}finally{setLoading(false);}},[siteId]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
  async function create(){setBusy(true);setError("");try{const response=await fetch("/api/site-services",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({siteId,name,type,effectiveFrom:from,ownerId:personId})});const result=await response.json();
    if(!response.ok)throw Error(result.error??"Service could not be created");const confirmed=await load();
    if(!confirmed?.some((item)=>item.id===result.id))throw Error("The Service response could not be confirmed in this Site list. Refresh before trying again.");setName("");
  }catch(caught){setError(caught instanceof Error?caught.message:"Service could not be created");}finally{setBusy(false);}}
  return <main className={`enterprise-main ${journey.controls}`}><header className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Ongoing Site work</p>
    <h1>Site Services</h1><p>Each Service belongs to this exact Client-linked Site. Dated shifts and Events remain separate.</p></div></header>
    <nav className={journey.context} aria-label="Site Service context"><Link href={`/sites?view=operational&selected=${siteId}`}>Site context</Link><span>→</span><strong>Ongoing Site Services</strong><span>· Each Service has its own identity and dated shift demand.</span></nav>
    {mobilisationId && <p className="enterprise-honesty">Create or choose an exact Site Service here, then return to Mobilisation to link it explicitly. The Service source retains its own authority.</p>}
    {error&&<p role="alert" className="enterprise-error">{error} <Button variant="outline" onClick={()=>void load()}>Retry</Button></p>}
    {canAdmin&&<form className="crm-panel sites-form" onSubmit={(event)=>{event.preventDefault();void create();}}>
      <h2>New Site Service</h2><label>Name<Input value={name} maxLength={180} required onChange={(event)=>setName(event.target.value)} /></label>
      <label>Service type<select value={type} onChange={(event)=>setType(event.target.value)}>{types.map((item)=><option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}</select></label>
      <label>Effective from<Input type="date" value={from} onChange={(event)=>setFrom(event.target.value)} /></label>
      <Button disabled={busy}>Create draft Service</Button></form>}
    {loading?<p role="status" className="crm-skeleton">Loading Site Services…</p>:items.length===0?<p className="crm-empty">No ongoing Service is recorded for this Site.</p>:
      <div className="crm-list">{items.map((item)=><div key={item.id}><Link className="crm-row" href={`/sites/${siteId}/services/${item.id}`}>
        <strong>{item.name}</strong><span>{item.client_name} · {item.site_name}</span>
        <span>{item.type.replaceAll("_"," ")} · Service {item.state} · Owner {item.owner_name}</span></Link>
        {mobilisationId && <p><Link href={`/mobilisations/${mobilisationId}?sourceType=SITE_SERVICE&sourceId=${item.id}#links-heading`}>Return with exact Service ID for explicit link</Link></p>}</div>)}</div>}
  </main>;
}
