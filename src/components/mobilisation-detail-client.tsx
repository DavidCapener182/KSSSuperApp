"use client";
import "./record-studies.css";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import styles from "./mobilisations.module.css";

type Action = { id: string; title: string; category: string; owner_person_id: string; ownerName: string; state: string; due_on: string | null; template_ordinal: number | null };
type Blocker = { id: string; action_id: string | null; reason: string; owner_person_id: string; opened_at: string; resolved_at: string | null; resolution_note: string | null };
type Decision = { id: string; kind: string; outcome: string; note: string; occurred_at: string; facts: Record<string, unknown> };
type SourceLink = { id: string; sourceType: string; sourceId: string | null; siteId: string | null; sourceState: string };
type History = { id: string; kind: string; occurred_at: string; revision: number; reason: string | null; actor_person_id: string };
type Detail = { mobilisation: { id: string; title: string; status: string; revision: number; organisation_id: string; organisationName: string; source_opportunity_id: string | null; owner_person_id: string; ownerName: string; target_go_live: string | null; templateCode: string; templateVersion: number }; actions: Action[]; blockers: Blocker[]; decisions: Decision[]; links: SourceLink[]; history: History[]; dependencies: { action_id: string; depends_on_id: string }[]; counts: { total: number; done: number; open: number; blocked: number } };
type Choice = { id: string; name: string };
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, text => text.toUpperCase());
const dateTime = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
const categories = ["COMMERCIAL", "CONTACTS", "SITE_EVENT", "STAFFING", "RECRUITMENT", "TRAINING", "DOCUMENTS", "ASSETS", "SYSTEMS", "REPORTING", "GO_LIVE", "HANDOVER"];
const sources = ["CONTACT", "SITE", "SITE_SERVICE", "EVENT", "TASK", "DOCUMENT_VERSION"];
const recordSections = ["scope-heading", "actions-heading", "blockers-heading", "decisions-heading", "links-heading", "review-heading", "history-heading"] as const;
type RecordSection = typeof recordSections[number];
async function read(url: string, init?: RequestInit) { const response = await fetch(url, { ...init, cache: "no-store" }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? "Request denied"); return body; }
function sourceHref(link: SourceLink) { switch (link.sourceType) { case "SITE": return `/sites/${link.sourceId}`; case "SITE_SERVICE": return link.siteId ? `/sites/${link.siteId}/services/${link.sourceId}` : "/sites"; case "EVENT": return `/events/${link.sourceId}`; case "CONTACT": return "/crm"; case "TASK": return "/work"; case "DOCUMENT_VERSION": return "/documents"; default: return "#"; } }
export function MobilisationDetailClient({ id }: { id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null); const [owners, setOwners] = useState<Choice[]>([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [note, setNote] = useState(""); const [owner, setOwner] = useState(""); const [target, setTarget] = useState("");
  const [newAction, setNewAction] = useState({ title: "", category: "SITE_EVENT", ownerId: "", dueOn: "" });
  const [dependency, setDependency] = useState({ actionId: "", dependsOnId: "" });
  const [blocker, setBlocker] = useState({ actionId: "", reason: "", ownerId: "" });
  const [decision, setDecision] = useState({ outcome: "DEFERRED", note: "" });
  const [link, setLink] = useState({ sourceType: "SITE", sourceId: "" });
  const [activeSection, setActiveSection] = useState<RecordSection>("scope-heading");
  const sectionNav = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const sync = () => { const hash = window.location.hash.slice(1); setActiveSection(recordSections.includes(hash as RecordSection) ? hash as RecordSection : "scope-heading"); };
    sync(); window.addEventListener("hashchange", sync); window.addEventListener("popstate", sync);
    return () => { window.removeEventListener("hashchange", sync); window.removeEventListener("popstate", sync); };
  }, []);
  useEffect(() => {
    const align = () => {
      const nav = sectionNav.current;
      const selected = nav?.querySelector<HTMLElement>('[aria-current="location"]');
      if (nav && selected) nav.scrollTo({ left: selected.offsetLeft - nav.offsetLeft - (nav.clientWidth - selected.clientWidth) / 2, behavior: "instant" });
    };
    align(); window.addEventListener("resize", align);
    return () => window.removeEventListener("resize", align);
  }, [activeSection, detail]);
  function selectSection(event: React.MouseEvent<HTMLAnchorElement>, section: RecordSection) {
    event.preventDefault(); setActiveSection(section);
    if (window.location.hash !== `#${section}`) window.history.pushState(null, "", `#${section}`);
    if (sectionNav.current) window.scrollTo({ top: window.scrollY + sectionNav.current.getBoundingClientRect().top, behavior: "instant" });
  }
  const load = useCallback(async (): Promise<Detail | null> => { setLoading(true); setError(""); try {
    const next: Detail = await read(`/api/mobilisations/${id}`); setDetail(next);
    setOwner(next.mobilisation.owner_person_id); setTarget(next.mobilisation.target_go_live ?? "");
    setNewAction(value => ({ ...value, ownerId: value.ownerId || next.mobilisation.owner_person_id }));
    setBlocker(value => ({ ...value, ownerId: value.ownerId || next.mobilisation.owner_person_id }));
    return next;
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Mobilisation unavailable"); return null; } finally { setLoading(false); } }, [id]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { void read("/api/mobilisations/choices").then(data => setOwners(data.owners ?? [])).catch(() => {}); }, []);
  const openBlockers = useMemo(() => detail?.blockers.filter(row => !row.resolved_at) ?? [], [detail]);
  const unresolved = useMemo(() => detail?.actions.filter(row => row.state !== "DONE" && row.state !== "CANCELLED") ?? [], [detail]);
  async function command(action: string, data: Record<string, unknown>, confirmation?: string) {
    if (!detail || busy) return;
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true); setError(""); setNotice("");
    try { await read(`/api/mobilisations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data, expectedRevision: detail.mobilisation.revision, requestKey: crypto.randomUUID() }) });
      const confirmed = await load();
      if (confirmed && confirmed.mobilisation.revision > detail.mobilisation.revision) { setNotice(`${label(action)} recorded and confirmed from the mobilisation record.`); setNote(""); }
      else if (confirmed) setError("The server responded, but the updated record could not be confirmed. Refresh before another change.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Change denied"); }
    finally { setBusy(false); }
  }
  async function unlink(linkId: string) {
    if (!detail || busy || note.trim().length < 3 || !window.confirm("Remove this mobilisation link? The source record and link history will remain.")) return;
    setBusy(true); setError(""); setNotice("");
    try { await read(`/api/mobilisations/${id}/links/${linkId}`, { method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: detail.mobilisation.revision, reason: note, requestKey: crypto.randomUUID() }) });
      const confirmed = await load();
      if (confirmed && confirmed.mobilisation.revision > detail.mobilisation.revision && !confirmed.links.some(row => row.id === linkId)) { setNotice("Source link removal confirmed from the mobilisation record; history preserved."); setNote(""); }
      else if (confirmed) setError("The server responded, but the link removal could not be confirmed. Refresh before another change.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Link correction denied"); }
    finally { setBusy(false); }
  }
  const m = detail?.mobilisation;
  const terminal = m?.status === "HANDED_OVER" || m?.status === "CANCELLED";
  const nextState = m?.status === "PLANNING" ? "IN_PROGRESS" : m?.status === "IN_PROGRESS" ? "GO_LIVE_REVIEW" : m?.status === "GO_LIVE_REVIEW" ? "HANDED_OVER" : "";
  return <main className={`enterprise-main ${styles.page}`}>
    <p className="eyebrow">Office · synthetic development data</p><Link href="/mobilisations">← Mobilisations</Link>
    {error && <p role="alert" className="enterprise-error">{error} <Button variant="outline" onClick={() => void load()}>Refresh</Button></p>}
    {notice && <p role="status" className="enterprise-honesty">{notice}</p>}
    {loading && <p role="status">Loading authorised mobilisation…</p>}
    {m && <>
      <header className="mobilisation-record-header"><h1>{m.title}</h1><div className="crm-record-identity"><span>Mobilisation</span><strong>{label(m.status)}</strong></div><p>{m.organisationName} · Owner: {m.ownerName}</p><p>Target go-live: {m.target_go_live ?? "Not set"} · {label(m.templateCode)} template v{m.templateVersion}</p></header>
      <nav ref={sectionNav} className="mobilisation-record-sections" aria-label="Mobilisation sections"><a href="#scope-heading" aria-current={activeSection==="scope-heading"?"location":undefined} onClick={event=>selectSection(event,"scope-heading")}>Context</a><a href="#actions-heading" aria-current={activeSection==="actions-heading"?"location":undefined} onClick={event=>selectSection(event,"actions-heading")}>Actions</a><a href="#blockers-heading" aria-current={activeSection==="blockers-heading"?"location":undefined} onClick={event=>selectSection(event,"blockers-heading")}>Blockers</a><a href="#decisions-heading" aria-current={activeSection==="decisions-heading"?"location":undefined} onClick={event=>selectSection(event,"decisions-heading")}>Decisions</a><a href="#links-heading" aria-current={activeSection==="links-heading"?"location":undefined} onClick={event=>selectSection(event,"links-heading")}>Source links</a><a href="#review-heading" aria-current={activeSection==="review-heading"?"location":undefined} onClick={event=>selectSection(event,"review-heading")}>Review</a><a href="#history-heading" aria-current={activeSection==="history-heading"?"location":undefined} onClick={event=>selectSection(event,"history-heading")}>History</a></nav>
      <div className="crm-organisation-related"><strong>Related workflows</strong><Link href={`/crm/organisations/${m.organisation_id}`}>Client Organisation</Link>{m.source_opportunity_id && <Link href={`/crm/opportunities/${m.source_opportunity_id}`}>Origin Opportunity</Link>}<a href="#links-heading" onClick={event=>selectSection(event,"links-heading")}>Source records</a></div>
      <div className={styles.counts} aria-label="Factual action counts"><span>{detail!.counts.total} actions</span><span>{detail!.counts.done} done</span><span>{detail!.counts.open} open</span><span>{detail!.counts.blocked} blocked</span><span>{openBlockers.length} unresolved blockers</span></div>
      <div className="mobilisation-focused-content">
      <section className={styles.card} aria-labelledby="scope-heading" hidden={activeSection!=="scope-heading"}><h2 id="scope-heading">Scope and accountability</h2>
        <p>Client: <Link href={`/crm/organisations/${m.organisation_id}`}>{m.organisationName}</Link>. Won Opportunity: {m.source_opportunity_id ? <Link href={`/crm/opportunities/${m.source_opportunity_id}`}>Open exact origin</Link> : "None — authorised directly from Client"}.</p>
        <p>Owner: {m.ownerName}. Target go-live: {m.target_go_live ?? "Not set"}. State: {label(m.status)}.</p>
        {!terminal && <><div className={styles.grid}><label>New owner<select value={owner} onChange={e => setOwner(e.target.value)}>{owners.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>
          <label>New target date<input type="date" value={target} onChange={e => setTarget(e.target.value)} /></label></div>
        <label className={styles.stack}>Reason for change<textarea maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
        <div className={styles.buttons}><Button variant="outline" disabled={busy || owner === m.owner_person_id} onClick={() => void command("OWNER", { ownerId: owner, note })}>Reassign owner</Button><Button variant="outline" disabled={busy || target === (m.target_go_live ?? "")} onClick={() => void command("TARGET_DATE", { targetDate: target || null, note })}>Change target</Button></div></>}
      </section>
      <section className={styles.card} aria-labelledby="actions-heading" hidden={activeSection!=="actions-heading"}><h2 id="actions-heading">Workstream actions</h2>
        {detail!.actions.map(row => <div className={styles.action} key={row.id}>
          <strong>{row.title}</strong><span className={styles.meta}>{label(row.category)} · {label(row.state)} · {row.ownerName} · due {row.due_on ?? "not set"}</span>
          <span className={styles.meta}>Dependencies: {detail!.dependencies.filter(dep => dep.action_id === row.id).map(dep => detail!.actions.find(a => a.id === dep.depends_on_id)?.title ?? "Restricted").join(", ") || "None"}</span>
          {!terminal && <details className={styles.stateChange}><summary>Change state</summary><div className={styles.buttons}>{["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"].filter(state => state !== row.state).map(state => <Button type="button" variant="outline" size="sm" disabled={busy || (state === "CANCELLED" && note.trim().length < 3)} key={state} onClick={() => void command("ACTION_STATE", { actionId: row.id, state, note })}>{label(state)}</Button>)}</div></details>}
        </div>)}
        {!terminal && <label className={styles.stack}>Reason for action cancellation or correction<textarea maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>}
        {!terminal && <><h3>Add a scoped action</h3><div className={styles.form}><label>Title<input maxLength={180} value={newAction.title} onChange={e => setNewAction({ ...newAction, title: e.target.value })} /></label>
          <label>Workstream<select value={newAction.category} onChange={e => setNewAction({ ...newAction, category: e.target.value })}>{categories.map(category => <option key={category} value={category}>{label(category)}</option>)}</select></label>
          <label>Responsible person<select value={newAction.ownerId} onChange={e => setNewAction({ ...newAction, ownerId: e.target.value })}>{owners.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>
          <label>Due date<input type="date" value={newAction.dueOn} onChange={e => setNewAction({ ...newAction, dueOn: e.target.value })} /></label>
          <div className={styles.formActions}><Button disabled={busy || newAction.title.trim().length < 3} onClick={() => void command("ACTION_ADD", newAction)}>Add action</Button></div></div>
        <h3>Dependency</h3><div className={styles.form}><label>Action<select value={dependency.actionId} onChange={e => setDependency({ ...dependency, actionId: e.target.value })}><option value="">Choose action</option>{detail!.actions.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
          <label>Depends on<select value={dependency.dependsOnId} onChange={e => setDependency({ ...dependency, dependsOnId: e.target.value })}><option value="">Choose prerequisite</option>{detail!.actions.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
          <div className={styles.formActions}><Button variant="outline" disabled={busy || !dependency.actionId || !dependency.dependsOnId} onClick={() => void command("DEPENDENCY_ADD", dependency)}>Add dependency</Button></div></div></>}
      </section>
      <section className={styles.card} aria-labelledby="blockers-heading" hidden={activeSection!=="blockers-heading"}><h2 id="blockers-heading">Blockers</h2>
        {detail!.blockers.length === 0 && <p>No blockers recorded.</p>}
        {detail!.blockers.map(row => <div className={styles.action} key={row.id}><strong>{row.resolved_at ? "Resolved" : "Blocked"} — {row.reason}</strong>
          <span className={styles.meta}>Owner {owners.find(choice => choice.id === row.owner_person_id)?.name ?? "Named Person"} · opened {dateTime(row.opened_at)}</span>
          {row.resolved_at ? <span className={styles.meta}>Resolved {dateTime(row.resolved_at)}: {row.resolution_note}</span> : !terminal && <Button variant="outline" disabled={busy || note.trim().length < 3} onClick={() => void command("BLOCKER_RESOLVE", { blockerId: row.id, note })}>Resolve with note below</Button>}</div>)}
        {!terminal && <div className={styles.stack}><label>Action, if applicable<select value={blocker.actionId} onChange={e => setBlocker({ ...blocker, actionId: e.target.value })}><option value="">Mobilisation-wide</option>{detail!.actions.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
          <label>Blocker reason<textarea maxLength={500} value={blocker.reason} onChange={e => setBlocker({ ...blocker, reason: e.target.value })} /></label>
          <label>Owner<select value={blocker.ownerId} onChange={e => setBlocker({ ...blocker, ownerId: e.target.value })}>{owners.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>
          <Button disabled={busy || blocker.reason.trim().length < 3} onClick={() => void command("BLOCKER_OPEN", blocker)}>Record blocker</Button></div>}
      </section>
      <section className={styles.card} aria-labelledby="decisions-heading" hidden={activeSection!=="decisions-heading"}><h2 id="decisions-heading">Decisions</h2>
        {detail!.decisions.length === 0 && <p>No decisions recorded.</p>}
        {detail!.decisions.map(row => <p className={styles.action} key={row.id}><strong>{label(row.kind)} · {label(row.outcome)}</strong><span>{row.note}</span><span className={styles.meta}>{dateTime(row.occurred_at)}</span></p>)}
        {!terminal && <div className={styles.stack}><label>Outcome<select value={decision.outcome} onChange={e => setDecision({ ...decision, outcome: e.target.value })}><option value="DEFERRED">Deferred</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label>
          <label>Decision note<textarea maxLength={1000} value={decision.note} onChange={e => setDecision({ ...decision, note: e.target.value })} /></label>
          <Button disabled={busy || decision.note.trim().length < 3} onClick={() => void command("DECISION", decision)}>Record decision</Button></div>}
      </section>
      <section className={styles.card} aria-labelledby="links-heading" hidden={activeSection!=="links-heading"}><h2 id="links-heading">Authoritative source links</h2>
        <p>Links point to source records. Their permissions and decisions remain in those modules. Asset links follow a later task.</p>
        {detail!.links.length === 0 && <p>No source links recorded.</p>}
        {detail!.links.map(row => <p key={row.id}>{row.sourceId ? <Link href={sourceHref(row)}>{label(row.sourceType)} <span className={styles.code}>{row.sourceId}</span></Link> : <span>{label(row.sourceType)} · restricted</span>} · {label(row.sourceState)} {m.status !== "HANDED_OVER" && m.status !== "CANCELLED" && <Button variant="ghost" size="sm" disabled={busy || note.trim().length < 3} onClick={() => void unlink(row.id)}>Remove link with reason below</Button>}</p>)}
        {!terminal && <><div className={styles.form}><label>Source type<select value={link.sourceType} onChange={e => setLink({ ...link, sourceType: e.target.value })}>{sources.map(type => <option key={type} value={type}>{label(type)}</option>)}</select></label>
          <label>Exact source ID<input value={link.sourceId} onChange={e => setLink({ ...link, sourceId: e.target.value })} /></label>
          <div className={styles.formActions}><Button variant="outline" disabled={busy || !link.sourceId} onClick={() => void command("LINK_ADD", link)}>Link authorised source</Button></div></div>
        <label className={styles.stack}>Reason for a link correction<textarea maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label></>}
        <div className={styles.buttons}><Link href={`/sites?organisation=${m.organisation_id}`}>Open Sites to create or choose a Site</Link><Link href={`/events?organisation=${m.organisation_id}`}>Open Events to create or choose an Event</Link></div>
      </section>
      <section className={styles.card} aria-labelledby="review-heading" hidden={activeSection!=="review-heading"}><h2 id="review-heading">Go-live review and operational handover</h2>
        <p className={styles.warning}>These are factual exceptions, not a safety, compliance, staffing or contract verdict. Source records must be checked in their own modules.</p>
        <div className={styles.counts}><span>{detail!.counts.done}/{detail!.counts.total} actions done</span><span>{unresolved.length} actions unresolved</span><span>{openBlockers.length} blockers open</span><span>{detail!.links.length} linked sources</span></div>
        <h3>Outstanding actions</h3>{unresolved.length ? <ul>{unresolved.map(row => <li key={row.id}>{row.title} — {label(row.state)}</li>)}</ul> : <p>None.</p>}
        <h3>Open blockers</h3>{openBlockers.length ? <ul>{openBlockers.map(row => <li key={row.id}>{row.reason}</li>)}</ul> : <p>None.</p>}
        <h3>Linked source states</h3>{detail!.links.length ? <ul>{detail!.links.map(row => <li key={row.id}>{label(row.sourceType)} — {label(row.sourceState)}</li>)}</ul> : <p>No linked source state available.</p>}
        <p>Training integration: external / not connected. Contract, purchase order, rates and compliance approval are outside this workspace.</p>
        {!terminal && <><label className={styles.stack}>Decision note, mandatory for handover or cancellation<textarea maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
        <div className={styles.buttons}>{nextState && <Button disabled={busy || (nextState === "HANDED_OVER" && note.trim().length < 3)} onClick={() => void command("STATUS", { state: nextState, note }, nextState === "HANDED_OVER" ? "Record handover with the displayed outstanding facts?" : undefined)}>{nextState === "HANDED_OVER" ? "Hand over to Operations" : `Move to ${label(nextState)}`}</Button>}
          <Button variant="outline" disabled={busy || note.trim().length < 3} onClick={() => void command("STATUS", { state: "CANCELLED", note }, "Cancel this mobilisation? History will remain.")}>Cancel mobilisation</Button></div></>}
      </section>
      <section className={styles.card} aria-labelledby="history-heading" hidden={activeSection!=="history-heading"}><h2 id="history-heading">Immutable history</h2><ol>{detail!.history.map(row => <li key={row.id}>Revision {row.revision}: {label(row.kind)} · {dateTime(row.occurred_at)}{row.reason ? ` · ${row.reason}` : ""}</li>)}</ol></section>
      </div>
    </>}
  </main>;
}
