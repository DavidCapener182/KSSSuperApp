"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrainingCertificateAdmin } from "@/components/training-certificate-admin";

type Assignment = { id: string; personName: string; courseTitle: string; courseVersion: number;
  state: string; ruleVersionId: string | null; completionId: string | null; completedAt: string | null; voidedAt: string | null };
type RuleChoice = { courseVersionId: string; courseTitle: string; courseVersion: number; assessmentVersionId: string; assessmentVersion: number };
type AdminData = { assignments: Assignment[]; rules: { id: string; courseVersionId: string; version: number }[] };
type Evidence = { assignment: { id: string; courseVersionId: string; contentHash: string; pageCount: number; viewedCount: number }; rule: null | { id: string; version: number; hash: string; requiredAssessmentVersionIds: string[]; validityMonths: number | null; pinned: boolean }; attempts: { id: string; assessmentVersionId: string; state: string; result: string | null }[]; completion: null | { id: string; ruleHash: string; passedAttemptIds: string[]; pageMarkCount: number; pageCount: number; voidedAt: string | null; voidedBy: string | null; voidReason: string | null }; events: { id: string; action: string; actorPersonId: string; reason: string | null; occurredAt: string }[] };

export function TrainingCompletionAdmin({ rights, initial, choices, grants, templates }: {
  rights: { manager: boolean; publisher: boolean; superAdmin: boolean }; initial: unknown; choices: RuleChoice[]; grants: unknown; templates: unknown;
}) {
  const router = useRouter();
  const data = initial && typeof initial === "object" ? initial as AdminData : { assignments: [], rules: [] };
  const assignments = Array.isArray(data.assignments) ? data.assignments : [];
  const [choice, setChoice] = useState(choices[0]?.assessmentVersionId ?? "");
  const grantData = grants && typeof grants === "object" ? grants as {
    grants: { id: string; personName: string; grantedBy?: string; grantedAt?: string; revokedBy?: string | null; revokedAt: string | null; events?: { action: string; actorPersonId: string; reason: string; occurredAt: string }[] }[];
    candidates: { personId: string; personName: string }[];
  } : { grants: [], candidates: [] };
  const [candidate, setCandidate] = useState(grantData.candidates?.[0]?.personId ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [reviewedAssignment, setReviewedAssignment] = useState<string | null>(null);
  async function review(id: string, preserveMessage = false) {
    setBusy(true); if (!preserveMessage) setMessage(""); setEvidence(null); setReviewedAssignment(null);
    try {
      const response = await fetch(`/api/training-completions?view=history&id=${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error("Evidence unavailable for this assignment.");
      const value = await response.json();
      setEvidence(value.data as Evidence); setReviewedAssignment(id);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Evidence unavailable."); }
    finally { setBusy(false); }
  }
  async function act(payload: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/training-completions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("Action denied or unavailable. Refresh and check the exact record and authority.");
      const value = await response.json();
      setMessage(value.data?.status === "UNMET" ? `Requirements unmet: ${(value.data.unmet as string[]).map(x => x.startsWith("PASSED_ATTEMPT_REQUIRED:") ? "passed assessment" : "page marks").join(", ")}.` : "Action recorded.");
      if (reviewedAssignment) await review(reviewedAssignment, true);
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
      {evidence && <section className="training-card training-completion-evidence" aria-label="Selected assignment evidence">
        <h3>Exact evidence for selected assignment</h3>
        <p>Assignment {evidence.assignment.id} · CourseVersion {evidence.assignment.courseVersionId}</p>
        <p>Page marks: {evidence.assignment.viewedCount} of {evidence.assignment.pageCount} · Content hash: {evidence.assignment.contentHash}</p>
        {evidence.rule ? <p>{evidence.rule.pinned ? "Pinned" : "Current"} rule v{evidence.rule.version}: {evidence.rule.id} · Hash: {evidence.rule.hash} · Required AssessmentVersion: {evidence.rule.requiredAssessmentVersionIds.join(", ")} · Validity months: {evidence.rule.validityMonths ?? "None"}</p> : <p>No published rule currently applies.</p>}
        <h4>Submitted assessment evidence</h4>
        <ul>{evidence.attempts.filter(item => item.state === "SUBMITTED").map(item => <li key={item.id}>{item.result} · Attempt {item.id} · AssessmentVersion {item.assessmentVersionId}</li>)}</ul>
        {evidence.completion && <><h4>Recorded completion</h4><p>Completion {evidence.completion.id} · {evidence.completion.pageMarkCount} of {evidence.completion.pageCount} page marks · Passed Attempts: {evidence.completion.passedAttemptIds.join(", ")} · Rule hash: {evidence.completion.ruleHash}</p>
          {evidence.completion.voidedAt && <p>Voided by {evidence.completion.voidedBy} at {new Date(evidence.completion.voidedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}. Reason: {evidence.completion.voidReason}</p>}
          {!evidence.completion.voidedAt && <><label htmlFor="completion-correction-reason">Controlled correction reason</label><textarea id="completion-correction-reason" minLength={10} maxLength={300} value={reason} onChange={event => setReason(event.target.value)} />
            <button type="button" disabled={busy || reason.trim().length < 10} onClick={() => act({ action: "VOID", completionId: evidence.completion?.id, reason, requestId: crypto.randomUUID() })}>Void reviewed completion with reason</button></>}</>}
        <h4>Completion events</h4><ul>{evidence.events.map(item => <li key={item.id}>{item.action} · {new Date(item.occurredAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} · Actor {item.actorPersonId}{item.reason ? ` · ${item.reason}` : ""}</li>)}</ul>
      </section>}
      <div className="training-cards">{assignments.map(item => <article className="training-card" key={item.id}>
        <small>{item.state} · Course v{item.courseVersion}</small><h3>{item.personName} · {item.courseTitle}</h3>
        <p>Rule: {item.ruleVersionId ?? "Not pinned"} · Completion: {item.completionId ?? "None"}</p>
        {item.voidedAt && <p>Completion voided</p>}
        <button type="button" disabled={busy} onClick={() => review(item.id)}>Review evidence</button>
        {item.state === "ACTIVE" && !item.completionId && <button type="button" disabled={busy || reviewedAssignment !== item.id} onClick={() => act({ action: "EVALUATE", assignmentId: item.id, requestId: crypto.randomUUID() })}>Request completion check</button>}
      </article>)}</div>
    </section>}
    {(rights.manager || rights.publisher) && <TrainingCertificateAdmin publisher={rights.publisher} manager={rights.manager}
      assignmentId={reviewedAssignment} completionId={evidence?.completion?.id ?? null}
      completionVoided={Boolean(evidence?.completion?.voidedAt)} initialTemplates={templates} />}
    {rights.superAdmin && <section className="training-card"><h2>Completion manager grants</h2>
      <p>Super Admin can administer a named Office grant. Super Admin role alone cannot evaluate or issue.</p>
      <label htmlFor="completion-manager-candidate">Active Office Admin</label>
      <select id="completion-manager-candidate" value={candidate} onChange={event => setCandidate(event.target.value)}>
        {grantData.candidates?.map(item => <option key={item.personId} value={item.personId}>{item.personName}</option>)}</select>
      <label htmlFor="completion-manager-reason">Grant or revoke reason</label>
      <textarea id="completion-manager-reason" minLength={10} maxLength={300} value={reason} onChange={event => setReason(event.target.value)} />
      <button type="button" disabled={busy || !candidate || reason.trim().length < 10} onClick={() => act({ action: "GRANT", personId: candidate, reason })}>Grant Completion Manager</button>
      <ul>{grantData.grants?.map(item => <li key={item.id}>{item.personName} · {item.revokedAt ? "Revoked" : "Active"}
        {item.events?.map((event, index) => <p key={`${item.id}-${index}`}>{event.action} by {event.actorPersonId} at {new Date(event.occurredAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} · {event.reason}</p>)}
        {!item.revokedAt && <button type="button" disabled={busy || reason.trim().length < 10} onClick={() => act({ action: "REVOKE_GRANT", grantId: item.id, reason })}>Revoke grant</button>}</li>)}</ul>
    </section>}
    <p role="status">{message}</p>
  </div>;
}
