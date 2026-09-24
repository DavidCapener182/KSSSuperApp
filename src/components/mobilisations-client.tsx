"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./mobilisations.module.css";

type Choice = { id: string; name: string };
type Row = { id: string; title: string; status: string; organisation_name: string; owner_name: string; template_code: string; target_go_live: string | null };
async function read(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Mobilisation request denied");
  return body;
}
export function MobilisationsClient({ organisation, opportunity, actorId }: { organisation?: string; opportunity?: string; actorId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Row[]>([]); const [total, setTotal] = useState(0); const [offset, setOffset] = useState(0);
  const [clients, setClients] = useState<Choice[]>([]); const [owners, setOwners] = useState<Choice[]>([]);
  const [wonOpportunities, setWonOpportunities] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [draft, setDraft] = useState({ organisationId: organisation ?? "", opportunityId: opportunity ?? "", title: "", templateCode: "STATIC_SITE", ownerId: actorId, targetDate: "", duplicateReason: "" });
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const q = new URLSearchParams({ offset: String(offset) }); if (organisation) q.set("organisationId", organisation);
      const data = await read(`/api/mobilisations?${q}`); setItems(data.items ?? []); setTotal(data.total ?? 0);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Mobilisations unavailable"); }
    finally { setLoading(false); }
  }, [offset, organisation]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { const url = `/api/mobilisations/choices${draft.organisationId ? `?organisationId=${draft.organisationId}` : ""}`;
    void read(url).then(data => { setClients(data.clients ?? []); setOwners(data.owners ?? []); setWonOpportunities(data.wonOpportunities ?? []); }).catch(() => {});
  }, [draft.organisationId]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const data = await read("/api/mobilisations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, requestKey: crypto.randomUUID() }) }); router.push(`/mobilisations/${data.id}`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Authorisation denied"); }
    finally { setBusy(false); }
  }
  return <main className={`enterprise-main ${styles.page}`}>
    <p className="eyebrow">Office · synthetic development data</p><h1>Mobilisations</h1>
    <p className="enterprise-intro">Authorised work between a Client handover and an explicit operational decision. CRM Won does not start work automatically.</p>
    {error && <p role="alert" className="enterprise-error">{error}</p>}
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
    <section aria-labelledby="mobilisation-list-heading"><h2 id="mobilisation-list-heading">Current mobilisations <small>{total}</small></h2>
      {loading && <p role="status">Loading authorised records…</p>}
      {!loading && items.length === 0 && <p>No mobilisations yet.</p>}
      <div className={styles.list}>{items.map(item => <Link className={styles.row} href={`/mobilisations/${item.id}`} key={item.id}>
        <strong>{item.title}</strong><span>{item.organisation_name} · {item.template_code.replaceAll("_", " ")}</span><span>{item.status.replaceAll("_", " ")} · {item.owner_name}</span><span>Target {item.target_go_live ?? "not set"}</span>
      </Link>)}</div>
      <div className={styles.pager}><Button variant="outline" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><Button variant="outline" disabled={offset + 25 >= total || loading} onClick={() => setOffset(offset + 25)}>Next</Button></div>
    </section>
  </main>;
}
