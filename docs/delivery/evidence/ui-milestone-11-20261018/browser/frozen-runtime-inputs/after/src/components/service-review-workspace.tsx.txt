"use client";

import Link from "next/link";
import { useState } from "react";
import { london } from "./service-delivery-api";
import { ServiceDeliverySourceCards } from "./service-delivery-source-cards";
import styles from "./service-delivery.module.css";

type Period = { id: string; name: string; starts_on: string; ends_on: string; state: string };
type Meeting = { id: string; period_id: string; scheduled_at: string; state: string; held_at: string | null };
type Action = { id: string; period_id: string | null; title: string; due_on: string | null; state: string };
type Blocker = { id: string; action_id: string; reason: string; resolved_at: string | null };

export function ServiceReviewWorkspace({ deliveryId, periods, meetings, actions, blockers }: {
  deliveryId: string; periods: Period[]; meetings: Meeting[]; actions: Action[]; blockers: Blocker[];
}) {
  const [periodId,setPeriodId] = useState(() => periods.find(period => period.state === "OPEN")?.id ?? periods.at(-1)?.id ?? "");
  const period = periods.find(item => item.id === periodId) ?? periods.find(item => item.state === "OPEN") ?? periods.at(-1);
  const selectedPeriodId = period?.id ?? "";
  const relevantActions = actions.filter(action => (action.period_id === selectedPeriodId || action.period_id === null) && !["DONE","CANCELLED"].includes(action.state));
  const openBlockers = blockers.filter(blocker => !blocker.resolved_at && relevantActions.some(action => action.id === blocker.action_id));
  const periodMeetings = meetings.filter(meeting => meeting.period_id === selectedPeriodId && meeting.state !== "CANCELLED");
  return <section id="review-workspace" aria-labelledby="review-workspace-title">
    <h2 id="review-workspace-title">Review workspace</h2>
    <p>Prepare one period using current source facts and existing management records. This view does not record a Client review outcome or measure an SLA.</p>
    {!period && <p>Create a Review Period to prepare a review.</p>}
    {period && <>
      <label className={styles.sourceSelector}>Review period<select value={selectedPeriodId} onChange={event => setPeriodId(event.target.value)}>{periods.map(item => <option key={item.id} value={item.id}>{item.name} · {item.starts_on} to {item.ends_on}</option>)}</select></label>
      <p className={styles.meta}>{period.starts_on} to {period.ends_on} inclusive · Europe/London · {period.state} period</p>
      <ServiceDeliverySourceCards key={period.id} deliveryId={deliveryId} periods={[period]} />
      <div className={styles.grid}>
        <section className={styles.card}><h3>Open actions · {relevantActions.length}</h3>
          <p className={styles.muted}>Includes actions assigned to this period and the overall Service Delivery record.</p>
          {relevantActions.length ? <ul>{relevantActions.map(action => <li key={action.id}>{action.title} · {action.state.replaceAll("_"," ")} · due {action.due_on ?? "not set"}{action.period_id === null && " · overall service"}</li>)}</ul> : <p>No open actions in this context.</p>}
          <Link href="#actions">Manage actions</Link></section>
        <section className={styles.card}><h3>Open blockers · {openBlockers.length}</h3>
          {openBlockers.length ? <ul>{openBlockers.map(blocker => <li key={blocker.id}>{blocker.reason}</li>)}</ul> : <p>No open blockers on these actions.</p>}
          <Link href="#actions">Manage blockers</Link></section>
        <section className={styles.card}><h3>Meetings · {periodMeetings.length}</h3>
          {periodMeetings.length ? <ul>{periodMeetings.map(meeting => <li key={meeting.id}>{meeting.state} · scheduled {london(meeting.scheduled_at)}{meeting.held_at && ` · held ${london(meeting.held_at)}`}</li>)}</ul> : <p>No meeting recorded for this period.</p>}
          <Link href="#meetings">Manage meetings</Link></section>
      </div>
    </>}
  </section>;
}
