"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./work-time-self.module.css";

type Segment = { type: "WORK" | "BREAK"; starts_at: string; ends_at: string };
type EditSegment = { type: "WORK" | "BREAK"; start: string; end: string };
type Revision = { revision: number; kind: "DRAFT" | "SUBMITTED"; proposed_work_minutes: number; evidence_status: string;
  parent_revision: number | null; created_at: string; submitted_at: string | null; segments: Segment[];
  evidence: { event_id: string; event_revision: number; type: string; actual_at: string | null; corrected_actual_at: string | null; recorded_at: string; reason_code: string | null }[] };
type Item = { allocation_id: string; allocation_status: string; allocation_revision: number; event_id: string; event_name: string;
  event_status: string; site_name: string; reporting_point: string | null; service_date: string; report_at: string; shift_starts_at: string;
  shift_ends_at: string; role_name: string; area_label: string; case_id: string | null; status: string | null; current_revision: number | null;
  revisions: Revision[]; attendance: { revision: number; state: string; check_in_at: string | null; check_out_at: string | null;
    review_required: boolean; events: { id: string; revision: number; type: string; actual_at: string | null; effective_actual_at: string | null;
      recorded_at: string; reason_code: string | null }[] }; history: { kind: string; revision: number | null; reason: string | null; recorded_at: string }[] };

const london = (value: string | null) => value ? new Date(value).toLocaleString("en-GB", {
  timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
}) : "Not recorded";
const localInput = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
function londonInstant(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const wall = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  const matches = [0, 60].map((offset) => new Date(wall - offset * 60_000)).filter((date) => localInput(date.toISOString()) === value);
  return matches.length === 1 ? matches[0].toISOString() : null;
}
const editSegments = (segments: Segment[]): EditSegment[] => segments.map((segment) => ({
  type: segment.type, start: localInput(segment.starts_at), end: localInput(segment.ends_at),
}));
const minutesFor = (segments: EditSegment[]) => segments.reduce((total, segment) => {
  if (segment.type !== "WORK") return total;
  const start = londonInstant(segment.start); const end = londonInstant(segment.end);
  return start && end && Date.parse(end) > Date.parse(start) ? total + (Date.parse(end) - Date.parse(start)) / 60_000 : total;
}, 0);

export function MyWorkTimeClient({ allocationId }: { allocationId?: string }) {
  const [items, setItems] = useState<Item[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState("");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState<Record<string, EditSegment[]>>({});
  const live = useRef(false); const readSequence = useRef(0); const pending = useRef(false);
  const revisions = useRef<Record<string, number | null>>({});
  const [available, setAvailable] = useState(false);
  const [loadedSelection,setLoadedSelection] = useState<string|undefined>(allocationId);
  const clearCurrent = () => { setItems([]); setDrafts({}); revisions.current = {}; setAvailable(false); setNotice(""); };
  type Expected = { allocation: string; event: string; allocationRevision: number; caseId: string; revision: number; status: string; segments: Segment[] };
  const load = useCallback(async (expected?: Expected) => {
    const sequence = ++readSequence.current;
    const current = () => live.current && sequence === readSequence.current;
    setLoading(true); setNotice("");
    try {
      const query = allocationId ? `?allocationId=${encodeURIComponent(allocationId)}` : "";
      const response = await fetch(`/api/work-time/me${query}`, { cache: "no-store" });
      if (!current()) return false;
      if (!response.ok) throw new Error("Your worked-time records are unavailable. Refresh to read current records.");
      const data = await response.json(); if (!current()) return false;
      const next: Item[] = data.workTime?.items;
      if (!Array.isArray(next) || new Set(next.map(item => item.allocation_id)).size !== next.length ||
        next.some(item => !item || typeof item.allocation_id !== "string" || !Array.isArray(item.revisions) || !Array.isArray(item.history)) ||
        (allocationId && (next.length > 1 || next.some(item => item.allocation_id !== allocationId))))
        throw new Error("The selected worked-time source is unavailable. Refresh to read current records.");
      if (expected) {
        const item = next.find(entry => entry.allocation_id === expected.allocation);
        const latest = item?.revisions.at(-1);
        const historyKind = expected.status === "DRAFT" ? "DRAFT_SAVED" : "SUBMITTED";
        const segmentsMatch = latest && JSON.stringify(latest.segments.map(segment => [segment.type, segment.starts_at && new Date(segment.starts_at).toISOString(), segment.ends_at && new Date(segment.ends_at).toISOString()])) ===
          JSON.stringify(expected.segments.map(segment => [segment.type, new Date(segment.starts_at).toISOString(), new Date(segment.ends_at).toISOString()]));
        if (!item || item.event_id !== expected.event || item.allocation_revision !== expected.allocationRevision || item.allocation_status !== "ACCEPTED" || item.event_status === "CANCELLED" ||
          item.case_id !== expected.caseId || item.current_revision !== expected.revision || item.status !== expected.status || latest?.revision !== expected.revision || latest.kind !== expected.status ||
          !segmentsMatch || !item.history.some(event => event.kind === historyKind && event.revision === expected.revision))
          throw new Error("The requested worked-time revision is not confirmed by current records. It may have been saved. Refresh before another action.");
      }
      const priorRevisions = revisions.current;setItems(next); setAvailable(true);setLoadedSelection(allocationId);
      setDrafts(currentDrafts => {
        const result: Record<string, EditSegment[]> = {};
        for (const item of next) {
          const latest = item.revisions.at(-1);
          if (priorRevisions[item.allocation_id] === item.current_revision && currentDrafts[item.allocation_id]) result[item.allocation_id] = currentDrafts[item.allocation_id];
          else if ((item.status === "RETURNED" && latest?.kind === "SUBMITTED") || latest?.kind === "DRAFT") result[item.allocation_id] = editSegments(latest.segments);
          else result[item.allocation_id] = [{ type: "WORK", start: "", end: "" }];
        }
        return result;
      }); revisions.current = Object.fromEntries(next.map(item => [item.allocation_id, item.current_revision])); setError(""); return true;
    } catch (caught) {
      if (!current()) return false;
      setItems([]);setDrafts({});revisions.current={};setAvailable(false);setLoadedSelection(allocationId);setError(caught instanceof Error ? caught.message : "Worked-time records unavailable.");return false;
    } finally { if (current()) setLoading(false); }
  }, [allocationId]);
  useEffect(() => { live.current = true;const sequence=readSequence; const timer = setTimeout(() => void load(), 0); return () => { live.current = false;sequence.current++;clearTimeout(timer); }; }, [load]);

  const save = async (item: Item, action: "SAVE_DRAFT" | "SUBMIT") => {
    if (pending.current || !live.current || !available || loading || (allocationId && item.allocation_id !== allocationId)) return;
    const current = drafts[item.allocation_id] ?? [];
    const payload = action === "SAVE_DRAFT" ? current.map(segment => ({ kind: segment.type, startAt: londonInstant(segment.start), endAt: londonInstant(segment.end) })) : undefined;
    if (action === "SAVE_DRAFT" && (payload?.some(segment => !segment.startAt || !segment.endAt || Date.parse(segment.endAt) <= Date.parse(segment.startAt)) || !payload?.some(segment => segment.kind === "WORK"))) {
      setError("Enter each interval in Europe/London time. Repeated or skipped clock times cannot be used."); return;
    }
    const view = readSequence.current;const isCurrent = () => live.current && readSequence.current === view;
    pending.current = true;setBusy(item.allocation_id);setError("");setNotice("");
    const expectedRevision = item.current_revision ?? 0;
    const storageKey = `kss-work-time:${item.allocation_id}:${action}`;
    try {
      const saved = localStorage.getItem(storageKey);const previous = saved ? JSON.parse(saved) : null;
      const fingerprint = JSON.stringify({ action, expectedRevision, segments: payload });
      const request = previous?.fingerprint === fingerprint ? previous.request : { action, expectedRevision,
        ...(payload ? { segments: payload.map(segment => ({ ...segment, startAt: segment.startAt!, endAt: segment.endAt! })) } : {}), idempotencyKey: crypto.randomUUID() };
      localStorage.setItem(storageKey, JSON.stringify({ fingerprint, request }));
      const response = await fetch(`/api/work-time/me/${item.allocation_id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      if (!isCurrent()) return;
      const data = await response.json().catch(() => ({}));if (!isCurrent()) return;
      if (!response.ok) throw new Error("Worked-time change is not confirmed. It may have been saved. Refresh before another action.");
      const receipt = data.result;const status = action === "SAVE_DRAFT" ? "DRAFT" : "SUBMITTED";
      const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
      if (!receipt || !uuid(receipt.case_id) || !uuid(receipt.revision_id) || (item.case_id && receipt.case_id !== item.case_id) || receipt.revision !== expectedRevision + 1 || receipt.status !== status)
        throw new Error("The exact worked-time receipt is not confirmed. It may have been saved. Refresh before another action.");
      const segments: Segment[] = payload ? payload.map(segment => ({ type: segment.kind, starts_at: segment.startAt!, ends_at: segment.endAt! })) : item.revisions.at(-1)?.segments ?? [];
      const readbackSequence = readSequence.current + 1;
      const confirmed = await load({ allocation:item.allocation_id,event:item.event_id,allocationRevision:item.allocation_revision,caseId:receipt.case_id,revision:receipt.revision,status,segments });
      if (!live.current || !confirmed || readSequence.current !== readbackSequence) return;
      localStorage.removeItem(storageKey);setNotice(action === "SUBMIT" ? "Worked-time proposal submitted for manager review and exact revision read back." : "Draft saved as a new revision and exact intervals read back.");
    } catch (caught) {
      if (!isCurrent()) return;
      clearCurrent();setError(caught instanceof Error ? caught.message : "Worked-time change is not confirmed. It may have been saved. Refresh before another action.");
    } finally { if (live.current) { pending.current=false;setBusy(""); } }
  };

  const updateSegment = (item: Item, index: number, field: "type" | "start" | "end", value: string) => setDrafts((current) => ({
    ...current, [item.allocation_id]: (current[item.allocation_id] ?? []).map((segment, i) => i === index ? { ...segment, [field]: value } : segment),
  }));
  const addSegment = (item: Item, type: EditSegment["type"]) => setDrafts((current) => ({
    ...current, [item.allocation_id]: [...(current[item.allocation_id] ?? []), { type, start: "", end: "" }],
  }));
  const canEdit = (item: Item) => available && !loading && item.event_status !== "CANCELLED" && item.allocation_status === "ACCEPTED" && [null, "DRAFT", "RETURNED"].includes(item.status);

  const card = (item: Item) => {
    const currentDraft = drafts[item.allocation_id] ?? [];
    const latest = item.revisions.at(-1);
    const evidenceStatus = item.status === "SUBMITTED" || item.status === "RETURNED" || item.status === "APPROVED" || item.status === "REVIEW_REQUIRED"
      ? latest?.evidence_status : item.attendance?.review_required ? "INCONSISTENT" : item.attendance?.check_in_at && item.attendance?.check_out_at ? "COMPLETE" : "INCOMPLETE";
    return <article className={styles.card} key={item.allocation_id}>
      <div className={styles.cardHeader}><div><p className={styles.eyebrow}>Event allocation · {item.allocation_status.replaceAll("_", " ")}</p>
        <h2>{item.event_name}</h2><p>{item.site_name} · {item.role_name}{item.area_label ? ` · ${item.area_label}` : ""}</p></div>
        <span className={styles.status}>{(item.status ?? "NOT STARTED").replaceAll("_", " ")}</span></div>
      <div className={styles.sourceLine}>Allocation <code>{item.allocation_id}</code> · {item.current_revision === null ? "No saved revision" : `Current revision ${item.current_revision}`}</div><dl className={styles.facts}><div><dt>Reporting point</dt><dd>{item.reporting_point ?? "Not specified"}</dd></div>
        <div><dt>Report time · London</dt><dd>{london(item.report_at)}</dd></div>
        <div><dt>Scheduled shift · London</dt><dd>{london(item.shift_starts_at)} – {london(item.shift_ends_at)}</dd></div>
        </dl><section className={styles.evidence} aria-label="Actual attendance evidence"><h3>Attendance evidence</h3><dl className={styles.evidenceFacts}><div><dt>Evidence state</dt><dd>{item.attendance?.state?.replaceAll("_", " ") ?? "No evidence"}</dd></div>
        <div><dt>Actual check-in</dt><dd>{london(item.attendance?.check_in_at ?? null)}</dd></div>
        <div><dt>Actual check-out</dt><dd>{london(item.attendance?.check_out_at ?? null)}</dd></div></dl></section>
      {evidenceStatus !== "COMPLETE" && <p className={styles.warning} role="status">Attendance evidence is {evidenceStatus?.toLowerCase() ?? "missing"}. You can still submit; this will be flagged for manager review.</p>}
      <p className={styles.explainer}>Attendance is factual evidence only. It has not filled in any worked interval. Enter all work intervals yourself. Breaks are explicit and are not deducted automatically.</p>
      {item.history?.filter((event) => event.kind === "RETURNED").map((event, index) => <p className={styles.returnReason} key={`${event.kind}-${event.revision}-${index}`}>Returned for correction: {event.reason}</p>)}
      {canEdit(item) && <fieldset className={styles.entry} disabled={Boolean(busy) || loading || !available}><legend>{item.status === "RETURNED" ? "Correction · creates a new revision" : "Your proposed time · Europe/London"}</legend>
        {currentDraft.map((segment, index) => <div className={styles.segment} data-interval={segment.type} key={`${item.allocation_id}-${index}`}>
          <label>Interval {index + 1}<select value={segment.type} onChange={(event) => updateSegment(item, index, "type", event.target.value)}>
            <option value="WORK">Work interval</option><option value="BREAK">Break interval</option></select></label>
          <label>Start · London<input type="datetime-local" value={segment.start} onChange={(event) => updateSegment(item, index, "start", event.target.value)} /></label>
          <label>End · London<input type="datetime-local" value={segment.end} onChange={(event) => updateSegment(item, index, "end", event.target.value)} /></label>
        </div>)}
        <div className={styles.actions}><Button type="button" variant="outline" onClick={() => addSegment(item, "WORK")}>Add work interval</Button>
          <Button type="button" variant="outline" onClick={() => addSegment(item, "BREAK")}>Add break interval</Button></div>
        <p className={styles.minutes}>Proposed work: {minutesFor(currentDraft)} minutes. Only explicit Work intervals are counted; breaks are shown separately. Proposed minutes are not payable time.</p>
        <div className={styles.actions}><Button type="button" disabled={Boolean(busy)} onClick={() => void save(item, "SAVE_DRAFT")}>{busy === item.allocation_id ? "Saving…" : "Save draft"}</Button>
          {item.status === "DRAFT" && <Button type="button" variant="outline" disabled={Boolean(busy) || !latest} onClick={() => void save(item, "SUBMIT")}>Submit for review</Button>}</div>
      </fieldset>}
      {!canEdit(item) && latest && <section className={styles.savedProposal} aria-label="Saved worked-time proposal"><h3>Revision {latest.revision} · {latest.kind === "SUBMITTED" ? "Submitted proposal" : "Saved draft"}</h3><p>{latest.proposed_work_minutes} proposed work minutes · {latest.evidence_status.toLowerCase()} evidence</p><ul>{latest.segments.map((segment, index) => <li key={index}>{segment.type === "WORK" ? "Work" : "Break"} · {london(segment.starts_at)} → {london(segment.ends_at)}</li>)}</ul><p>Proposed minutes are not payable time.</p></section>}
      {item.status === "REVIEW_REQUIRED" && <p className={styles.warning}>A linked attendance or Event source changed. The original revision is preserved and flagged for manager review.</p>}
      {item.revisions.length > 0 && <details className={styles.history}><summary>Revision history · {item.revisions.length}</summary>
        {item.revisions.map((revision) => <section className={styles.revision} key={revision.revision}>
          <h3>Revision {revision.revision} · {revision.kind === "SUBMITTED" ? "Submitted proposal" : "Saved draft"}</h3>
          <p>{revision.proposed_work_minutes} proposed work minutes · evidence {revision.evidence_status.toLowerCase()} · saved {london(revision.created_at)}</p>
          <ul>{revision.segments.map((segment, index) => <li key={`${revision.revision}-${index}`}>{segment.type === "WORK" ? "Work" : "Break"}: {london(segment.starts_at)} – {london(segment.ends_at)}</li>)}</ul>
          {revision.kind === "SUBMITTED" && revision.evidence.length > 0 && <details><summary>Pinned attendance evidence · {revision.evidence.length} facts</summary>
            <ul>{revision.evidence.map((fact) => <li key={fact.event_id}>{fact.type.replaceAll("_", " ")} · revision {fact.event_revision} · {london(fact.corrected_actual_at ?? fact.actual_at ?? fact.recorded_at)}</li>)}</ul></details>}
        </section>)}
      </details>}
    </article>;
  };

  return <main className={`enterprise-main ${styles.wrap}`}>
    <header className={styles.heading}><p className={styles.eyebrow}>Staff self-service · Event work</p><h1>My Worked Time</h1>
      <p>Propose time for an accepted Event allocation. This records worked time only; attendance never creates your proposal.</p>
      <Link href="/my-deployments">Back to My Deployments</Link></header>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}{error && <p role="alert" className={styles.error}>{error} <Button variant="outline" disabled={Boolean(busy)} onClick={() => void load()}>Refresh</Button></p>}
    {loading || loadedSelection !== allocationId ? <p role="status">Loading your Event allocations…</p> : !available ? <p className={styles.empty}>Current worked-time records are not verified. Refresh to read the current source.</p> : items.length === 0 ? <p className={styles.empty}>{allocationId ? "This allocation is not available in your own worked-time view." : "No accepted Event allocations are available."}</p> : items.map(card)}
  </main>;
}
