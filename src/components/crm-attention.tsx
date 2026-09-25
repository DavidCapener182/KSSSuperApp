"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { crmDueStatus } from "@/lib/crm/due-status";
import styles from "./crm-attention.module.css";

type Opportunity = { id: string; title: string; stage: string; owner_person_id?: string;
  expected_decision_date?: string | null; crm_organisations?: { name: string } | null };
type Task = { id: string; title: string; due_at: string | null; assignee_person_id: string; opportunity: Opportunity | null };
type Attention = { followUps: Task[]; decisions: Opportunity[]; noFutureSample: Opportunity[]; asOf: string };
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, part => part.toUpperCase());
export function CrmAttention({ owners, personId }: { owners: { id: string; displayName: string }[]; personId: string }) {
  const [data, setData] = useState<Attention | null>(null);
  const [won, setWon] = useState<(Opportunity & { organisation_id: string })[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { let active = true;
    fetch("/api/crm/work?view=attention", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Commercial attention is unavailable."); return response.json() as Promise<Attention>;
    }).then(result => { if (active) setData(result); }).catch(caught => { if (active) setError(String(caught)); });
    return () => { active = false; };
  }, []);
  useEffect(() => { let active = true;
    fetch("/api/crm?view=opportunities&stage=WON&offset=0", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Won list unavailable"); return response.json();
    }).then(result => { if (active) setWon((result.items ?? []).slice(0, 8)); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const owner = (id: string) => owners.find(item => item.id === id)?.displayName ?? "Assigned Office";
  const due = data?.followUps.filter(task => task.opportunity && ["Overdue", "Due today"].includes(crmDueStatus(task.due_at))) ?? [];
  return <section aria-labelledby="commercial-attention-heading" className={styles.workspace}>
    <div className={styles.heading}><div><p className="eyebrow">Commercial work</p><h2 id="commercial-attention-heading">What needs attention?</h2></div>
      <Link href="/crm?view=pipeline">Work the pipeline →</Link></div>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading current commercial work…</p>}
    {data && <>
      <div className={styles.grid}><div className={styles.panel}><h3>Due and overdue follow-ups</h3>
        {due.length ? due.slice(0, 8).map(task => <Link className={styles.item} key={task.id} href={`/crm/opportunities/${task.opportunity!.id}`}>
          <strong>{task.title}</strong><span>{task.opportunity!.title} · {task.opportunity!.crm_organisations?.name}</span>
          <small>{crmDueStatus(task.due_at)} · {task.due_at ? new Date(task.due_at).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "No date"} · Task assignee: {owner(task.assignee_person_id)}{task.assignee_person_id === personId ? " · Mine" : ""}</small>
        </Link>) : <p>No due Opportunity follow-ups in this bounded view.</p>}
      </div><div className={styles.panel}><h3>Decisions in the next seven days</h3>
        {data.decisions.length ? data.decisions.slice(0, 8).map(item => <Link className={styles.item} key={item.id} href={`/crm/opportunities/${item.id}`}>
          <strong>{item.title}</strong><span>{item.crm_organisations?.name} · {label(item.stage)}</span>
          <small>Expected {item.expected_decision_date} · Opportunity owner: {owner(item.owner_person_id ?? "")}</small>
        </Link>) : <p>No approaching decisions in this bounded view.</p>}
      </div></div>
      <div className={styles.panel}><h3>No future follow-up in recent open Opportunities</h3>
        <p>Sampled from the 50 most recently updated open Opportunities. The overview count above covers the full authorised source.</p>
        <div className={styles.compact}>{data.noFutureSample.map(item => <Link key={item.id} href={`/crm/opportunities/${item.id}`}>
          <strong>{item.title}</strong><span>{item.crm_organisations?.name} · {label(item.stage)}</span></Link>)}</div>
        {!data.noFutureSample.length && <p>None in this recent sample.</p>}
      </div>
      <div className={styles.panel}><h3>Won → operational handoff</h3>
        <p>Recent Won Opportunities. Open the factual handoff to see whether Mobilisation was separately authorised.</p>
        <div className={styles.compact}>{won.map(item => <Link key={item.id} href={`/commercial-handoff?organisation=${item.organisation_id}&opportunity=${item.id}`}>
          <strong>{item.title}</strong><span>{item.crm_organisations?.name} · Review handoff →</span></Link>)}</div>
        {!won.length && <p>No recent Won Opportunities displayed.</p>}
      </div>
    </>}
  </section>;
}
