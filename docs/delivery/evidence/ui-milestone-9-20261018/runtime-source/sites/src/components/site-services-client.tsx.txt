"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { londonToday } from "@/lib/events/workforce-week";
import journey from "./commercial-journey.module.css";
import { SiteOperationPanel } from "./site-operation-panel";
import styles from "./site-operations.module.css";
import { siteDate } from "./site-operations-format";

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
  return <main className={`enterprise-main ${journey.controls} ${styles.workspace}`}><header className={styles.pageHeading}><div><p className="enterprise-eyebrow">Ongoing Site work</p>
    <h1>Site Services</h1><p>{items[0]?.site_name??"Services at the selected Site"} · service plans, effective dates and source-owned staffing.</p></div>    {canAdmin&&<SiteOperationPanel label="New Site Service" title="Create a draft Site Service" context={items[0]?.site_name??"Selected Site"} busy={busy}><form className="crm-panel sites-form" onSubmit={(event)=>{event.preventDefault();void create();}}>
      <h2>New Site Service</h2><label>Name<Input value={name} maxLength={180} required onChange={(event)=>setName(event.target.value)} /></label>
      <label>Service type<select value={type} onChange={(event)=>setType(event.target.value)}>{types.map((item)=><option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}</select></label>
      <label>Effective from<Input type="date" value={from} onChange={(event)=>setFrom(event.target.value)} /></label>
      <div className={styles.reviewSummary} aria-label="Draft Service summary"><strong>{name||"New draft Service"}</strong><p>{type.replaceAll("_"," ")} · effective {from?siteDate(from):"not set"}</p><p>A draft Service does not generate dated shifts or assign Staff.</p></div><Button disabled={busy}>Create draft Service</Button></form></SiteOperationPanel>}
</header>
    <nav className={journey.context} aria-label="Site Service context"><Link href={`/sites?view=operational&selected=${siteId}`}>Site context</Link><span>→</span><strong>Ongoing Site Services</strong><span>· Each Service has its own identity and dated shift demand.</span></nav>
    {mobilisationId && <p className="enterprise-honesty">Create or choose an exact Site Service here, then return to Mobilisation to link it explicitly. The Service source retains its own authority.</p>}
    {error&&<p role="alert" className="enterprise-error">{error} <Button variant="outline" onClick={()=>void load()}>Retry</Button></p>}
    {loading?<p role="status" className="crm-skeleton">Loading Site Services…</p>:items.length===0?<p className="crm-empty">No ongoing Service is recorded for this Site.</p>:
      <div className={styles.register}><div className={styles.registerHeader} aria-hidden="true"><span>Service</span><span>Service type</span><span>Effective period</span><span>Lifecycle</span><span /></div><ul className={styles.serviceList}>{items.map((item)=><li key={item.id}><Link className={styles.serviceRow} href={`/sites/${siteId}/services/${item.id}`}><div><strong>{item.name}</strong><small>{item.client_name} · Owner {item.owner_name}</small></div><div>{item.type.replaceAll("_"," ")}</div><div><span className={styles.quiet}>Effective from</span><br/>{siteDate(item.effective_from)}{item.effective_until?` to ${siteDate(item.effective_until)}`:" onward"}</div><div><span className={styles.state}>{item.state}</span></div><span className={styles.openLink}>Open Service →</span></Link>{mobilisationId&&<p><Link href={`/mobilisations/${mobilisationId}?sourceType=SITE_SERVICE&sourceId=${item.id}#links-heading`}>Return with exact Service ID for explicit link</Link></p>}</li>)}</ul></div>}
  </main>;
}
