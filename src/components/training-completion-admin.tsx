"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Assignment = { id: string; personName: string; courseTitle: string; courseVersion: number;
  state: string; ruleVersionId: string | null; completionId: string | null; completedAt: string | null; voidedAt: string | null };
type RuleChoice = { courseVersionId: string; courseTitle: string; courseVersion: number; assessmentVersionId: string; assessmentVersion: number };
type AdminData = { assignments: Assignment[]; rules: { id: string; courseVersionId: string; version: number }[] };

export function TrainingCompletionAdmin({ rights, initial, choices, grants }: {
  rights: { manager: boolean; publisher: boolean; superAdmin: boolean }; initial: unknown; choices: RuleChoice[]; grants: unknown;
}) {
  const router = useRouter();
  const data = initial && typeof initial === "object" ? initial as AdminData : { assignments: [], rules: [] };
  const assignments = Array.isArray(data.assignments) ? data.assignments : [];
  const [choice, setChoice] = useState(choices[0]?.assessmentVersionId ?? "");
  const grantData = grants && typeof grants === "object" ? grants as {
    grants: { id: string; personName: string; revokedAt: string | null }[];
    candidates: { personId: string; personName: string }[];
  } : { grants: [], candidates: [] };
  const [candidate, setCandidate] = useState(grantData.candidates?.[0]?.personId ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function act(payload: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/training-completions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("Action denied or unavailable. Refresh and check the exact record and authority.");
      const value = await response.json();
      setMessage(value.data?.status === "UNMET" ? `Requirements unmet: ${(value.data.unmet as string[]).map(x => x.startsWith("PASSED_ATTEMPT_REQUIRED:") ? "passed assessment" : "page marks").join(", ")}.` : "Action recorded.");
      router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Action unavailable."); }
    finally { setBusy(false); }
  }
  const selected = choices.find(item => item.assessmentVersionId === choice);
  return <div className="training-completion-admin">
    {rights.publisher && <section className="training-card"><h2>Publish a completion rule</h2>
      <p>The first rule pins all page marks and one exact published AssessmentVersion. Publication creates an immutable rule version.</p>
      <label htmlFor="completion-rule-source">Course and assessment version</label>
      <select id="completion-rule-source" value={choice} onChange={event => setChoice(event.target.value)}>{choices.map(item =>
        <option key={item.assessmentVersionId} value={item.assessmentVersionId}>{item.courseTitle} · Course v{item.courseVersion} · Assessment v{item.assessmentVersion}</option>)}</select>
      <button type="button" disabled={busy || !selected} onClick={() => selected && act({ action: "PUBLISH_RULE", courseVersionId: selected.courseVersionId,
        assessmentVersionId: selected.assessmentVersionId, effectiveFrom: new Date(Date.now() - 60_000).toISOString(), effectiveUntil: null, validityMonths: null })}>Publish rule with no expiry</button>
    </section>}
    {rights.manager && <section><h2>Assignment completion checks</h2><p>Review the exact assignment and recorded rule before a check or correction.</p>
      <div className="training-cards">{assignments.map(item => <article className="training-card" key={item.id}>
        <small>{item.state} · Course v{item.courseVersion}</small><h3>{item.personName} · {item.courseTitle}</h3>
        <p>Rule: {item.ruleVersionId ?? "Not pinned"} · Completion: {item.completionId ?? "None"}</p>
        {item.voidedAt && <p>Completion voided</p>}
        {item.state === "ACTIVE" && !item.completionId && <button type="button" disabled={busy} onClick={() => act({ action: "EVALUATE", assignmentId: item.id, requestId: crypto.randomUUID() })}>Request completion check</button>}
        {item.completionId && !item.voidedAt && <button type="button" disabled={busy || reason.trim().length < 10} onClick={() => act({ action: "VOID", completionId: item.completionId, reason, requestId: crypto.randomUUID() })}>Void completion with reason</button>}
      </article>)}</div>
      <label htmlFor="completion-correction-reason">Controlled correction reason</label><textarea id="completion-correction-reason" minLength={10} maxLength={300} value={reason} onChange={event => setReason(event.target.value)} />
    </section>}
    {rights.superAdmin && <section className="training-card"><h2>Completion manager grants</h2>
      <p>Super Admin can administer a named Office grant. Super Admin role alone cannot evaluate or issue.</p>
      <label htmlFor="completion-manager-candidate">Active Office Admin</label>
      <select id="completion-manager-candidate" value={candidate} onChange={event => setCandidate(event.target.value)}>
        {grantData.candidates?.map(item => <option key={item.personId} value={item.personId}>{item.personName}</option>)}</select>
      <label htmlFor="completion-manager-reason">Grant or revoke reason</label>
      <textarea id="completion-manager-reason" minLength={10} maxLength={300} value={reason} onChange={event => setReason(event.target.value)} />
      <button type="button" disabled={busy || !candidate || reason.trim().length < 10} onClick={() => act({ action: "GRANT", personId: candidate, reason })}>Grant Completion Manager</button>
      <ul>{grantData.grants?.map(item => <li key={item.id}>{item.personName} · {item.revokedAt ? "Revoked" : "Active"}
        {!item.revokedAt && <button type="button" disabled={busy || reason.trim().length < 10} onClick={() => act({ action: "REVOKE_GRANT", grantId: item.id, reason })}>Revoke grant</button>}</li>)}</ul>
    </section>}
    <p role="status">{message}</p>
  </div>;
}
