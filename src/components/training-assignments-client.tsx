"use client";
import { useState } from "react";
import type { TrainingAssignment } from "@/lib/training/learning-types";

type Choice = { staff: { personId: string; displayName: string }[]; courses: { courseId: string; versionId: string; versionNumber: number; title: string }[] };
type Grant = { id: string; personId: string; displayName: string; effectiveFrom: string; effectiveUntil: string | null; revokedAt: string | null; grantReason: string; revokeReason: string | null };
const detail = (action: string, d: Record<string, unknown>) => {
  if (action === "ASSIGNED") return `Assigned exact version ${String(d.courseVersionId ?? "").slice(0, 8)} · due ${d.dueOn ?? ""}${d.replacesAssignmentId ? " · replaces earlier assignment" : ""} · ${d.reason ?? ""}`;
  if (action === "DUE_CHANGED") return `Due date changed ${d.oldDueOn} → ${d.newDueOn} · ${d.reason ?? ""}`;
  if (action === "COURSE_PUBLISHED") return `New course version published · ${d.note ?? "Assignment unchanged"}`;
  if (action === "SUPERSEDED") return `Explicitly superseded with a new exact-version assignment · ${d.reason ?? ""}`;
  if (action === "CANCELLED") return `Cancelled · ${d.reason ?? ""}`;
  return action;
};

export function TrainingAssignmentsClient({ initial, choices, grants: initialGrants, candidates, rights }: { initial: TrainingAssignment[]; choices: Choice | null; grants: Grant[]; candidates: { personId: string; displayName: string }[]; rights: { assigner: boolean; superAdmin: boolean } }) {
  const [assignments, setAssignments] = useState(initial);
  const [grants, setGrants] = useState(initialGrants);
  const [staff, setStaff] = useState(choices?.staff[0]?.personId ?? "");
  const [course, setCourse] = useState(choices?.courses[0]?.courseId ?? "");
  const [due, setDue] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: string; action: string; details: Record<string, unknown>; occurredAt: string }[]>([]);
  const [grantPerson, setGrantPerson] = useState(candidates[0]?.personId ?? "");
  const [grantFrom, setGrantFrom] = useState(() => new Date().toISOString().slice(0, 16));
  const [grantUntil, setGrantUntil] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const current = choices?.courses.find(c => c.courseId === course);
  async function refresh() {
    const response = await fetch("/api/training-learning?view=admin", { cache: "no-store" });
    if (response.ok) setAssignments((await response.json()).data);
    if (rights.superAdmin) { const grantsResponse = await fetch("/api/training-learning?view=grants", { cache: "no-store" }); if (grantsResponse.ok) setGrants((await grantsResponse.json()).data); }
    if (selected) openHistory(selected);
  }
  async function openHistory(id: string) {
    setSelected(id);
    const response = await fetch(`/api/training-learning?view=history&id=${id}`, { cache: "no-store" });
    setHistory(response.ok ? (await response.json()).data : []);
  }
  async function act(payload: Record<string, unknown>) {
    setBusy(true); setMessage("");
    const response = await fetch("/api/training-learning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    setMessage(response.ok ? "Action recorded." : "Action denied or stale. Refresh the assignments and check authority, version and revision.");
    if (response.ok) { setReason(""); await refresh(); }
  }
  const chosen = assignments.find(a => a.id === selected);
  return <div className="training-assignment-admin">
    {rights.assigner && choices && <section className="training-admin-edit"><h2>Assign current version</h2><p>Manual assignment to one active Security Staff Person.</p>
      <label>Staff Person<select value={staff} onChange={e => setStaff(e.target.value)}>{choices.staff.map(s => <option key={s.personId} value={s.personId}>{s.displayName}</option>)}</select></label>
      <label>Course and current version<select value={course} onChange={e => setCourse(e.target.value)}>{choices.courses.map(c => <option key={c.courseId} value={c.courseId}>{c.title} · v{c.versionNumber}</option>)}</select></label>
      <label>Due date · Europe/London calendar<input type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
      <label>Assignment reason<textarea value={reason} maxLength={300} onChange={e => setReason(e.target.value)} /></label>
      <button disabled={busy || !staff || !current || !due || reason.trim().length < 10} onClick={() => act({ action: "ASSIGN", personId: staff, courseId: current?.courseId, versionId: current?.versionId, dueOn: due, reason, requestId: crypto.randomUUID() })}>Assign exact version</button>
    </section>}
    <section className="training-admin-list"><h2>Assignments</h2>{assignments.length ? assignments.map(a => <button className={selected === a.id ? "selected" : ""} key={a.id} onClick={() => openHistory(a.id)}>
      <strong>{a.displayName}</strong> · {a.title} · v{a.versionNumber}<br />{a.state} · Due {a.dueOn} · {a.viewedCount}/{a.pageCount} pages viewed{a.retired && a.state === "ACTIVE" ? <><br />Content retired — assignment needs review</> : null}
    </button>) : <p>No assignments yet.</p>}</section>
    {chosen && <section className="training-admin-edit"><h2>Assignment detail</h2><p>{chosen.displayName} · {chosen.title} · exact version {chosen.versionNumber}</p>
      <p>Assigned {new Date(chosen.assignedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} · Due {chosen.dueOn} · Revision {chosen.revision}</p>
      <p>{chosen.viewedCount} of {chosen.pageCount} pages marked viewed · {chosen.state}</p>
      {chosen.retired && chosen.state === "ACTIVE" && <p role="status">Content retired — assignment needs review.</p>}
      {rights.assigner && chosen.state === "ACTIVE" && <><label>New due date · Europe/London<input type="date" value={due} onChange={e => setDue(e.target.value)} /></label><label>Reason for change<textarea value={reason} maxLength={300} onChange={e => setReason(e.target.value)} /></label>
        <div className="training-editor-actions"><button disabled={busy || !due || reason.trim().length < 10} onClick={() => act({ action: "DUE_CHANGE", assignmentId: chosen.id, revision: chosen.revision, dueOn: due, reason, requestId: crypto.randomUUID() })}>Change due date</button>
        <button disabled={busy || reason.trim().length < 10} onClick={() => act({ action: "CANCEL", assignmentId: chosen.id, revision: chosen.revision, reason, requestId: crypto.randomUUID() })}>Cancel assignment</button>
        {choices?.courses.find(c => c.courseId === chosen.courseId && c.versionId !== chosen.versionId) && <button disabled={busy || !due || reason.trim().length < 10} onClick={() => { const v = choices.courses.find(c => c.courseId === chosen.courseId); if (v) act({ action: "SUPERSEDE", assignmentId: chosen.id, revision: chosen.revision, versionId: v.versionId, dueOn: due, reason, requestId: crypto.randomUUID() }); }}>Supersede with current version</button>}</div></>}
      <h3>Immutable action history</h3><ol>{history.map(e => <li key={e.id}>{new Date(e.occurredAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} · {detail(e.action, e.details)}</li>)}</ol>
    </section>}
    {rights.superAdmin && <section className="training-grants"><h2>Assigner grants</h2><p>Super Admin oversight. Assignment actions still require a separate active grant.</p>
      <label>Office Admin Person<select value={grantPerson} onChange={e => setGrantPerson(e.target.value)}>{candidates.map(person => <option key={person.personId} value={person.personId}>{person.displayName}</option>)}</select></label>
      <label>Effective from<input type="datetime-local" value={grantFrom} onChange={e => setGrantFrom(e.target.value)} /></label>
      <label>Effective until · optional<input type="datetime-local" value={grantUntil} onChange={e => setGrantUntil(e.target.value)} /></label>
      <label>Grant or revocation reason<textarea value={reason} maxLength={300} onChange={e => setReason(e.target.value)} /></label>
      <button disabled={busy || !grantPerson || reason.trim().length < 10} onClick={() => act({ action: "GRANT", personId: grantPerson, from: new Date(grantFrom).toISOString(), until: grantUntil ? new Date(grantUntil).toISOString() : null, reason })}>Grant TRAINING_ASSIGNER</button>
      <ul>{grants.map(g => <li key={g.id}>{g.displayName} · {g.revokedAt ? "Revoked" : "Open grant"} · from {new Date(g.effectiveFrom).toLocaleString("en-GB", { timeZone: "Europe/London" })} · {g.grantReason}{!g.revokedAt && <button disabled={busy || reason.trim().length < 10} onClick={() => act({ action: "REVOKE", grantId: g.id, reason })}>Revoke</button>}</li>)}</ul>
    </section>}
    <p role="status">{message}</p>
  </div>;
}
