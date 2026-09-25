"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./mobilisations.module.css";

type Choice = { id: string; name: string };
type Row = { id: string; title: string; status: string; organisation_name: string; owner_name: string; template_code: string; target_go_live: string | null };
type PortfolioRow = { id: string; title: string; status: string; organisation_id: string; organisation_name: string; owner_name: string; target_go_live: string | null; open_actions: number; open_blockers: number; next_work: string | null };
async function read(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Mobilisation request denied");
  return body;
}
export function MobilisationsClient({ organisation, opportunity, actorId }: { organisation?: string; opportunity?: string; actorId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Row[]>([]); const [total, setTotal] = useState(0); const [offset, setOffset] = useState(0);
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>([]); const [portfolioError, setPortfolioError] = useState("");
  const [clients, setClients] = useState<Choice[]>([]); const [owners, setOwners] = useState<Choice[]>([]);
  const [wonOpportunities, setWonOpportunities] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [draft, setDraft] = useState({ organisationId: organisation ?? "", opportunityId: opportunity ?? "", title: "", templateCode: "STATIC_SITE", ownerId: actorId, targetDate: "", duplicateReason: "" });
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const q = new URLSearchParams({ offset: String(offset) }); if (organisation) q.set("organisationId", organisation);
      const data = await read(`/api/mobilisations?${q}`); setItems(data.items ?? []); setTotal(data.total ?? 0);
      if (!organisation) {
        try { const overview = await read(`/api/commercial-handoff/portfolio?offset=${offset}`); setPortfolio(overview.items ?? []); setPortfolioError(""); }
        catch { setPortfolio([]); setPortfolioError("Portfolio facts unavailable; open each Mobilisation for current actions and blockers."); }
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Mobilisations unavailable"); }
    finally { setLoading(false); }
  }, [offset, organisation]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { const url = `/api/mobilisations/choices${draft.organisationId ? `?organisationId=${draft.organisationId}` : ""}`;
    void read(url).then(data => { setClients(data.clients ?? []); setOwners(data.owners ?? []); setWonOpportunities(data.wonOpportunities ?? []); }).catch(() => {});
  }, [draft.organisationId]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const data = await read("/api/mobilisations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, requestKey: crypto.randomUUID() }) });
      const confirmed = await read(`/api/mobilisations/${data.id}`);
      if (confirmed.mobilisation?.id !== data.id) throw new Error("Authorisation response could not be confirmed. Refresh before trying again.");
      router.push(`/mobilisations/${data.id}`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Authorisation denied"); }
    finally { setBusy(false); }
  }
  const authorise = <>
    <section className={styles.card} aria-labelledby="authorise-heading"><h2 id="authorise-heading">Authorise mobilisation</h2>
      <form onSubmit={create} className={styles.form}>
        <label>Client organisation<select required value={draft.organisationId} onChange={e => setDraft({ ...draft, organisationId: e.target.value })}><option value="">Choose Client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Scope name<Input required minLength={3} maxLength={180} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
        <label>Template<select value={draft.templateCode} onChange={e => setDraft({ ...draft, templateCode: e.target.value })}><option value="STATIC_SITE">Static Site Mobilisation · v1</option><option value="EVENT">Event Mobilisation · v1</option></select></label>
        <label>Owner<select required value={draft.ownerId} onChange={e => setDraft({ ...draft, ownerId: e.target.value })}>{owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label>Target go-live date<Input type="date" value={draft.targetDate} onChange={e => setDraft({ ...draft, targetDate: e.target.value })} /></label>
        <label>Won Opportunity origin, if applicable<select value={draft.opportunityId} onChange={e => setDraft({ ...draft, opportunityId: e.target.value })}><option value="">No Opportunity · authorise from Client</option>{wonOpportunities.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
        <label>Different scope reason, if this Client or Opportunity already has a mobilisation<Input maxLength={500} value={draft.duplicateReason} onChange={e => setDraft({ ...draft, duplicateReason: e.target.value })} /></label>
        <div className={styles.formActions}><Button disabled={busy}>{busy ? "Authorising…" : "Authorise mobilisation"}</Button></div>
      </form></section>
  </>;
  return <main className={`enterprise-main ${styles.page}`}>
    <p className="eyebrow">Office · synthetic development data</p><h1>Mobilisations</h1>
    <p className="enterprise-intro">Coordinate an explicitly authorised Client scope through source setup and a recorded human handover. A Won Opportunity is an origin, not an authorisation.</p>
    <nav className={styles.journey} aria-label="Commercial to service journey">
      <span><small>01 · Opportunity</small><Link href="/crm?view=pipeline">Review CRM</Link></span>
      <span><small>02 · Client</small><Link href="/crm?view=organisations">Confirm Client</Link></span>
      <span><small>03 · Mobilisation</small><a href="#authorise-heading" aria-current="step">Authorise scope</a></span>
      <span><small>04 · Source setup</small><Link href="/sites">Sites and services</Link></span>
    </nav>
    {error && <p role="alert" className="enterprise-error">{error}</p>}
    {(organisation || opportunity) && authorise}
    <section aria-labelledby="mobilisation-list-heading"><h2 id="mobilisation-list-heading">Current mobilisations <small>{total}</small></h2>
      {loading && <p role="status">Loading authorised records…</p>}
      {!organisation && portfolioError && <p role="status">{portfolioError}</p>}
      {!organisation && portfolio.length > 0 && <div className={styles.portfolio} role="table" aria-label="Mobilisation portfolio">
        <div className={styles.portfolioHead} role="row"><span role="columnheader">Mobilisation</span><span role="columnheader">Owner / target</span><span role="columnheader">Unresolved work</span><span role="columnheader">Next work</span></div>
        {portfolio.map(row => <Link role="row" className={styles.portfolioRow} key={row.id} href={`/mobilisations/${row.id}`}>
          <span role="cell"><strong>{row.title}</strong><small>{row.organisation_name} · {row.status.replaceAll("_", " ")}</small></span>
          <span role="cell">{row.owner_name}<small>Target {row.target_go_live ?? "not set"}</small></span>
          <span role="cell">{row.open_actions} open actions · {row.open_blockers} blockers</span>
          <span role="cell">{row.next_work ?? "No open action"}</span>
        </Link>)}</div>}
      {!loading && items.length === 0 && <p>No authorised mobilisations in this view. Confirm the Client and use the authorisation form when a scope is approved.</p>}
      <div className={styles.list}>{(organisation || portfolioError || portfolio.length === 0 ? items : []).map(item => <Link className={styles.row} href={`/mobilisations/${item.id}`} key={item.id}>
        <strong>{item.title}</strong><span>{item.organisation_name} · {item.template_code.replaceAll("_", " ")}</span><span><strong className={styles.state}>{item.status.replaceAll("_", " ")}</strong> · owner {item.owner_name}</span><span>Target {item.target_go_live ?? "not set"}</span>
      </Link>)}</div>
      <div className={styles.pager}><Button variant="outline" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><Button variant="outline" disabled={offset + 25 >= total || loading} onClick={() => setOffset(offset + 25)}>Next</Button></div>
    </section>
    {!organisation && !opportunity && authorise}
  </main>;
}
