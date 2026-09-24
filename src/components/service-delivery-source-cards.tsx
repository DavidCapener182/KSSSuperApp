"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { london, serviceRequest } from "./service-delivery-api";
import styles from "./service-delivery.module.css";

type Period = { id: string; name: string; starts_on: string; ends_on: string; state: string };
type Facts = {
  reviewPeriodId: string; startsOn: string; endsOn: string; periodState: string;
  siteServiceId: string; siteId: string; sourceServiceState: string; asOf: string;
  staffing: { plannedDemandCount: number; required: number; allocated: number; accepted: number; remaining: number };
  attendance: { recordedCaseCount: number; checkIns: number; checkOuts: number; currentExceptions: number; noShows: number; reviewRequired: number };
};

export function ServiceDeliverySourceCards({ deliveryId, periods }: { deliveryId: string; periods: Period[] }) {
  const [periodId,setPeriodId] = useState(() => periods.find(p => p.state === "OPEN")?.id ?? periods.at(-1)?.id ?? "");
  const [facts,setFacts] = useState<Facts | null>(null); const [error,setError] = useState("");
  useEffect(() => {
    if (!periodId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void serviceRequest(`/api/service-delivery/${deliveryId}/source-cards?periodId=${encodeURIComponent(periodId)}`, { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) { setFacts(data); setError(""); } })
        .catch(() => { if (!controller.signal.aborted) { setFacts(null); setError("Current source facts unavailable. Refresh or check this review period."); } });
    },0);
    return () => { clearTimeout(timer); controller.abort(); };
  },[deliveryId,periodId]);
  const selected = periods.find(p => p.id === periodId);
  return <section id="source-facts" className={styles.card} aria-labelledby="source-facts-heading">
    <h2 id="source-facts-heading">Staffing &amp; attendance source facts</h2>
    <p className={styles.muted}>Live read from the exact Site Service for one Review Period. These cards do not save facts in Service Delivery or change staffing and attendance records.</p>
    {periods.length === 0 ? <p>Create a Review Period to see dated source facts.</p> : <>
      <label className={styles.sourceSelector}>Review Period<select value={periodId} onChange={e => { setFacts(null); setPeriodId(e.target.value); }}>
        {periods.map(p => <option value={p.id} key={p.id}>{p.name} · {p.starts_on} to {p.ends_on} · {p.state}</option>)}
      </select></label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {selected && !facts && !error && <p role="status">Loading current source facts…</p>}
      {facts && facts.reviewPeriodId === periodId && <>
        <p className={styles.meta}>London report dates {facts.startsOn} to {facts.endsOn} inclusive · {facts.periodState} review · source Service {facts.sourceServiceState} · read {london(facts.asOf)}</p>
        <div className={styles.grid}>
          <article className={styles.sourceCard}><h3>Staffing demand</h3>
            <dl className={styles.sourceNumbers}><div><dt>Required</dt><dd>{facts.staffing.required}</dd></div><div><dt>Allocated</dt><dd>{facts.staffing.allocated}</dd></div><div><dt>Accepted</dt><dd>{facts.staffing.accepted}</dd></div><div><dt>Remaining</dt><dd>{facts.staffing.remaining}</dd></div></dl>
            <p className={styles.meta}>{facts.staffing.plannedDemandCount} planned shift demand{facts.staffing.plannedDemandCount === 1 ? "" : "s"} in this period. Allocated includes accepted; remaining is required less allocated, per demand.</p>
            <Link href={`/sites/${facts.siteId}/services/${facts.siteServiceId}`}>Open authoritative Site Service</Link>
          </article>
          <article className={styles.sourceCard}><h3>Recorded attendance</h3>
            <dl className={styles.sourceNumbers}><div><dt>Check-ins</dt><dd>{facts.attendance.checkIns}</dd></div><div><dt>Check-outs</dt><dd>{facts.attendance.checkOuts}</dd></div><div><dt>Current exceptions</dt><dd>{facts.attendance.currentExceptions}</dd></div><div><dt>No-shows</dt><dd>{facts.attendance.noShows}</dd></div><div><dt>Review required</dt><dd>{facts.attendance.reviewRequired}</dd></div></dl>
            <p className={styles.meta}>{facts.attendance.recordedCaseCount} attendance case{facts.attendance.recordedCaseCount === 1 ? "" : "s"} recorded on shifts with a London report date in this period. Historical cases remain counted after allocation or demand cancellation. An absent case is not a confirmed absence.</p>
            <Link href={`/sites/${facts.siteId}/services/${facts.siteServiceId}/attendance`}>Open authoritative attendance</Link>
          </article>
        </div>
        <p className={styles.muted}>Staffing counts current planned demand and active allocations. Attendance counts recorded cases, including cases on later-cancelled allocations or demands, so the figures can differ. Check-ins and check-outs are not worked hours, payable time, billable time or a service performance score. Closed review periods continue to show current source facts, not a frozen snapshot.</p>
      </>}
    </>}
  </section>;
}
