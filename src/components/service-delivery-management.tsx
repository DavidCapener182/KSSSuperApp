"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { london, serviceRequest } from "./service-delivery-api";
import styles from "./service-delivery.module.css";

type Entry = { id: string; kind: string; revision: number; reason: string | null; occurred_at: string; actor_person_id: string };
type Commitment = { id: string; category: string; description: string; ownerId: string; ownerName: string; appliesFrom: string; appliesUntil: string | null; state: string; revision: number; history: Entry[] };
type Change = { id: string; targetDomain: string; targetId: string; baselineRevision: number; summary: string; requestedEffectiveAt: string; ownerId: string; ownerName: string; relatedChangeId: string | null; state: string; revision: number; proposerId: string; applicationOutcome: string | null; applicationEventId: string | null; applicationRevision: number | null; sourceChangedSinceApplication: boolean; history: Entry[] };
type Grant = { id: string; personId: string; personName: string; capability: string; effectiveUntil: string; revokedAt: string | null };
type Management = { sourceRevision: number; sourceEventId: string; siteId: string; siteServiceId: string; permissions: { propose: boolean; approve: boolean; record: boolean; admin: boolean }; commitments: Commitment[]; changes: Change[]; operationalDocumentTargetAvailable: false };
type Choice = { id: string; name: string; office: boolean };
const categories = ["STAFFING", "SERVICE_REVIEW", "OPERATING_INSTRUCTION", "EQUIPMENT", "REPORTING", "CLIENT_FOLLOW_UP", "OTHER"];
const capabilities = ["SERVICE_CHANGE_PROPOSER", "SERVICE_CHANGE_APPROVER", "SERVICE_CHANGE_RECORDER"];

function Form({ title, children, onSave, busy }: { title: string; children: React.ReactNode; onSave: (fields: Record<string, string>) => void; busy: boolean }) {
  return <details className={styles.card}><summary>{title}</summary><form className={styles.form} onSubmit={event => {
    event.preventDefault(); onSave(Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string,string>);
  }}>{children}<button className={styles.button} disabled={busy}>{busy ? "Saving…" : title}</button></form></details>;
}
function Reason() { return <label>Reason<textarea name="reason" required minLength={3} maxLength={500} /></label>; }
function Owner({ people, value }: { people: Choice[]; value?: string }) {
  return <label>Accountable Office owner<select name="ownerId" required defaultValue={value || ""}><option value="">Choose owner</option>{people.filter(p => p.office).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>;
}
function Timeline({ items }: { items: Entry[] }) {
  return <details><summary>History · {items.length}</summary><ol>{items.map(item => <li key={item.id}>{item.kind.replaceAll("_", " ")} · revision {item.revision} · {london(item.occurred_at)} · {item.reason || "Recorded"} · actor {item.actor_person_id}</li>)}</ol></details>;
}
function changeLabel(c: Change) {
  if (c.sourceChangedSinceApplication) return "Source changed since this application";
  if (c.applicationOutcome === "APPLIED") return "Applied";
  if (c.applicationOutcome === "NOT_APPLIED") return "Not applied";
  if (c.state === "APPROVED") return "Approved — awaiting source application";
  return c.state.replaceAll("_", " ").toLowerCase().replace(/^./, x => x.toUpperCase());
}

export function ServiceDeliveryManagement({ deliveryId, deliveryRevision, terminal }: { deliveryId: string; deliveryRevision: number; terminal: boolean }) {
  const [data, setData] = useState<Management | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [people, setPeople] = useState<Choice[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const next: Management = await serviceRequest(`/api/service-delivery/${deliveryId}/management`);
      setData(next);
      if (next.permissions.admin) {
        const grantData = await serviceRequest(`/api/service-delivery/${deliveryId}/management?grants=1`);
        setGrants(grantData.grants || []);
        setPeople((grantData.eligiblePeople || []).map((p: Choice) => ({ ...p, office: true })));
      } else {
        const choices = await serviceRequest("/api/service-delivery?choices=1");
        setPeople(choices.owners || []);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Management records unavailable"); }
  }, [deliveryId]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function save(entity: string, kind: string, subjectId: string | null, expectedRevision: number | null, payload: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const observedRevision = entity === "COMMITMENT" && kind === "CREATE" ? deliveryRevision : entity === "CHANGE" && kind === "PROPOSE" ? data?.sourceRevision : expectedRevision;
      await serviceRequest(`/api/service-delivery/${deliveryId}/management`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, kind, subjectId, expectedRevision: observedRevision, requestKey: crypto.randomUUID(), ...(entity === "GRANT" ? payload : { data: payload }) }) });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Management action denied"); }
    finally { setBusy(false); }
  }
  return <>
    <section id="commitments"><h2>Commitments</h2><p>Management commitments. Source not contractually verified. No confirmed commitment can be created in this first slice.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!data && <p role="status">Loading commitments and changes…</p>}
      {data && !terminal && <Form title="Propose commitment" busy={busy} onSave={f => void save("COMMITMENT", "CREATE", null, null, { ...f, appliesUntil: f.appliesUntil || null })}>
        <label>Category<select name="category" required defaultValue=""><option value="">Choose category</option>{categories.map(c => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}</select></label>
        <label>Factual management description<textarea name="description" required minLength={3} maxLength={500} /></label>
        <Owner people={people} /><label>Applies from<input name="appliesFrom" type="date" required /></label><label>Applies until, if known<input name="appliesUntil" type="date" /></label>
      </Form>}
      <div className={styles.grid}>{data?.commitments.map(c => <article className={styles.card} key={c.id}><h3>{c.category.replaceAll("_", " ")}</h3><p><strong>{c.state === "PROPOSED_UNVERIFIED" ? "Proposed / source not contractually verified" : c.state === "ENDED" ? "Ended / historically unverified" : "Withdrawn / historically unverified"}</strong></p><p>{c.description}</p><p>Owner: {c.ownerName} · applies {c.appliesFrom} to {c.appliesUntil || "open ended"}</p>
        {c.state === "PROPOSED_UNVERIFIED" && !terminal && <><Form title="Reassign commitment owner" busy={busy} onSave={f => void save("COMMITMENT", "OWNER_REASSIGNED", c.id, c.revision, f)}><Owner people={people} value={c.ownerId} /><Reason /></Form>
          <Form title="End commitment" busy={busy} onSave={f => void save("COMMITMENT", "ENDED", c.id, c.revision, f)}><label>Ended on<input name="endedOn" type="date" required /></label><Reason /></Form>
          <Form title="Withdraw commitment" busy={busy} onSave={f => void save("COMMITMENT", "WITHDRAWN", c.id, c.revision, f)}><Reason /></Form></>}
        <Timeline items={c.history} />
      </article>)}</div>
    </section>
    <section id="changes"><h2>Changes</h2><p>Approval is a Service Delivery management decision. The Site Service changes only through its own guarded workflow.</p>
      {data?.permissions.propose && !terminal && <Form title="Propose Site Service change" busy={busy} onSave={f => void save("CHANGE", "PROPOSE", null, null, { ...f, targetDomain: "SITE_SERVICE", targetId: data.siteServiceId, baselineRevision: data.sourceRevision, baselineEventId: data.sourceEventId, relatedChangeId: f.relatedChangeId || null })}>
        <p>Exact Site Service revision {data.sourceRevision}. Event targets are deferred. Operational document targets are disabled pending 19A acceptance.</p>
        <label>Proposed change<textarea name="summary" required minLength={3} maxLength={500} /></label><Reason /><Owner people={people} />
        <label>Requested effective date and time · Europe/London<input name="requestedEffectiveLocal" type="datetime-local" required /></label>
        <label>Related change ID, if needed<input name="relatedChangeId" type="text" /></label>
      </Form>}
      <div className={styles.grid}>{data?.changes.map(c => <article className={styles.card} key={c.id}><h3>{c.summary}</h3><p><strong>{changeLabel(c)}</strong></p><p>Site Service revision {c.baselineRevision} · requested {london(c.requestedEffectiveAt)} · owner {c.ownerName}</p><p>Change ID: {c.id}</p>
        {c.relatedChangeId && <p>Related change: {c.relatedChangeId}</p>}
        {c.applicationEventId && <p>Recorded source event: {c.applicationEventId} · revision {c.applicationRevision}</p>}
        <p><Link href={`/sites/${data.siteId}/services/${data.siteServiceId}`}>Open authoritative Site Service workflow</Link></p>
        {c.state === "PROPOSED" && data.permissions.propose && !terminal && <Form title="Submit for review" busy={busy} onSave={f => void save("CHANGE", "UNDER_REVIEW", c.id, c.revision, f)}><Reason /></Form>}
        {["PROPOSED", "UNDER_REVIEW"].includes(c.state) && !terminal && <>
          {data.permissions.propose && <><Form title="Revise proposal" busy={busy} onSave={f => void save("CHANGE", "REVISED", c.id, c.revision, f)}><label>Revised change<textarea name="summary" required minLength={3} maxLength={500} defaultValue={c.summary} /></label><label>Requested effective time · Europe/London<input name="requestedEffectiveLocal" type="datetime-local" required /><span>Enter the intended London time again; past times are not accepted.</span></label><Reason /></Form><Form title="Withdraw change" busy={busy} onSave={f => void save("CHANGE", "WITHDRAWN", c.id, c.revision, f)}><Reason /></Form></>}
          {data.permissions.approve && <><Form title="Approve management change" busy={busy} onSave={f => void save("CHANGE", "APPROVED", c.id, c.revision, f)}><p>Approval does not change the Site Service. The proposer cannot approve this request.</p><Reason /></Form><Form title="Reject change" busy={busy} onSave={f => void save("CHANGE", "REJECTED", c.id, c.revision, f)}><Reason /></Form></>}
        </>}
        {c.state === "APPROVED" && c.applicationOutcome == null && data.permissions.record && !terminal && <><Form title="Record verified source application" busy={busy} onSave={f => void save("CHANGE", "APPLIED", c.id, c.revision, f)}><p>Complete the Site Service change in its own workflow first. Enter its exact resulting event ID; this record verifies the event and revision.</p><label>Resulting Site Service event ID<input name="sourceEventId" required /></label><Reason /></Form><Form title="Record not applied" busy={busy} onSave={f => void save("CHANGE", "NOT_APPLIED", c.id, c.revision, f)}><Reason /></Form></>}
        <Timeline items={c.history} />
      </article>)}</div>
    </section>
    {data?.permissions.admin && <section id="change-grants"><h2>Change authority</h2><p>Super Admin administers finite grants for active Office people. Super Admin role alone grants no proposal, approval or application authority.</p>
      <Form title="Grant Service Delivery change capability" busy={busy} onSave={f => void save("GRANT", "GRANT", null, null, { personId: f.personId, capability: f.capability, effectiveUntil: new Date(f.effectiveUntil).toISOString(), reason: f.reason })}>
        <label>Office person<select name="personId" required defaultValue=""><option value="">Choose person</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Capability<select name="capability" required defaultValue=""><option value="">Choose capability</option>{capabilities.map(c => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}</select></label>
        <label>Expires at<input name="effectiveUntil" type="datetime-local" required /></label><Reason />
      </Form>
      <div className={styles.grid}>{grants.map(g => <article className={styles.card} key={g.id}><h3>{g.capability.replaceAll("_", " ")}</h3><p>{g.personName} · until {london(g.effectiveUntil)} · {g.revokedAt ? `Revoked ${london(g.revokedAt)}` : "Active until expiry"}</p>{!g.revokedAt && <Form title="Revoke grant" busy={busy} onSave={f => void save("GRANT", "REVOKE", g.id, null, { reason: f.reason })}><Reason /></Form>}</article>)}</div>
    </section>}
  </>;
}
