"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./commercial-handoff.module.css";

type Source = { type: "SITE" | "SITE_SERVICE" | "EVENT"; id: string; name: string | null; state: string; siteId: string | null };
type Delivery = { id: string; name: string; state: string; siteServiceId: string; mobilisationId?: string | null };
type Mobilisation = { id: string; title: string; status: string; ownerName: string; targetDate: string | null;
  opportunityId: string | null; handedOverAt: string | null; openActions: number; openBlockers: number;
  sources: Source[]; serviceDeliveries: Delivery[] };
type Item = { id: string; name: string; state: string; siteId?: string };
type Context = { organisation: { id: string; name: string; relationshipStatus: string };
  opportunity: { id: string; title: string; stage: string; ownerId: string } | null;
  mobilisationTotal: number; mobilisations: Mobilisation[]; sites: Item[]; siteServices: Item[];
  events: Item[]; serviceDeliveries: Delivery[] };
const label = (text: string) => text.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, value => value.toUpperCase());
function sourceHref(source: Source) {
  if (source.type === "EVENT") return `/events/${source.id}`;
  if (source.type === "SITE_SERVICE" && source.siteId) return `/sites/${source.siteId}/services/${source.id}`;
  return `/sites?view=operational&selected=${source.id}`;
}
export function CommercialHandoffClient({ organisationId, opportunityId, mobilisationId }: {
  organisationId: string; opportunityId?: string; mobilisationId?: string;
}) {
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ organisationId });
    if (opportunityId) params.set("opportunityId", opportunityId);
    fetch(`/api/commercial-handoff?${params}`, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Commercial context unavailable. Open source records to check current facts.");
      return response.json() as Promise<Context>;
    }).then(result => { if (active) setContext(result); })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Context unavailable"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organisationId, opportunityId]);
  const mobilisations = mobilisationId ? context?.mobilisations.filter(item => item.id === mobilisationId) : context?.mobilisations;
  return <main className={`enterprise-main ${styles.page}`}>
    <p className="eyebrow">Office · synthetic development data</p>
    <Link href={`/crm/organisations/${organisationId}`}>← Organisation</Link>
    <h1>Commercial handoff</h1>
    <p className={styles.intro}>What happened after the commercial decision? Each state comes from its own source record. Linked records do not establish contract, safety, staffing, live service or revenue.</p>
    {loading && <p role="status">Loading authorised source facts…</p>}
    {error && <p role="alert" className="enterprise-error">{error}</p>}
    {context && <>
      <header className={styles.header}><div><span className={styles.kicker}>Organisation</span><h2>{context.organisation.name}</h2><p>{label(context.organisation.relationshipStatus)}</p></div>
        <Link href={`/crm/organisations/${organisationId}`}>Open Organisation</Link></header>
      {context.opportunity && <section className={styles.card}><span className={styles.kicker}>Opportunity</span>
        <h2>{context.opportunity.title}</h2><p>Sales stage: <strong>{label(context.opportunity.stage)}</strong></p>
        <Link href={`/crm/opportunities/${context.opportunity.id}`}>Open Opportunity</Link></section>}
      {context.opportunity?.stage === "WON" && context.mobilisationTotal === 0 &&
        <p className={styles.card}>No Mobilisation is authorised from this Opportunity. <Link href={`/mobilisations?organisation=${organisationId}&opportunity=${context.opportunity.id}`}>Authorise Mobilisation</Link></p>}
      {context.mobilisationTotal > context.mobilisations.length && <p className={styles.card}>Showing the latest {context.mobilisations.length} of {context.mobilisationTotal} Mobilisations. <Link href={`/mobilisations?organisation=${organisationId}`}>Open the full Mobilisation list</Link>.</p>}
      {mobilisationId && !mobilisations?.length && <p className={styles.card}>This Mobilisation is not in the current context. <Link href={`/mobilisations/${mobilisationId}`}>Open its source record</Link>.</p>}
      {mobilisations?.map(m => <section className={styles.card} key={m.id} aria-label={`Mobilisation ${m.title}`}>
        <span className={styles.kicker}>Mobilisation</span><h2>{m.title}</h2>
        <div className={styles.facts}><span>State: <strong>{label(m.status)}</strong></span><span>Owner: {m.ownerName}</span><span>Target: {m.targetDate ?? "Not set"}</span><span>{m.openActions} unresolved actions</span><span>{m.openBlockers} open blockers</span></div>
        <p><Link href={`/mobilisations/${m.id}`}>Open Mobilisation</Link></p>
        <h3>Operational setup</h3>{m.sources.length ? <ul className={styles.sources}>{m.sources.map(source => <li key={`${source.type}:${source.id}`}>
          <span>{label(source.type)}: {source.state === "RESTRICTED_OR_CHANGED" ? "Restricted or changed" : source.name ?? "Unnamed"} · {label(source.state)}</span>
          {source.state !== "RESTRICTED_OR_CHANGED" && <Link href={sourceHref(source)}>Open source</Link>}
        </li>)}</ul> : <p>No Site, Site Service or Event linked to this Mobilisation.</p>}
        <p><Link href={`/mobilisations/${m.id}#links-heading`}>Add or review source links</Link></p>
        <h3>Handover</h3><p>{m.status === "HANDED_OVER" ? `Recorded ${m.handedOverAt ? new Date(m.handedOverAt).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "in Mobilisation history"}` : "Not handed over"}.</p>
        <h3>Continuing Service Delivery</h3>{m.serviceDeliveries.length ? m.serviceDeliveries.map(delivery =>
          <p key={delivery.id}>{delivery.name} · {label(delivery.state)} · <Link href={`/service-delivery/${delivery.id}`}>Open Service Delivery</Link></p>) :
          <p>No Service Delivery record is linked to this Mobilisation. {m.status === "HANDED_OVER" &&
            <Link href={`/service-delivery?mobilisation=${m.id}`}>Start from an exact handed-over Site Service</Link>}</p>}
      </section>)}
      {!opportunityId && <section className={styles.card}><h2>Organisation relationship context</h2>
        <p>These are current Organisation source records. Their presence does not prove they belong to one Opportunity or Mobilisation.</p>
        <div className={styles.contextGrid}><div><h3>Sites</h3>{context.sites.map(item => <p key={item.id}><Link href={`/sites?view=operational&selected=${item.id}`}>{item.name}</Link> · {label(item.state)}</p>)}{!context.sites.length && <p>None linked.</p>}</div>
          <div><h3>Site Services</h3>{context.siteServices.map(item => <p key={item.id}><Link href={`/sites/${item.siteId}/services/${item.id}`}>{item.name}</Link> · {label(item.state)}</p>)}{!context.siteServices.length && <p>None recorded.</p>}</div>
          <div><h3>Events</h3>{context.events.map(item => <p key={item.id}><Link href={`/events/${item.id}`}>{item.name}</Link> · {label(item.state)}</p>)}{!context.events.length && <p>None recorded.</p>}</div>
          <div><h3>Service Delivery</h3>{context.serviceDeliveries.map(item => <p key={item.id}><Link href={`/service-delivery/${item.id}`}>{item.name}</Link> · {label(item.state)}</p>)}{!context.serviceDeliveries.length && <p>None started.</p>}</div></div>
      </section>}
    </>}
  </main>;
}
