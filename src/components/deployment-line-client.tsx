"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type Allocation = { id: string; person_id: string; person_name: string; status: string; revision: number; allocated_at: string; availability_conflict: string|null };
type Candidate = { id: string; display_name: string; role: string; check: { result: "BLOCKED"|"REVIEW_REQUIRED"|"SYNTHETIC_CHECKS_PASSED_WITH_WARNINGS"; availability: string; reasons: string[]; policy_version: number|null } };
type Detail = { required: number; allocated: number; accepted: number; remaining: number; allocations: Allocation[] };
type Page = { total: number; items: Candidate[] };
const reasonLabels: Record<string,string> = {
  AVAILABILITY_NOT_RECORDED: "Not declared", AVAILABILITY_NOT_DECLARED: "Not declared", AVAILABILITY_NOT_FULLY_COVERED: "Not fully covered", DECLARED_AVAILABLE: "Declared available", DECLARED_UNAVAILABLE: "Declared unavailable", TRAVEL_REST_NOT_ASSESSED: "Travel/rest not assessed",
  ROLE_QUALIFICATION_RULE_NOT_CONFIGURED: "Role qualification rule not configured",
  SYNTHETIC_SIA_CHECK_SATISFIED: "Synthetic staffing check satisfied (development only)",
  ACTIVE_SECURITY_STAFF_ROLE_REQUIRED: "Active Security Staff role required", RECORDED_ALLOCATION_CLASH: "Overlapping allocation",
  SIA_SYNTHETIC_RULE_DISABLED: "Synthetic SIA rule not configured", SYNTHETIC_SIA_CHECK_NOT_SATISFIED: "Synthetic SIA check not satisfied",
  REQUIREMENT_NOT_ACTIVE: "Requirement or Event is not active",
};
const label = (code: string) => reasonLabels[code] ?? code.toLowerCase().replaceAll("_", " ");
async function api(path: string, init?: RequestInit) { const response = await fetch(path, { ...init, cache: "no-store" }); const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Deployment request denied"); return data; }

export function DeploymentLineClient({ eventId, requirementId, revision, roleName, area, disabled, open, onClose, onChanged }: {
  eventId: string; requirementId: string; revision: number; roleName: string; area: string; disabled: boolean;
  open: boolean; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const base = `/api/events/${eventId}/staffing-requirements/${requirementId}`;
  const [detail, setDetail] = useState<Detail|null>(null); const [candidates, setCandidates] = useState<Page|null>(null);
  const [search, setSearch] = useState(""); const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Candidate|null>(null); const [ack, setAck] = useState(false); const [reason, setReason] = useState("");
  const [cancel, setCancel] = useState<Allocation|null>(null); const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async (query = "", page = 0) => { setLoading(true); setError(""); try { const [detailData, candidateData] = await Promise.all([
    api(`${base}/allocations`), api(`${base}/candidates?search=${encodeURIComponent(query)}&offset=${page}`)]);
    setDetail(detailData.deployment); setCandidates(candidateData.candidates); setOffset(page);
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Deployment unavailable"); } finally { setLoading(false); } }, [base]);
  useEffect(() => { if (!open) return; const timer = setTimeout(() => void load(search, 0), 0); return () => clearTimeout(timer); }, [open, load, search]);
  async function allocate() { if (!selected) return; setBusy(true); setError(""); try {
    await api(`${base}/allocations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      personId: selected.id, expectedRevision: revision, acknowledgeWarnings: ack, reason: reason.trim() || null }) });
    setSelected(null); setAck(false); setReason(""); await load(search, offset); await onChanged();
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Allocation denied"); } finally { setBusy(false); } }
  async function cancelAllocation() { if (!cancel) return; setBusy(true); setError(""); try {
    await api(`${base}/allocations/${cancel.id}`, { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "CANCEL", expectedRevision: cancel.revision, reason: cancelReason.trim() }) });
    setCancel(null); setCancelReason(""); await load(search, offset); await onChanged();
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Cancellation denied"); } finally { setBusy(false); } }
  return <Sheet open={open} onOpenChange={(value) => { if (!value && !busy) onClose(); }}><SheetContent className="staffing-sheet deployment-sheet">
    <SheetTitle>{roleName} · {area}</SheetTitle><p className="enterprise-honesty">Exact requirement · {detail ? `${detail.required} required · ${detail.allocated} allocated · ${detail.remaining} remaining · ${detail.accepted} accepted` : "Loading counts…"}</p>
    {error && <p className="enterprise-error" role="alert">{error} <Button variant="ghost" onClick={() => void load(search, offset)}>Retry</Button></p>}
    {loading && <p className="crm-skeleton" role="status">Checking current allocations and candidates…</p>}
    {detail && <section><h3>Current allocations</h3>{detail.allocations.length === 0 ? <p className="crm-empty">No one allocated yet.</p> : <div className="deployment-allocated-list">{detail.allocations.map((item) => <div className="deployment-allocated-row" key={item.id}><div><strong>{item.person_name}</strong><span>{item.status === "ALLOCATED" ? "Awaiting Staff response" : item.status[0] + item.status.slice(1).toLowerCase()}</span>{item.availability_conflict && <small role="status">{item.availability_conflict === "UNAVAILABLE_CONFLICT" ? "Availability conflict with existing allocation" : "Declaration no longer covers this allocation"}</small>}</div>
      {!disabled && ["ALLOCATED", "ACCEPTED"].includes(item.status) && <Button variant="outline" disabled={busy} onClick={() => { setCancel(item); setCancelReason(""); }}>Cancel allocation</Button>}</div>)}</div>}</section>}
    {!disabled && <section><h3>Find a candidate</h3><label>Search Security Staff by name<Input value={search} maxLength={80} onChange={(event) => { setSearch(event.target.value); setSelected(null); }} placeholder="Search name" /></label>
      <p className="enterprise-honesty">Declarations, clashes and configured checks are separate. Candidate checks are synthetic development checks, not live eligibility.</p>
      {candidates && <>{candidates.items.length === 0 ? <p className="crm-empty">No matching candidates.</p> : <div className="deployment-candidate-list">{candidates.items.map((person) => <div className="deployment-candidate" key={person.id}><div><strong>{person.display_name}</strong><span>{person.check.result === "BLOCKED" ? "Blocked" : person.check.result === "REVIEW_REQUIRED" ? "Review required" : "Synthetic checks passed with warnings"}</span><small>{person.check.result !== "BLOCKED" ? "No recorded allocation clash · Travel/rest not assessed · " : ""}{person.check.reasons.map(label).join(" · ")}</small></div><Button variant="outline" disabled={busy || person.check.result === "BLOCKED" || (detail?.remaining ?? 0) < 1} onClick={() => { setSelected(person); setAck(false); setReason(""); }}>Select</Button></div>)}</div>}
        {candidates.total > 20 && <div className="deployment-pagination"><Button variant="outline" disabled={offset === 0} onClick={() => void load(search, Math.max(0, offset - 20))}>Previous</Button><span>{offset + 1}–{Math.min(offset + 20, candidates.total)} of {candidates.total}</span><Button variant="outline" disabled={offset + 20 >= candidates.total} onClick={() => void load(search, offset + 20)}>Next</Button></div>}</>}
    </section>}
    {selected && <section className="deployment-confirm"><h3>Allocate {selected.display_name}?</h3><p>{selected.check.reasons.map(label).join(" · ")}</p>
      {selected.check.result === "REVIEW_REQUIRED" && <><label className="staffing-confirm"><input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} /> I have reviewed these warnings. This is a synthetic allocation, not a qualification or availability decision.</label><label>Reason<textarea maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></label></>}
      <div className="deployment-actions"><Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Back</Button><Button disabled={busy || (selected.check.result === "REVIEW_REQUIRED" && (!ack || reason.trim().length < 3))} onClick={() => void allocate()}>Allocate</Button></div></section>}
    {cancel && <section className="deployment-confirm"><h3>Cancel {cancel.person_name}&apos;s allocation?</h3><label>Reason<textarea maxLength={300} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label><div className="deployment-actions"><Button variant="outline" disabled={busy} onClick={() => setCancel(null)}>Keep allocation</Button><Button disabled={busy || cancelReason.trim().length < 3} onClick={() => void cancelAllocation()}>Cancel allocation</Button></div></section>}
  </SheetContent></Sheet>;
}
