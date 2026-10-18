"use client";

import { useState } from "react";

type Question = { id: string; type: "SINGLE" | "MULTIPLE"; prompt: string; options: { id: string; text: string }[] };
type Attempt = { id: string; assessmentVersionId: string; state: "IN_PROGRESS" | "SUBMITTED" | "ABANDONED"; revision: number; draftAnswers: Record<string, string[]> | null; startedAt: string; submittedAt: string | null; scorePercent: number | null; result: "PASSED" | "FAILED" | null; attemptNumber: number | null; attemptsRemaining: number; earliestRetakeAt: string | null };
export type AssessmentStaff = { assignmentId: string; assignmentState: string; courseRetired: boolean; assessmentVersionId: string | null; assessmentVersionNumber: number | null; questions: Question[]; openQuestions: Question[]; openAttempt: Attempt | null; history: Attempt[]; attemptsRemaining: number; earliestRetakeAt: string | null; retakeBlocked: boolean; passedCurrent: boolean };

export function TrainingAssessmentClient({ initial }: { initial: AssessmentStaff }) {
  const [view, setView] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, string[]>>(initial.openAttempt?.draftAnswers ?? {});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const open = view.openAttempt;
  const questions = open ? view.openQuestions : view.questions;
  const blocked = view.assignmentState !== "ACTIVE" || view.courseRetired || (open ? questions.length === 0 : !view.assessmentVersionId);
  async function refresh() {
    const response = await fetch(`/api/training-assessments?view=staff&assignmentId=${view.assignmentId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Assessment unavailable");
    const payload = await response.json();
    const next = payload.data as AssessmentStaff;
    setView(next);
    setAnswers(next.openAttempt?.draftAnswers ?? {});
  }
  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/training-assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, requestId: crypto.randomUUID(), assignmentId: view.assignmentId, versionId: view.assessmentVersionId, attemptId: open?.id, revision: open?.revision, answers, ...extra }) });
      if (!response.ok) throw new Error("Action unavailable or record changed. Refresh and try again.");
      await refresh();
      setConfirmSubmit(false);
      setMessage(action === "SUBMIT" ? "Attempt submitted. Your factual result is shown below." : action === "SAVE" ? "Answers saved." : action === "ABANDON" ? "Attempt abandoned. Your history is retained." : "Attempt started.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action unavailable."); }
    finally { setBusy(false); }
  }
  function choose(question: Question, optionId: string, checked: boolean) {
    const before = answers[question.id] ?? [];
    const next = question.type === "SINGLE" ? [optionId] : checked ? [...before, optionId] : before.filter(x => x !== optionId);
    setAnswers({ ...answers, [question.id]: next });
  }
  const delay = view.retakeBlocked;
  return <div className="training-assessment">
    <p role="status" aria-live="polite">{message}</p>
    <p className="training-boundary">An assessment result is a factual result only. Page viewed ≠ assessment attempted ≠ assessment passed ≠ course completed ≠ certificate issued ≠ credential verified ≠ deployment eligible.</p>
    {blocked && <p role="alert">This assignment or its pinned assessment content is unavailable for new answer actions. Previous attempt history is retained.</p>}
    {!open && !blocked && <section className="training-card"><h2>Assessment introduction</h2><p>Assessment version {view.assessmentVersionNumber}. Every question is required. The pass threshold is 80%. You may submit up to three attempts for this assignment and version. After a failed submission, the next attempt is available 30 minutes later. Abandoning an open attempt does not consume a submitted attempt.</p><p>{view.attemptsRemaining} submitted attempts remaining.</p>{delay && view.earliestRetakeAt && <p>Earliest retake: {new Date(view.earliestRetakeAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}</p>}
      <button type="button" disabled={busy || view.attemptsRemaining === 0 || view.passedCurrent || Boolean(delay)} onClick={() => act("START")}>Start attempt</button></section>}
    {open && <section className="training-card"><h2>Open attempt</h2><p>Assessment version {open.assessmentVersionId}. Started {new Date(open.startedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}. Leaving this page keeps your open attempt; use Save answers to persist edits.</p>
      {questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.prompt}</legend><p>{question.type === "SINGLE" ? "Choose one answer" : "Choose all that apply"}</p>{question.options.map(option => <label key={option.id} className="training-assessment-option"><input type={question.type === "SINGLE" ? "radio" : "checkbox"} name={question.id} checked={(answers[question.id] ?? []).includes(option.id)} onChange={event => choose(question, option.id, event.target.checked)} disabled={busy || blocked} />{option.text}</label>)}</fieldset>)}
      <div className="training-learning-actions"><button type="button" disabled={busy || blocked} onClick={() => act("SAVE")}>Save answers</button><button type="button" disabled={busy || blocked || questions.some(q => !(answers[q.id]?.length))} onClick={() => setConfirmSubmit(true)}>Submit attempt</button><button type="button" disabled={busy || blocked} onClick={() => act("ABANDON")}>Abandon attempt</button></div>
      {confirmSubmit && <div role="group" aria-label="Confirm submission"><p>Submit these answers for final grading? Submitted answers cannot be changed.</p><button type="button" disabled={busy} onClick={() => act("SUBMIT")}>Confirm submission</button><button type="button" onClick={() => setConfirmSubmit(false)}>Return to answers</button></div>}
    </section>}
    <section><h2>Attempt history</h2>{view.history.length === 0 ? <p>No attempt has been started.</p> : <ol className="training-event-list">{view.history.map(attempt => <li key={attempt.id}><strong>{attempt.state === "SUBMITTED" ? `Submitted attempt ${attempt.attemptNumber}` : attempt.state === "ABANDONED" ? "Abandoned attempt" : "Open attempt"}</strong> · Assessment version {attempt.assessmentVersionId}<br />Started {new Date(attempt.startedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}{attempt.submittedAt && <> · Submitted {new Date(attempt.submittedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}</>}{attempt.state === "SUBMITTED" && <p>{attempt.scorePercent}% · {attempt.result} · {attempt.attemptsRemaining} submitted attempts remaining</p>}</li>)}</ol>}</section>
  </div>;
}
