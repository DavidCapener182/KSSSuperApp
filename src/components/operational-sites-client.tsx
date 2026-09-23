"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = Record<string, unknown>;
type Choice = { id: string; name: string };
const labels = (value: unknown) => String(value ?? "Unclassified").replaceAll("_"," ").toLowerCase().replace(/(^|\s)\S/g,(s)=>s.toUpperCase());
export function OperationalSitesClient({ selected, office }: { selected?: string; office: boolean }) {
  const [items,setItems] = useState<Row[]>([]); const [total,setTotal] = useState(0);
  const [site,setSite] = useState<Row|null>(null); const [clients,setClients] = useState<Choice[]>([]);
  const [filters,setFilters] = useState({search:"",organisation:"",type:"",status:""}); const [applied,setApplied] = useState(filters);
  const [offset,setOffset] = useState(0); const [loading,setLoading] = useState(true); const [error,setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);setError("");
    try { const params=new URLSearchParams({offset:String(offset)});Object.entries(applied).forEach(([key,value])=>{if(value)params.set(key,value);});
      const response=await fetch(`/api/operational-sites?${params}`,{cache:"no-store"}); if(!response.ok)throw Error("Operational Sites unavailable");
      const result=await response.json();setItems(result.items ?? []);setTotal(result.total ?? 0);
      if(selected){const detail=await fetch(`/api/operational-sites/${selected}`,{cache:"no-store"});if(!detail.ok)throw Error("Site unavailable");setSite((await detail.json()).site);}
    }catch(caught){setError(caught instanceof Error?caught.message:"Operational Sites unavailable");}
    finally{setLoading(false);}
  },[applied,offset,selected]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
  useEffect(()=>{void fetch("/api/events/choices",{cache:"no-store"}).then((r)=>r.json()).then((data)=>setClients(data.clients ?? [])).catch(()=>{});},[]);
  return <main className="enterprise-main events-page"><p className="eyebrow">Operational locations · synthetic development data</p>
    <div className="crm-heading"><div><h1>Sites / Venues</h1><p className="enterprise-intro">Client and Event context is operational. Site administration remains separately guarded.</p></div></div>
    <nav className="crm-tabs"><Link href="/sites" aria-current="page">Sites / Venues</Link><Link href="/events">Events</Link>{office&&<Link href="/sites">Manage my Sites</Link>}</nav>
    <form className="events-filters" onSubmit={(e)=>{e.preventDefault();setOffset(0);setApplied({...filters});}}>
      <label>Search<Input maxLength={80} value={filters.search} onChange={(e)=>setFilters({...filters,search:e.target.value})}/></label>
      <label>Client<select value={filters.organisation} onChange={(e)=>setFilters({...filters,organisation:e.target.value})}><option value="">All Clients</option>{clients.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Site type<select value={filters.type} onChange={(e)=>setFilters({...filters,type:e.target.value})}><option value="">All types</option>{["STADIUM","VENUE","RETAIL","WAREHOUSE","OFFICE","FESTIVAL_SITE","STATIC_SITE","OTHER"].map((t)=><option key={t} value={t}>{labels(t)}</option>)}</select></label>
      <label>Status<select value={filters.status} onChange={(e)=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option>{["DRAFT","ACTIVE","RETIRED"].map((t)=><option key={t} value={t}>{labels(t)}</option>)}</select></label>
      <Button>Apply filters</Button></form>
    {error&&<p role="alert" className="enterprise-error">{error}<Button variant="ghost" onClick={()=>void load()}>Retry</Button></p>}
    {loading?<p role="status" className="crm-skeleton">Loading authorised Sites…</p>:<>
      {site&&<section className="crm-panel"><h2>{String(site.name)}</h2><p>{String(site.site_reference)} · {labels(site.site_type)} · {labels(site.status)}</p>
        <p>{String(site.address_line1)}, {String(site.town_city)} {String(site.postcode)} · Reporting point: {String(site.reporting_point)}</p>
        <p>Client: {site.client_name ? office ? <Link href={`/crm/organisations/${site.organisation_id}`}>{String(site.client_name)}</Link> : String(site.client_name) : "Not linked"}</p>
        <h3>Upcoming / active Events</h3>{((site.events as Row[])??[]).length===0?<p>No active Events at this Site.</p>:<ul>{((site.events as Row[])??[]).map((event)=><li key={String(event.id)}><Link href={`/events/${event.id}`}>{String(event.name)} · {labels(event.status)}</Link></li>)}</ul>}
        {Boolean(site.can_manage)&&office&&<p>Site administration remains in <Link href="/sites">Manage my Sites</Link>.</p>}</section>}
      <p className="enterprise-honesty">{total} authorised Site{total===1?"":"s"}. Unlinked Sites remain valid.</p>
      {items.length===0?<p className="crm-empty">No Sites match these filters.</p>:<div className="crm-list">{items.map((row)=><Link className="crm-row" href={`/sites?view=operational&selected=${row.id}`} key={String(row.id)}>
        <strong>{String(row.name)}</strong><span>{String(row.client_name ?? "Unlinked")} · {labels(row.site_type)}</span><span>{labels(row.status)} · {String(row.town_city)}</span></Link>)}</div>}
      <div className="people-pagination"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous</Button><span>{items.length?offset+1:0}–{offset+items.length} of {total}</span><Button variant="outline" disabled={offset+25>=total} onClick={()=>setOffset(offset+25)}>Next</Button></div>
    </>}
  </main>;
}
