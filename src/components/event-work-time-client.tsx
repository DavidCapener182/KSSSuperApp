"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./work-time.module.css";

type Evidence = { event_id: string; event_revision: number; observed_case_revision: number; type: string; actual_at: string | null; corrected_actual_at: string | null;
  recorded_at: string; reason_code: string | null; reason?: string | null };
type Revision = { id: string; revision: number; kind: "DRAFT" | "SUBMITTED"; proposed_work_minutes: number; evidence_status: string;
  parent_revision: number | null; author_person_id: string; created_at: string; submitted_at: string | null;
  segments: { type: "WORK" | "BREAK"; starts_at: string; ends_at: string }[]; evidence: Evidence[] };
type WorkCase = { case_id: string; allocation_id: string; person_id: string; person_name: string; status: string; current_revision: number;
  event_name: string; site_name: string; role_name: string; area_label: string; report_at: string; shift_starts_at: string; shift_ends_at: string;
  revisions: Revision[]; history: { kind: string; revision: number | null; actor_person_id: string | null; reason: string | null; recorded_at: string }[] };
type Grant = { id: string; person_id: string; person_name: string; capability: string; effective_from: string; effective_until: string;
  revoked_at: string | null; reason: string; revocation_reason: string | null };
type Candidate = { id: string; display_name: string };
const london = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function EventWorkTimeClient({ eventId, canAdminGrants }: { eventId: string; canAdminGrants: boolean }) {
  const [items, setItems] = useState<WorkCase[]>([]); const [actorPersonId, setActorPersonId] = useState(""); const [canReview, setCanReview] = useState(false); const [canApprove, setCanApprove] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]); const [people, setPeople] = useState<Candidate[]>([]); const [loading, setLoading] = useState(true);
  const [grantLoading, setGrantLoading] = useState(false); const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({}); const [personId, setPersonId] = useState(""); const [capability, setCapability] = useState("WORK_TIME_REVIEW");
  const [effectiveFrom, setEffectiveFrom] = useState(""); const [effectiveUntil, setEffectiveUntil] = useState("");
  const [grantReason, setGrantReason] = useState(""); const [revokeReason, setRevokeReason] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/work-time`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error("No active Event-scoped work-time review grant is available for this account.");
      setItems(data.workTime?.items ?? []); setActorPersonId(data.workTime?.actor_person_id ?? ""); setCanReview(Boolean(data.workTime?.can_review)); setCanApprove(Boolean(data.workTime?.can_approve)); setError("");
    } catch (caught) { setItems([]); setActorPersonId(""); setCanReview(false); setCanApprove(false); setError(caught instanceof Error ? caught.message : "Worked-time review unavailable."); }
    finally { setLoading(false); }
  }, [eventId]);
  const loadGrants = useCallback(async () => {
    if (!canAdminGrants) return;
    setGrantLoading(true);
    try {
      const response = await fetch(`/api/access/work-time-grants?eventId=${eventId}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Grant list unavailable.");
      setGrants(data.grants?.grants ?? []); setPeople(data.grants?.people ?? []);
      if (!personId && data.grants?.people?.[0]) setPersonId(data.grants.people[0].id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Grant list unavailable."); }
    finally { setGrantLoading(false); }
  }, [canAdminGrants, eventId, personId]);
  useEffect(() => { const timer = setTimeout(() => { void load(); void loadGrants(); }, 0); return () => clearTimeout(timer); }, [load, loadGrants]);

  async function action(item: WorkCase, kind: "RETURN" | "APPROVE") {
    const reason = reasons[item.case_id]?.trim() ?? "";
    if (kind === "RETURN" && reason.length < 3) { setError("Add a reason so Staff can make a clear correction."); return; }
    setBusy(item.case_id); setError(""); setNotice("");
    const storageKey = `kss-work-time-review:${item.case_id}:${kind}`;
    const fingerprint = JSON.stringify({ eventId, caseId: item.case_id, action: kind, expectedRevision: item.current_revision, reason });
    try {
      const saved = localStorage.getItem(storageKey); const previous = saved ? JSON.parse(saved) : null;
      const request = previous?.fingerprint === fingerprint ? previous.request : {
        caseId: item.case_id, action: kind, expectedRevision: item.current_revision, ...(reason ? { reason } : {}), idempotencyKey: crypto.randomUUID(),
      };
      localStorage.setItem(storageKey, JSON.stringify({ fingerprint, request }));
      const response = await fetch(`/api/events/${eventId}/work-time`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? "Review was not recorded.");
      localStorage.removeItem(storageKey); setNotice(kind === "RETURN" ? "Returned to Staff for a new correction revision." : "Worked time approved for this exact submitted revision.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Review was not recorded. Retry safely."); }
    finally { setBusy(""); }
  }

  async function createGrant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("grant"); setError(""); setNotice("");
    try {
      const fingerprint = JSON.stringify({ eventId, personId, capability, effectiveFrom, effectiveUntil, grantReason });
      const storageKey = `kss-work-time-grant:${eventId}`; const saved = localStorage.getItem(storageKey); const previous = saved ? JSON.parse(saved) : null;
      const request = previous?.fingerprint === fingerprint ? previous.request : { eventId, personId, capability,
        effectiveFrom: new Date(`${effectiveFrom}:00Z`).toISOString(), effectiveUntil: new Date(`${effectiveUntil}:00Z`).toISOString(),
        reason: grantReason, idempotencyKey: crypto.randomUUID() };
      localStorage.setItem(storageKey, JSON.stringify({ fingerprint, request }));
      const response = await fetch("/api/access/work-time-grants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? "Grant not recorded.");
      localStorage.removeItem(storageKey); setGrantReason(""); setNotice("Named Event-scoped capability grant recorded."); await loadGrants();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Grant not recorded."); }
    finally { setBusy(""); }
  }

  async function revokeGrant(grant: Grant) {
    if (revokeReason.trim().length < 3) { setError("Add a reason for revoking this grant."); return; }
    setBusy(grant.id); setError("");
    try {
      const fingerprint = JSON.stringify({ grantId: grant.id, reason: revokeReason.trim() });
      const key = `kss-work-time-grant-revoke:${grant.id}`; const saved = localStorage.getItem(key); const previous = saved ? JSON.parse(saved) : null;
      const request = previous?.fingerprint === fingerprint ? previous.request : { reason: revokeReason.trim(), idempotencyKey: crypto.randomUUID() };
      localStorage.setItem(key, JSON.stringify({ fingerprint, request }));
      const response = await fetch(`/api/access/work-time-grants/${grant.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      if (!response.ok) throw new Error("Grant was not revoked. Refresh the current grant state.");
      localStorage.removeItem(key); setRevokeReason(""); setNotice("Event-scoped grant revoked."); await loadGrants();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Grant was not revoked."); }
    finally { setBusy(""); }
  }

  const itemsUi = items.map((item) => {
    const revision = item.revisions.find((entry) => entry.revision === item.current_revision && entry.kind === "SUBMITTED") ??
      [...item.revisions].reverse().find((entry) => entry.kind === "SUBMITTED");
    const submitterCannotApprove = Boolean(actorPersonId) && revision?.author_person_id === actorPersonId;
    return <article className={styles.card} key={item.case_id}>
      <div className={styles.cardHeader}><div><p className={styles.eyebrow}>Event allocation · {item.status.replaceAll("_", " ")}</p>
        <h2>{item.person_name}</h2><p>{item.event_name} · {item.site_name} · {item.role_name}{item.area_label ? ` · ${item.area_label}` : ""}</p></div>
        <span className={styles.status}>Revision {item.current_revision}</span></div>
      <p>Report {london(item.report_at)} · Shift {london(item.shift_starts_at)} – {london(item.shift_ends_at)}</p>
      {revision && <><p><strong>Staff proposed {revision.proposed_work_minutes} minutes</strong> · attendance evidence {revision.evidence_status.toLowerCase()}</p>
        {revision.evidence_status !== "COMPLETE" && <p className={styles.warning}>Evidence warning: this submitted revision requires review of missing or inconsistent attendance.</p>}
        <h3>Staff-entered intervals</h3><ul>{revision.segments.map((segment, index) => <li key={`${revision.revision}-${index}`}>
          {segment.type === "WORK" ? "Work" : "Break"}: {london(segment.starts_at)} – {london(segment.ends_at)}
        </li>)}</ul>
        <h3>Pinned attendance facts · observed case revision {revision.evidence[0]?.observed_case_revision ?? "none"}</h3>
        {revision.evidence.length === 0 ? <p>There were no attendance facts when this revision was submitted.</p> : <ul>{revision.evidence.map((fact) => <li key={fact.event_id}>
          {fact.type.replaceAll("_", " ")} · event revision {fact.event_revision} · actual {london(fact.corrected_actual_at ?? fact.actual_at ?? fact.recorded_at)}{fact.reason ? ` · ${fact.reason}` : ""}
        </li>)}</ul>}
      </>}
      {item.status === "REVIEW_REQUIRED" && <p className={styles.warning}>Attendance or Event source changed after submission. The pinned snapshot and submitted minutes remain unchanged.</p>}
      <details className={styles.history}><summary>Immutable revision and decision history</summary>
        {item.revisions.map((entry) => <section className={styles.revision} key={entry.id}><h3>Revision {entry.revision} · {entry.kind}</h3>
          <p>{entry.proposed_work_minutes} proposed minutes · {entry.evidence_status.toLowerCase()} · submitted {entry.submitted_at ? london(entry.submitted_at) : "not submitted"}</p>
          <ul>{entry.segments.map((segment, index) => <li key={`${entry.revision}-seg-${index}`}>{segment.type}: {london(segment.starts_at)} – {london(segment.ends_at)}</li>)}</ul>
        </section>)}
        <ol>{item.history.map((event, index) => <li key={`${event.kind}-${event.recorded_at}-${index}`}>{event.kind.replaceAll("_", " ")} · {london(event.recorded_at)}{event.reason ? ` · ${event.reason}` : ""}</li>)}</ol>
      </details>
      {canReview && ["SUBMITTED", "REVIEW_REQUIRED"].includes(item.status) && <div className={styles.review}>
        <label>Return reason for Staff (required)<textarea maxLength={500} value={reasons[item.case_id] ?? ""} onChange={(event) => setReasons({ ...reasons, [item.case_id]: event.target.value })} /></label>
        <div className={styles.actions}><Button variant="outline" disabled={Boolean(busy) || (reasons[item.case_id] ?? "").trim().length < 3}
          onClick={() => void action(item, "RETURN")}>{busy === item.case_id ? "Recording…" : "Return for correction"}</Button></div>
      </div>}
      {canApprove && item.status === "SUBMITTED" && <div className={styles.actions}>
        <Button disabled={Boolean(busy) || submitterCannotApprove} onClick={() => void action(item, "APPROVE")}>Approve worked time</Button>
        {submitterCannotApprove && <span className={styles.warning}>The submitter cannot approve this revision.</span>}
      </div>}
    </article>;
  });

  return <section className={styles.wrap}>
    <header className={styles.heading}><p className={styles.eyebrow}>Exact Event-scoped review</p><h1>Worked-time review</h1>
      <p>Review Staff proposals against their pinned attendance evidence. Attendance never calculates worked time.</p>
      <Link href={`/events/${eventId}`}>Back to Event</Link></header>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    {canAdminGrants && <section className={styles.card} aria-label="Event capability grants"><h2>Named Event capability grants</h2>
      <p>Office, Operations and Super Admin roles do not grant review or approval authority. Every grant is limited to this Event and time window.</p>
      <form className={styles.grantForm} onSubmit={(event) => void createGrant(event)}>
        <label>Person<select required value={personId} onChange={(event) => setPersonId(event.target.value)}>
          <option value="">Select a person</option>{people.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
        <label>Capability<select value={capability} onChange={(event) => setCapability(event.target.value)}><option value="WORK_TIME_REVIEW">Review and return</option><option value="WORK_TIME_APPROVE">Approve worked time</option></select></label>
        <label>Effective from · UTC<input required type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label>
        <label>Expires · UTC<input required type="datetime-local" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} /></label>
        <label className={styles.wide}>Reason<textarea required minLength={3} maxLength={300} value={grantReason} onChange={(event) => setGrantReason(event.target.value)} /></label>
        <Button type="submit" disabled={Boolean(busy) || grantLoading || !personId}>{busy === "grant" ? "Saving…" : "Grant for this Event"}</Button>
      </form>
      <h3>Grant history</h3>{grantLoading ? <p>Loading grants…</p> : grants.length === 0 ? <p>No named grants are recorded for this Event.</p> : <ul className={styles.grantList}>
        {grants.map((grant) => <li key={grant.id}><strong>{grant.person_name}</strong> · {grant.capability.replaceAll("_", " ")} · {london(grant.effective_from)} – {london(grant.effective_until)}
          {grant.revoked_at ? ` · Revoked: ${grant.revocation_reason}` : <div className={styles.revoke}><label>Revocation reason<textarea value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} /></label>
            <Button variant="outline" disabled={Boolean(busy) || revokeReason.trim().length < 3} onClick={() => void revokeGrant(grant)}>Revoke grant</Button></div>}</li>)}
      </ul>}</section>}
    {loading ? <p role="status">Loading scoped submissions…</p> : items.length === 0 ? <p className={styles.empty}>{canReview || canApprove ? "No submitted worked-time proposals for this Event." : "Review and approval require separate, named Event-scoped capability grants."}</p> : itemsUi}
  </section>;
}
