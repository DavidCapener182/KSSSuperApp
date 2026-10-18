"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./site-operations.module.css";
import { OperationalDocumentContextCard } from "@/components/operational-document-context-card";

type Row = Record<string, unknown>;
type Choice = { id: string; name: string };
const labels = (value: unknown) => String(value ?? "Unclassified").replaceAll("_"," ").toLowerCase().replace(/(^|\s)\S/g,(s)=>s.toUpperCase());
export function OperationalSitesClient({ selected, office }: { selected?: string; office: boolean }) {
  const [items,setItems] = useState<Row[]>([]); const [total,setTotal] = useState(0);
  const [site,setSite] = useState<Row|null>(null); const [clients,setClients] = useState<Choice[]>([]);
  const [filters,setFilters] = useState({search:"",organisation:"",type:"",status:""}); const [applied,setApplied] = useState(filters);
  const [offset,setOffset] = useState(0); const [loading,setLoading] = useState(true); const [error,setError] = useState("");
  const scope = JSON.stringify({ selected, office, offset, applied });
  const [loadedScope,setLoadedScope] = useState("");
  const requests=useRef(0);
  const load = useCallback(async () => {
    const ticket=++requests.current;
    const current=()=>ticket===requests.current;
    setLoading(true);setError("");
    try { const params=new URLSearchParams({offset:String(offset)});Object.entries(applied).forEach(([key,value])=>{if(value)params.set(key,value);});
      const response=await fetch(`/api/operational-sites?${params}`,{cache:"no-store"});
      if(!current())return;if(!response.ok)throw Error("Operational Sites unavailable");
      const result=await response.json();if(!current())return;
      if(!Array.isArray(result.items)||!Number.isInteger(result.total)||result.total<0)throw Error("Operational Sites unavailable");
      let selectedSite:Row|null=null;
      if(selected){const detail=await fetch(`/api/operational-sites/${selected}`,{cache:"no-store"});
        if(!current())return;if(!detail.ok)throw Error("Site unavailable");
        const body=await detail.json();if(!current())return;
        if(!body.site||body.site.id!==selected)throw Error("The selected Site could not be confirmed.");selectedSite=body.site;
      }
      setItems(result.items);setTotal(result.total);setSite(selectedSite);setLoadedScope(scope);
    }catch(caught){if(current()){setItems([]);setTotal(0);setSite(null);setLoadedScope(scope);setError(caught instanceof Error?caught.message:"Operational Sites unavailable");}}
    finally{if(current())setLoading(false);}
  },[applied,offset,selected,scope]);
  useEffect(()=>{const reads=requests;const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);++reads.current;};},[load]);
  useEffect(()=>{let active=true;void fetch("/api/events/choices",{cache:"no-store"}).then((r)=>r.json()).then((data)=>{if(active)setClients(data.clients ?? []);}).catch(()=>{});return()=>{active=false;};},[]);
  const currentItems=loadedScope===scope?items:[];
  const currentSite=loadedScope===scope?site:null;
  const currentTotal=loadedScope===scope?total:0;
  const currentLoading=loading||loadedScope!==scope;
  return <main className={`enterprise-main events-page ${styles.workspace}`}><p className="eyebrow">Operational locations</p>
    <div className={styles.pageHeading}><div><h1>Sites / Venues</h1><p className="enterprise-intro">Client and Event context is operational. Site administration remains separately guarded.</p></div></div>
    <nav className="crm-tabs"><Link href="/sites" aria-current="page">Sites / Venues</Link><Link href="/events">Events</Link>{office&&<Link href="/sites">Manage my Sites</Link>}</nav>
    <form className="events-filters is-expanded" onSubmit={(e)=>{e.preventDefault();setOffset(0);setApplied({...filters});}}>
      <label>Search<Input maxLength={80} value={filters.search} onChange={(e)=>setFilters({...filters,search:e.target.value})}/></label>
      <label>Client<select value={filters.organisation} onChange={(e)=>setFilters({...filters,organisation:e.target.value})}><option value="">All Clients</option>{clients.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Site type<select value={filters.type} onChange={(e)=>setFilters({...filters,type:e.target.value})}><option value="">All types</option>{["STADIUM","VENUE","RETAIL","WAREHOUSE","OFFICE","FESTIVAL_SITE","STATIC_SITE","OTHER"].map((t)=><option key={t} value={t}>{labels(t)}</option>)}</select></label>
      <label>Status<select value={filters.status} onChange={(e)=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option>{["DRAFT","ACTIVE","RETIRED"].map((t)=><option key={t} value={t}>{labels(t)}</option>)}</select></label>
      <Button>Apply filters</Button></form>
    {error&&<p role="alert" className="enterprise-error">{error}<Button variant="ghost" onClick={()=>void load()}>Retry</Button></p>}
    {currentLoading?<p role="status" className="crm-skeleton">Loading authorised Sites…</p>:<>
      <div className={styles.workspaceSplit}><section className={styles.surface}><h2>Permitted Sites</h2>      <p className="enterprise-honesty">{currentTotal} authorised Site{currentTotal===1?"":"s"}. Unlinked Sites remain valid.</p>
      {currentItems.length===0?(error?null:<p className="crm-empty">No Sites match these filters.</p>):<div className="crm-list">{currentItems.map((row)=><Link className="crm-row" href={`/sites?view=operational&selected=${row.id}`} key={String(row.id)}>
        <strong>{String(row.name)}</strong><span>{String(row.client_name ?? "Unlinked")} · {labels(row.site_type)}</span><span>{labels(row.status)} · {String(row.town_city)}</span></Link>)}</div>}
      <div className="people-pagination"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous</Button><span>{currentItems.length?offset+1:0}–{offset+currentItems.length} of {currentTotal}</span><Button variant="outline" disabled={offset+25>=currentTotal} onClick={()=>setOffset(offset+25)}>Next</Button></div>
      </section><aside>{currentSite?<>      {currentSite&&<section className={styles.surface}><h2>{String(currentSite.name)}</h2><p>{labels(currentSite.site_type)} · {labels(currentSite.status)}</p>
        <p>{String(currentSite.address_line1)}, {String(currentSite.town_city)} {String(currentSite.postcode)} · Reporting point: {String(currentSite.reporting_point)}</p>
        <p>Client: {currentSite.client_name ? office ? <Link href={`/crm/organisations/${currentSite.organisation_id}`}>{String(currentSite.client_name)}</Link> : String(currentSite.client_name) : "Not linked"}</p>
        <p><Link href={`/sites/${currentSite.id}/workspace`}>Open Site workspace →</Link></p>
        {Boolean(currentSite.client_name)&&<p><Link href={`/sites/${currentSite.id}/services`}>Ongoing Site Services and shift demand</Link></p>}
        <h3>Upcoming / active Events</h3>{((currentSite.events as Row[])??[]).length===0?<p>No active Events at this Site.</p>:<ul>{((currentSite.events as Row[])??[]).map((event)=><li key={String(event.id)}><Link href={`/events/${event.id}`}>{String(event.name)} · {labels(event.status)}</Link></li>)}</ul>}
        {Boolean(currentSite.can_manage)&&office&&<p>Site administration remains in <Link href="/sites">Manage my Sites</Link>.</p>}</section>}
      {currentSite && selected && <OperationalDocumentContextCard kind="SITE" id={selected} />}
</>:<section className={styles.surface}><h2>Select a Site</h2><p>Open a permitted location to view its address, Services and operational sources.</p></section>}</aside></div>
    </>}
  </main>;
}
