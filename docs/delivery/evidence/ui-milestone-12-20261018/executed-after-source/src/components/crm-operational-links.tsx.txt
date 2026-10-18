"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Row = Record<string, unknown>;
export function CrmOperationalLinks({ organisationId }: { organisationId: string }) {
  const [sites,setSites] = useState<Row[]>([]); const [events,setEvents] = useState<Row[]>([]);
  const [loading,setLoading] = useState(true); const [error,setError] = useState(false);
  useEffect(()=>{let active=true;
    Promise.all([fetch(`/api/operational-sites?organisation=${organisationId}`,{cache:"no-store"}),fetch(`/api/events?organisation=${organisationId}`,{cache:"no-store"})])
      .then(async([siteResponse,eventResponse])=>{if(!siteResponse.ok||!eventResponse.ok)throw Error();
        const [siteData,eventData]=await Promise.all([siteResponse.json(),eventResponse.json()]);
        if(active){setSites(siteData.items??[]);setEvents(eventData.items??[]);setError(false);}})
      .catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[organisationId]);
  return <div className="crm-detail-grid"><section className="crm-panel"><h2>Linked Sites / Venues</h2><p>Locations linked to this Client. Site Services and Events have their own records.</p>
    {loading?<p>Loading linked Sites…</p>:error?<p>Site context unavailable.</p>:sites.length===0?<p>No Site linked to this Client yet.</p>:
      sites.map((site)=><Link className="crm-subrow" key={String(site.id)} href={`/sites?view=operational&selected=${site.id}`}><strong>{String(site.name)}</strong><span>{String(site.site_reference)} · {String(site.status)}</span></Link>)}
  </section><section className="crm-panel"><h2>Events</h2>
    {loading?<p>Loading Events…</p>:error?<p>Event context unavailable.</p>:events.length===0?<p>No Event for this Client yet.</p>:
      events.map((event)=><Link className="crm-subrow" key={String(event.id)} href={`/events/${event.id}`}><strong>{String(event.name)}</strong><span>{String(event.status)} · {new Date(String(event.starts_at)).toLocaleString("en-GB",{timeZone:"Europe/London"})}</span></Link>)}
    <p><Link href={`/events?organisation=${organisationId}`}>Open Events workspace</Link></p>
  </section></div>;
}
