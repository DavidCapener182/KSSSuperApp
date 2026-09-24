"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type Deployment = { source:"EVENT"|"SITE_SHIFT"; id: string; status: "ALLOCATED"|"ACCEPTED"|"DECLINED"|"CANCELLED"; revision: number;
  event_name: string; event_status: string; site_name: string; reporting_point: string|null; role_name: string;
  service_date: string; report_at: string; shift_starts_at: string; shift_ends_at: string; area_label: string;
  availability_conflict: string|null };
const time = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const labels = { ALLOCATED: "Awaiting your response", ACCEPTED: "Accepted", DECLINED: "Declined", CANCELLED: "Cancelled" };

export function MyDeploymentsClient({focus,focusSource}:{focus?:string;focusSource?:"EVENT"|"SITE_SHIFT"}) {
  const [items, setItems] = useState<Deployment[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [declining, setDeclining] = useState<Deployment|null>(null);
  const [reasonCode, setReasonCode] = useState("CANNOT_ATTEND");
  const [note, setNote] = useState("");
  const load = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deployments/me?offset=${page}${focus?`&allocationId=${encodeURIComponent(focus)}${focusSource?`&source=${focusSource}`:""}`:""}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Your deployments are unavailable. Please retry.");
      const data = await response.json();
      setItems(data.deployments?.items ?? []); setTotal(data.deployments?.total ?? 0); setOffset(page); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Your deployments are unavailable."); }
    finally { setLoading(false); }
  }, [focus, focusSource]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function respond(item: Deployment, response: "ACCEPTED"|"DECLINED") {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await fetch(item.source==="SITE_SHIFT"?`/api/deployments/site-shifts/me/${item.id}`:`/api/deployments/me/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, expectedRevision: item.revision, ...(response === "DECLINED" ? { reasonCode, note } : {}) }) });
      if (!result.ok) throw new Error((await result.json()).error ?? "Response not saved");
      setDeclining(null); setNote(""); setNotice(response === "ACCEPTED" ? "You accepted this allocation. This does not record attendance or work." : "You declined this allocation. The position is available for reassignment.");
      await load(offset);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Response not saved"); }
    finally { setBusy(false); }
  }
  const currentItems = items.filter((item) => ["ALLOCATED", "ACCEPTED"].includes(item.status) && !["COMPLETED", "CANCELLED"].includes(item.event_status));
  const historyItems = items.filter((item) => !currentItems.includes(item));
  const card = (item: Deployment) => <article className="crm-panel deployment-self-card" key={item.id}>
    <div className="deployment-self-top"><div><p className="enterprise-eyebrow">{item.source==="EVENT"?"Event work":"Ongoing Site shift"}</p><h2>{item.event_name}</h2><p>{item.site_name} · {item.role_name}</p></div><span className="deployment-state">{labels[item.status]}</span></div>
    <dl className="deployment-self-facts"><div><dt>Area</dt><dd>{item.area_label}</dd></div><div><dt>Report</dt><dd>{time(item.report_at)}</dd></div><div><dt>Shift</dt><dd>{time(item.shift_starts_at)} → {time(item.shift_ends_at)}</dd></div>{item.reporting_point && <div><dt>Reporting point</dt><dd>{item.reporting_point}</dd></div>}</dl>
    {item.availability_conflict && <p className="enterprise-error" role="status">{item.availability_conflict === "UNAVAILABLE_CONFLICT" ? "Availability conflict with this allocation" : "Declaration no longer covers this allocation"}. Your response has not changed.</p>}
    {item.status === "ALLOCATED" && item.event_status !== "COMPLETED" && item.event_status !== "CANCELLED" && <div className="deployment-actions"><Button disabled={busy} onClick={() => void respond(item, "ACCEPTED")}>Accept allocation</Button><Button variant="outline" disabled={busy} onClick={() => { setDeclining(item); setError(""); }}>Decline</Button></div>}
  </article>;
  return <main className="enterprise-main deployment-self"><div className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Your operational work</p><h1>My Deployments</h1><p>See only your own allocations. Accepting does not record attendance or hours worked.</p></div></div>
    <p className="enterprise-honesty">Responses and availability are separate from attendance. <Link href="/my-schedule">My Schedule</Link> · <Link href="/my-attendance">My Attendance</Link></p>
    {notice && <p className="enterprise-honesty" role="status">{notice}</p>}
    {error && <p className="enterprise-error" role="alert">{error} <Button variant="outline" onClick={() => void load(offset)}>Retry</Button></p>}
    {loading ? <p className="crm-skeleton" role="status">Loading your deployments…</p> : items.length === 0 ? <div className="crm-empty">No deployments to show.</div> : <>
      <section aria-label="Current deployments"><h2>Current allocations</h2>{currentItems.length ? <div className="deployment-self-list">{currentItems.map(card)}</div> : <p className="crm-empty">No current allocations on this page.</p>}</section>
      {historyItems.length > 0 && <details className="deployment-history"><summary>History · {historyItems.length} on this page</summary><div className="deployment-self-list">{historyItems.map(card)}</div></details>}
    </>}
    {total > 25 && <div className="deployment-pagination"><Button variant="outline" disabled={offset === 0 || loading} onClick={() => void load(Math.max(0, offset - 25))}>Previous</Button><span>{offset + 1}–{Math.min(offset + 25, total)} of {total}</span><Button variant="outline" disabled={offset + 25 >= total || loading} onClick={() => void load(offset + 25)}>Next</Button></div>}
    <Sheet open={Boolean(declining)} onOpenChange={(open) => { if (!open && !busy) setDeclining(null); }}><SheetContent className="staffing-sheet"><SheetTitle>Decline allocation</SheetTitle><p>Tell Operations why you cannot take this allocation. Please avoid sensitive personal or medical details.</p>
      <label>Reason<select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}><option value="CANNOT_ATTEND">Cannot attend</option><option value="TIMING_CONFLICT">Timing conflict</option><option value="OTHER">Other</option></select></label>
      <label>Short note (optional)<textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      {error && <p className="enterprise-error" role="alert">{error}</p>}
      <div className="deployment-actions"><Button variant="outline" disabled={busy} onClick={() => setDeclining(null)}>Keep allocation</Button><Button disabled={busy} onClick={() => declining && void respond(declining, "DECLINED")}>Confirm decline</Button></div>
    </SheetContent></Sheet>
  </main>;
}
