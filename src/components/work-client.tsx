"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, FeedbackBanner, LoadingBlock } from "@/components/ui/workflow";
import styles from "./work-filters.module.css";
import { crmDueStatus } from "@/lib/crm/due-status";

type WorkTask = {
  id: string; title: string; state: "OPEN" | "DONE" | "CANCELLED"; covering: boolean;
  createdAt: string; completedAt: string | null;
  sourceKind: "DOCUMENT_VERSION" | "CRM_OPPORTUNITY" | "CRM_ORGANISATION" | "TFS_LP_ISSUE"; sourceId: string;
  sourceTitle?: string; dueAt: string | null; versionNumber?: number;
  requestTitle?: string; subjectName?: string | null;
  sourceStatus?: string; nextAction?: string; sourceHref?: string;
  priority?: "Urgent" | "High" | "Review" | "Monitor";
};
type WorkSource = "ALL" | "DOCUMENTS" | "CRM" | "TFS";
type WorkStatus = "ALL" | "OPEN" | "COVERING" | "DONE" | "CANCELLED";

// Filter only the server-authorised projection, using titles and displayed source labels.
export function filterWorkTasks(tasks: WorkTask[], source: WorkSource, status: WorkStatus, search: string) {
  const query = search.trim().toLocaleLowerCase("en-GB");
  return tasks.filter((task) => {
    const kind = task.sourceKind === "DOCUMENT_VERSION" ? "DOCUMENTS" :
      task.sourceKind === "TFS_LP_ISSUE" ? "TFS" : "CRM";
    const taskStatus = task.state === "OPEN" && task.covering ? "COVERING" : task.state;
    const labels = kind === "DOCUMENTS" ? [task.subjectName ?? "Authorised personnel evidence", task.requestTitle] :
      kind === "CRM" ? ["CRM", task.sourceTitle ?? "Commercial follow-up"] : ["TFS"];
    return (source === "ALL" || source === kind) && (status === "ALL" || status === taskStatus) &&
      [task.title, ...labels].filter(Boolean).join(" ").toLocaleLowerCase("en-GB").includes(query);
  });
}

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

const priorityRank: Record<NonNullable<WorkTask["priority"]>, number> = {
  Urgent: 0, High: 1, Review: 2, Monitor: 3,
};

function tfsRank(task: WorkTask) {
  // A requested visit needs attention before other urgent evidence reviews.
  const priority = priorityRank[task.priority ?? "Review"];
  return task.sourceStatus === "Visit needed" ? priority - 10 : priority;
}

function TfsWorkGroup({ tasks, kind }: { tasks: WorkTask[]; kind: "actions" | "links" }) {
  const ordered = [...tasks].sort((a, b) => tfsRank(a) - tfsRank(b) || b.createdAt.localeCompare(a.createdAt));
  const headingId = kind === "actions" ? "tfs-actions-heading" : "tfs-links-heading";
  return <section className="work-group" aria-labelledby={headingId}>
    <div className="work-group-heading"><h3 id={headingId}>{kind === "actions" ? "TFS actions" : "TFS to review"}</h3><span>{tasks.length}</span></div>
    <ul className="work-group-list">{ordered.map((task) => <li key={task.id}>
      <Link href={task.sourceHref ?? "/tfs"} className="work-group-link">
        <span className="work-group-title">{task.title}</span>
        <span className="work-group-meta"><strong>{task.sourceStatus === "Visit needed" ? "Visit needed" : task.priority}</strong>{task.sourceStatus !== "Visit needed" ? ` · ${task.sourceStatus}` : ""}</span>
        {kind === "actions" && task.nextAction && <span className="work-group-next">{task.nextAction}</span>}
      </Link>
    </li>)}</ul>
  </section>;
}

export function WorkClient() {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [source, setSource] = useState<WorkSource>("ALL");
  const [status, setStatus] = useState<WorkStatus>("ALL");
  const [search, setSearch] = useState("");
  const filtered = source !== "ALL" || status !== "ALL" || search.length > 0;
  const clearFilters = () => { setSource("ALL"); setStatus("ALL"); setSearch(""); };
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
  const visibleTasks = filterWorkTasks(tasks, source, status, search);
  const open = visibleTasks.filter((task) => task.state === "OPEN" && !task.covering);
  const tfsOpen = open.filter((task) => task.sourceKind === "TFS_LP_ISSUE");
  const tfsActions = tfsOpen.filter((task) => task.sourceStatus === "Visit needed" || task.sourceStatus === "Investigating");
  const tfsLinks = tfsOpen.filter((task) => task.sourceStatus !== "Visit needed" && task.sourceStatus !== "Investigating");
  const otherOpen = open.filter((task) => task.sourceKind !== "TFS_LP_ISSUE");
  const covering = visibleTasks.filter((task) => task.state === "OPEN" && task.covering);
  const done = visibleTasks.filter((task) => task.state === "DONE");
  const cancelled = visibleTasks.filter((task) => task.state === "CANCELLED");
  return <main className="enterprise-main work-main">
    <header className="ui-page-header"><h1>My Work</h1></header>
    {error && <FeedbackBanner tone="error">Work is unavailable. Refresh to try again.</FeedbackBanner>}
    {loading ? <LoadingBlock label="Loading your work…" /> : !error && <>
      <div className={styles.filters} role="search" aria-label="Filter My Work">
        <label className={styles.search}>Search work
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Titles and source labels" />
        </label>
        <div className={styles.field}><label htmlFor="work-source">Source</label>
          <select id="work-source" value={source} onChange={(event) => setSource(event.target.value as WorkSource)}>
            <option value="ALL">All sources</option><option value="DOCUMENTS">Documents</option><option value="CRM">CRM</option><option value="TFS">TFS</option>
          </select>
        </div>
        <div className={styles.field}><label htmlFor="work-status">Status</label>
          <select id="work-status" value={status} onChange={(event) => setStatus(event.target.value as WorkStatus)}>
            <option value="ALL">All statuses</option><option value="OPEN">Open</option><option value="COVERING">Covering</option><option value="DONE">Done</option><option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <button type="button" className="ui-action ui-action--secondary" onClick={clearFilters} disabled={!filtered}>Clear filters</button>
      </div>
      <p className={styles.summary} role="status">Showing {visibleTasks.length} of {tasks.length} returned tasks. Filters apply to work available to this account.</p>
      {filtered && !visibleTasks.length ? <EmptyState title="No matching work" description="Try a different source, status or search, or clear filters." /> : <div className="work-sections">
      {(!filtered || open.length > 0) && <section aria-labelledby="open-work-heading"><h2 id="open-work-heading">Open work</h2>
        {open.length ? <div className="work-open-groups">
          {tfsActions.length > 0 && <TfsWorkGroup tasks={tfsActions} kind="actions" />}
          {otherOpen.length > 0 && <ul className="work-list">{otherOpen.map((task) => <TaskCard key={task.id} task={task} />)}</ul>}
          {tfsLinks.length > 0 && <TfsWorkGroup tasks={tfsLinks} kind="links" />}
        </div> : <EmptyState title="No open tasks" description="No open tasks were returned for this account." />}
      </section>}
      {covering.length > 0 && <section aria-labelledby="covering-work-heading"><h2 id="covering-work-heading">Covering</h2>
        <ul className="work-list">{covering.map((task) => <TaskCard key={task.id} task={task} />)}</ul>
      </section>}
      {(!filtered || done.length > 0) && <section aria-labelledby="done-work-heading"><h2 id="done-work-heading">Completed history</h2>
        {done.length ? <ul className="work-list">{done.map((task) => <TaskCard key={task.id} task={task} />)}</ul> :
          <EmptyState title="No completed tasks" description="Completed document reviews and CRM follow-ups will appear here when available." />}
      </section>}
      {cancelled.length > 0 && <section aria-labelledby="cancelled-work-heading"><h2 id="cancelled-work-heading">Cancelled history</h2>
        <ul className="work-list">{cancelled.map((task) => <TaskCard key={task.id} task={task} />)}</ul>
      </section>}
    </div>}
    </>}
  </main>;
}
