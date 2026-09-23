"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, FeedbackBanner, PageHeader } from "@/components/ui/workflow";

type WorkTask = {
  id: string; title: string; state: "OPEN" | "DONE"; createdAt: string; completedAt: string | null;
  sourceKind: "DOCUMENT_VERSION"; sourceId: string; versionNumber: number;
  requestTitle: string; subjectName: string | null;
};
const date = (value: string) => new Date(value).toLocaleDateString("en-GB", {
  day: "numeric", month: "short", year: "numeric",
});

function TaskCard({ task }: { task: WorkTask }) {
  return <li className="work-card">
    <div className="work-card-heading"><strong>{task.title}</strong>
      <span className={`ui-status ui-status--${task.state.toLowerCase()}`}>{task.state === "OPEN" ? "Open" : "Done"}</span></div>
    <p>{task.subjectName ?? "Authorised personnel evidence"} · {task.requestTitle}</p>
    <p>Document Version {task.versionNumber} · Created {date(task.createdAt)}
      {task.completedAt ? ` · Completed ${date(task.completedAt)}` : ""}</p>
    <Link className="ui-action ui-action--secondary" href={`/work/${task.id}`}>
      {task.state === "OPEN" ? `Open Version ${task.versionNumber} review` : `View Version ${task.versionNumber} history`}
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
  const open = tasks.filter((task) => task.state === "OPEN");
  const done = tasks.filter((task) => task.state === "DONE");
  return <main className="enterprise-main work-main">
    <PageHeader eyebrow="Synthetic development work" title="My Work"
      description="Your document review work appears here. Decisions are made on the document record." />
    {error && <FeedbackBanner tone="error">Work is unavailable. Refresh to try again.</FeedbackBanner>}
    {loading ? <p role="status">Loading your work…</p> : !error && <div className="work-sections">
      <section aria-labelledby="open-work-heading"><h2 id="open-work-heading">Open work</h2>
        {open.length ? <ul className="work-list">{open.map((task) => <TaskCard key={task.id} task={task} />)}</ul> :
          <EmptyState title="No open tasks" description="There is no assigned document review work right now." />}
      </section>
      <section aria-labelledby="done-work-heading"><h2 id="done-work-heading">Completed history</h2>
        {done.length ? <ul className="work-list">{done.map((task) => <TaskCard key={task.id} task={task} />)}</ul> :
          <EmptyState title="No completed tasks" description="Resolved document review work will appear here." />}
      </section>
    </div>}
  </main>;
}
