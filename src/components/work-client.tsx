"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, FeedbackBanner, LoadingBlock, PageHeader } from "@/components/ui/workflow";
import { crmDueStatus } from "@/lib/crm/due-status";

type WorkTask = {
  id: string; title: string; state: "OPEN" | "DONE" | "CANCELLED"; covering: boolean;
  createdAt: string; completedAt: string | null;
  sourceKind: "DOCUMENT_VERSION" | "CRM_OPPORTUNITY" | "CRM_ORGANISATION" | "TFS_LP_ISSUE"; sourceId: string;
  sourceTitle?: string; dueAt: string | null; versionNumber?: number;
  requestTitle?: string; subjectName?: string | null;
  sourceStatus?: string; nextAction?: string; sourceHref?: string;
};
const date = (value: string) => new Date(value).toLocaleDateString("en-GB", {
  day: "numeric", month: "short", year: "numeric",
});

function TaskCard({ task }: { task: WorkTask }) {
  const tfs = task.sourceKind === "TFS_LP_ISSUE";
  const crm = task.sourceKind === "CRM_OPPORTUNITY" || task.sourceKind === "CRM_ORGANISATION";
  return <li className="work-card">
    <div className="work-card-heading"><strong>{task.title}</strong>
      <span className={`ui-status ui-status--${task.state.toLowerCase()}`}>{task.state === "OPEN" ? task.covering ? "Covering" : "Open" : task.state === "DONE" ? "Done" : "Cancelled"}</span></div>
    <p>{tfs ? `TFS Loss Prevention · ${task.sourceTitle} · ${task.sourceStatus}` : crm ? `CRM · ${task.sourceTitle ?? "Commercial follow-up"}` : `${task.subjectName ?? "Authorised personnel evidence"} · ${task.requestTitle}`}</p>
    {tfs && <p><strong>Next:</strong> {task.nextAction}</p>}
    <p>{tfs ? "Assigned issue" : crm ? task.dueAt ? `${task.state === "OPEN" ? crmDueStatus(task.dueAt) : "Historical"} · ${new Date(task.dueAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}` : "No due date" : `Document Version ${task.versionNumber}`} · Created {date(task.createdAt)}
      {task.completedAt ? ` · Completed ${date(task.completedAt)}` : ""}</p>
    <Link className="ui-action ui-action--secondary" href={tfs ? task.sourceHref ?? "/tfs" : `/work/${task.id}`}>
      {tfs ? "Open TFS issue" : crm ? "Open CRM source" : task.state === "OPEN" ? `Open Version ${task.versionNumber} review` : `View Version ${task.versionNumber} history`}
    </Link>
  </li>;
}

export function WorkClient() {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/tasks", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("work unavailable");
      const body = await response.json();
      if (active) setTasks(body.tasks ?? []);
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const open = tasks.filter((task) => task.state === "OPEN" && !task.covering);
  const covering = tasks.filter((task) => task.state === "OPEN" && task.covering);
  const done = tasks.filter((task) => task.state === "DONE");
  const cancelled = tasks.filter((task) => task.state === "CANCELLED");
  return <main className="enterprise-main work-main">
    <PageHeader eyebrow="Assigned work" title="My Work"
      description="Assigned TFS issues, document reviews and CRM follow-ups. Open each item in its source workspace." />
    {error && <FeedbackBanner tone="error">Work is unavailable. Refresh to try again.</FeedbackBanner>}
    {loading ? <LoadingBlock label="Loading your work…" /> : !error && <div className="work-sections">
      <section aria-labelledby="open-work-heading"><h2 id="open-work-heading">Open work</h2>
        {open.length ? <ul className="work-list">{open.map((task) => <TaskCard key={task.id} task={task} />)}</ul> :
          <EmptyState title="No open tasks" description="No assigned TFS issues, document reviews or CRM follow-ups were returned for this account." />}
      </section>
      {covering.length > 0 && <section aria-labelledby="covering-work-heading"><h2 id="covering-work-heading">Covering</h2>
        <ul className="work-list">{covering.map((task) => <TaskCard key={task.id} task={task} />)}</ul>
      </section>}
      <section aria-labelledby="done-work-heading"><h2 id="done-work-heading">Completed history</h2>
        {done.length ? <ul className="work-list">{done.map((task) => <TaskCard key={task.id} task={task} />)}</ul> :
          <EmptyState title="No completed tasks" description="Completed document reviews and CRM follow-ups will appear here when available." />}
      </section>
      {cancelled.length > 0 && <section aria-labelledby="cancelled-work-heading"><h2 id="cancelled-work-heading">Cancelled history</h2>
        <ul className="work-list">{cancelled.map((task) => <TaskCard key={task.id} task={task} />)}</ul>
      </section>}
    </div>}
  </main>;
}
