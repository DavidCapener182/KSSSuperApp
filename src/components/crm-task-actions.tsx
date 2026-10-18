"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { londonDueToIso } from "@/lib/crm/due-time";
import { confirmsCrmAction, crmTaskDueInput, crmTaskDueLabel, readCrmActionTask, sameCrmDue, sameReviewedCrmTask,
  type CrmActionTask } from "@/lib/tasks/crm-action-readback";
import styles from "./crm-task-actions.module.css";

type Action = "COMPLETE" | "RESCHEDULE";
export function CrmTaskActions({ initialTask }: { initialTask: CrmActionTask }) {
  const [task, setTask] = useState<CrmActionTask | null>(initialTask);
  const [phase, setPhase] = useState<"ready" | "loading" | "unavailable">("ready");
  const [action, setAction] = useState<Action | null>(null);
  const [dueLocal, setDueLocal] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false), mounted = useRef(true);
  const feedback = useRef<HTMLParagraphElement>(null);
  const dialog = useRef<HTMLDialogElement>(null), cancelButton = useRef<HTMLButtonElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null), priorFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (message) feedback.current?.focus(); }, [message]);
  useEffect(() => {
    const element = dialog.current;
    if (action && element && !element.open) {
      priorFocus.current = document.activeElement as HTMLElement | null;
      element.showModal(); cancelButton.current?.focus();
    } else if (!action && element?.open) {
      element.close();
      if (priorFocus.current?.isConnected) priorFocus.current.focus();
      else (feedback.current ?? refreshButton.current)?.focus();
    }
  }, [action]);
  const intendedDue = londonDueToIso(dueLocal);
  const reasonValid = reason.trim().length >= 3 && reason.length <= 300 && !/[\x00-\x1f\x7f]/.test(reason);
  const valid = action === "COMPLETE" || (action === "RESCHEDULE" && intendedDue !== undefined && reasonValid &&
    task !== null && !sameCrmDue(task.dueAt, intendedDue));

  async function readExact() {
    const response = await fetch(`/api/tasks/${initialTask.id}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Follow-up unavailable");
    const body = await response.json(), value = readCrmActionTask(body.task, initialTask);
    if (!value) throw new Error("Follow-up unavailable");
    return value;
  }
  function unavailable(text: string) {
    setTask(null); setPhase("unavailable"); setAction(null); setMessage(""); setError(text);
  }
  async function refresh() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setTask(null); setPhase("loading"); setAction(null); setError(""); setMessage("");
    try { const value = await readExact(); if (mounted.current) { setTask(value); setPhase("ready"); setMessage("Current follow-up loaded."); } }
    catch { if (mounted.current) unavailable("This follow-up is unavailable. Refresh to check current access."); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  function review(kind: Action) {
    if (pending.current || !task || task.state !== "OPEN") return;
    setAction(kind); setDueLocal(crmTaskDueInput(task.dueAt)); setReason(""); setError(""); setMessage("");
  }
  async function confirm() {
    if (pending.current || !valid || !action || !task || task.state !== "OPEN" || phase !== "ready") return;
    const reviewed = task, kind = action, due = intendedDue ?? null;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    let writeStarted = false;
    try {
      const fresh = await readExact();
      if (!mounted.current) return;
      if (!sameReviewedCrmTask(reviewed, fresh)) {
        setTask(fresh); setAction(null); setError("This follow-up changed. Review the current details before choosing an action."); return;
      }
      writeStarted = true;
      const response = await fetch("/api/crm/work", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "changeTask", id: reviewed.id, kind,
          ...(kind === "RESCHEDULE" ? { dueLocal: dueLocal || null, reason: reason.trim() } : {}) }) });
      if (!mounted.current) return;
      if (!response.ok) {
        unavailable(response.status >= 500 ? "Update not confirmed. Refresh this follow-up to check its current state." :
          "The action was not accepted. Refresh this follow-up before choosing another action."); return;
      }
      const receipt = await response.json();
      const after = await readExact();
      if (!mounted.current) return;
      if (receipt.id !== reviewed.id || !confirmsCrmAction(reviewed, after, kind, due)) {
        unavailable("Update not confirmed. Refresh this follow-up to check its current state."); return;
      }
      setTask(after); setAction(null); setPhase("ready");
      setMessage(kind === "COMPLETE" ? "Follow-up is Done. Current state verified." : "Follow-up deadline updated. Current deadline verified.");
    } catch {
      if (mounted.current) unavailable(writeStarted ? "Update not confirmed. Refresh this follow-up to check its current state." :
        "This follow-up is unavailable. Refresh to check current access.");
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }

  return <main className={`enterprise-main ${styles.page}`}>
    <header><p className="eyebrow">My Work · CRM</p><h1>CRM follow-up</h1><Link href="/work">Back to My Work</Link></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.message} role="status" ref={feedback} tabIndex={-1}>{message}</p>}
    {phase === "loading" && <p role="status">Loading current follow-up…</p>}
    {task && phase === "ready" && <section className={styles.card} aria-labelledby="task-heading">
      <div className={styles.identity}><p className="enterprise-eyebrow">Source-owned follow-up</p><h2 id="task-heading">{task.title}</h2><p>{task.sourceTitle}</p>
      <dl className={styles.facts}><div><dt>Status</dt><dd>{task.state === "OPEN" ? "Open" : task.state === "DONE" ? "Done" : "Cancelled"}</dd></div><div><dt>{task.state === "OPEN" ? "Deadline" : "Historical deadline"}</dt><dd>{crmTaskDueLabel(task.dueAt)}</dd></div></dl>
      <Link href={task.sourceHref}>Open CRM source</Link></div>
      <section className={styles.actionPanel} aria-label="Supported follow-up actions"><h3>Next action</h3><p>Review this follow-up before confirming a change.</p>{task.state === "OPEN" ? <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={() => review("COMPLETE")}>Complete follow-up</button>
        <button type="button" disabled={busy} onClick={() => review("RESCHEDULE")}>Reschedule follow-up</button>
      </div> : <p>This follow-up is historical. No completion or reschedule action is available.</p>}</section>
    </section>}
    <button className={styles.refresh} ref={refreshButton} type="button" disabled={busy} onClick={() => void refresh()}>Refresh follow-up</button>
    <dialog ref={dialog} className={`ui-dialog ${styles.dialog}`} aria-labelledby="crm-action-title" aria-describedby="crm-action-description"
      onCancel={event => { event.preventDefault(); if (!pending.current) setAction(null); }}
      tabIndex={-1} onKeyDown={event => {
        if (event.key !== "Tab") return;
        const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href]"));
        const first = elements[0], last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); event.currentTarget.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <form onSubmit={event => { event.preventDefault(); void confirm(); }}>
      <h2 id="crm-action-title">{action === "COMPLETE" ? "Complete this follow-up?" : "Reschedule this follow-up?"}</h2>
      <p id="crm-action-description">Review the exact follow-up and source before confirming.</p>
      {task && action && <div className={styles.review}>
        <p><strong>{task.title}</strong></p><p>Source: {task.sourceTitle}</p><p>Current deadline: {crmTaskDueLabel(task.dueAt)}</p>
        {action === "COMPLETE" ? <p>This exact follow-up will be marked Done.</p> : <>
          <label>New deadline · Europe/London<input type="datetime-local" value={dueLocal} disabled={busy}
            onChange={event => setDueLocal(event.target.value)} aria-describedby="deadline-help" /></label>
          <p id="deadline-help">{intendedDue === undefined ? "Choose an unambiguous London time; missing or repeated DST times cannot be used." :
            intendedDue === null ? "The current deadline will be removed." : `Proposed deadline: ${crmTaskDueLabel(intendedDue)}`}</p>
          <label>Reason · 3 to 300 characters<input value={reason} maxLength={300} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
          {intendedDue !== undefined && sameCrmDue(task.dueAt, intendedDue) && <p>Choose a different deadline.</p>}
        </>}
      </div>}
      <div className="ui-dialog-actions">
        <button ref={cancelButton} type="button" className="ui-action ui-action--secondary" disabled={busy} onClick={() => { if (!pending.current) setAction(null); }}>Cancel</button>
        <button type="submit" className="ui-action ui-action--primary" disabled={busy || !valid}>{busy ? "Saving…" : action === "COMPLETE" ? "Confirm completion" : "Confirm reschedule"}</button>
      </div>
      </form>
    </dialog>
  </main>;
}
