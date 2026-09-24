"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Archive, Bell, Check, Clock3, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./action-centre.module.css";

type Section = "UNREAD" | "REQUIRES_ACTION" | "RECENT" | "DISMISSED";
type Counts = { unread: number; requires_action: number; recent: number; dismissed: number };
type Notification = {
  id: string; allocationId: string; createdAt: string; readAt: string | null; dismissedAt: string | null;
  allocationStatus: "ALLOCATED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  eventStatus: string; requirementState: string; eventName: string; siteName: string; roleName: string;
  serviceDate: string; reportAt: string; shiftStartsAt: string; shiftEndsAt: string;
  requiresAction: boolean; currentMessage: string;
};
type Payload = { section: Section; counts: Counts; total: number; items: Notification[] };

const sections: { id: Section; label: string; icon: typeof Bell; count: keyof Counts }[] = [
  { id: "UNREAD", label: "Unread", icon: Inbox, count: "unread" },
  { id: "REQUIRES_ACTION", label: "Requires action", icon: Check, count: "requires_action" },
  { id: "RECENT", label: "Recent", icon: Clock3, count: "recent" },
  { id: "DISMISSED", label: "Dismissed / history", icon: Archive, count: "dismissed" },
];
const dateTime = (value: string) => new Date(value).toLocaleString("en-GB", {
  timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});
const dateOnly = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
  timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long",
});

export function ActionCentreClient() {
  const [section, setSection] = useState<Section>("UNREAD");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (nextSection: Section, nextOffset = 0) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/action-centre?section=${nextSection}&offset=${nextOffset}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Action Centre is unavailable. Please retry.");
      const data = await response.json() as Payload;
      setPayload(data); setSection(nextSection); setOffset(nextOffset); setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action Centre is unavailable.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = setTimeout(() => void load("UNREAD", 0), 0); return () => clearTimeout(timer); }, [load]);

  async function changeState(item: Notification, action: "READ" | "DISMISS") {
    setBusyId(item.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/action-centre/${item.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error("Notification state was not saved. Please retry.");
      setNotice(action === "READ" ? "Marked as read." : "Moved to dismissed history.");
      await load(section, offset);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Notification state was not saved."); }
    finally { setBusyId(""); }
  }

  const counts = payload?.counts ?? null;
  const lower = offset + 1;
  return <main className={`enterprise-main ${styles.page}`}>
    <header className={styles.heading}>
      <div><p className="enterprise-eyebrow">Your operational updates</p><h1>Action Centre</h1>
        <p className={styles.intro}>Notifications are informational. Respond to an allocation in My Deployments.</p></div>
      <span className={styles.unreadBadge} aria-label={counts ? `${counts.unread} unread notifications` : "Unread count unavailable"}><Bell size={16} aria-hidden="true" />{counts?.unread ?? "—"} unread</span>
    </header>
    {notice && <p className="enterprise-honesty" role="status">{notice}</p>}
    {error && <p className="enterprise-error" role="alert">{error} <Button variant="outline" onClick={() => void load(section, offset)}>Retry</Button></p>}
    <nav className={styles.sections} aria-label="Action Centre sections">
      {sections.map(({ id, label, icon: Icon, count }) => <button key={id} type="button" aria-pressed={section === id}
        className={section === id ? styles.sectionActive : styles.section}
        onClick={() => { setNotice(""); void load(id, 0); }}>
        <Icon size={16} aria-hidden="true" /><span>{label}</span><span className={styles.sectionCount}>{counts?.[count] ?? "—"}</span>
      </button>)}
    </nav>
    <section aria-label={`${sections.find((item) => item.id === section)?.label ?? "Notifications"} notifications`}>
      {loading ? <p className={styles.empty} role="status">Loading notifications…</p>
        : !payload?.items.length ? <p className={styles.empty}>Nothing to show here.</p>
          : <div className={styles.list}>{payload.items.map((item) => <article className={styles.card} key={item.id}>
            <div className={styles.cardHeading}>
              <div className={styles.titleGroup}><span className={styles.source}>Deployment</span>
                <h2>{item.currentMessage === "Your response is required in My Deployments." ? "New deployment request" : "Deployment update"}</h2></div>
              <span className={styles.state}>{item.dismissedAt ? "Dismissed" : item.readAt ? "Read" : "Unread"}</span>
            </div>
            <p className={styles.message}>{item.currentMessage}</p>
            <dl className={styles.facts}>
              <div><dt>Event</dt><dd>{item.eventName}</dd></div><div><dt>Site</dt><dd>{item.siteName}</dd></div>
              <div><dt>Role</dt><dd>{item.roleName}</dd></div><div><dt>Service date</dt><dd>{dateOnly(item.serviceDate)}</dd></div>
              <div><dt>Report</dt><dd>{dateTime(item.reportAt)}</dd></div>
              <div><dt>Shift</dt><dd>{dateTime(item.shiftStartsAt)} – {dateTime(item.shiftEndsAt)}</dd></div>
            </dl>
            <div className={styles.footer}>
              <time dateTime={item.createdAt}>Received {dateTime(item.createdAt)}</time>
              <div className={styles.actions}>
                <Link className={styles.openLink} href={`/my-deployments?allocationId=${encodeURIComponent(item.allocationId)}`}>
                  Open in My Deployments <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
                {!item.readAt && <Button variant="outline" size="sm" disabled={busyId === item.id} onClick={() => void changeState(item, "READ")}>Mark read</Button>}
                {!item.dismissedAt && <Button variant="outline" size="sm" disabled={busyId === item.id} onClick={() => void changeState(item, "DISMISS")}>Dismiss</Button>}
              </div>
            </div>
          </article>)}</div>}
    </section>
    {!!payload && payload.total > 25 && <div className={styles.pagination}>
      <Button variant="outline" disabled={offset === 0 || loading} onClick={() => void load(section, Math.max(0, offset - 25))}>Previous</Button>
      <span>{lower}–{Math.min(offset + 25, payload.total)} of {payload.total}</span>
      <Button variant="outline" disabled={offset + 25 >= payload.total || loading} onClick={() => void load(section, offset + 25)}>Next</Button>
    </div>}
  </main>;
}
