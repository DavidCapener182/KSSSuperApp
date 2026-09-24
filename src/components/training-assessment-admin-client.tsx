"use client";

import { useState } from "react";

type Option = { id: string; text: string };
type Question = { id: string; type: "SINGLE" | "MULTIPLE"; prompt: string; options: Option[]; key: string[] };
type Version = { id: string; courseVersionId: string; versionNumber: number; revision: number; state: string; questions: Question[]; currentVersionId: string | null; publishedAt: string | null; retiredAt: string | null };
type Course = { courseVersionId: string; title: string; versionNumber: number; currentAssessmentVersionId: string | null };
type Rights = { author: boolean; publisher: boolean; superAdmin: boolean };
type Grant = { id: string; personId: string; displayName: string; capability: string; revokedAt: string | null };
type Candidate = { personId: string; displayName: string };
const blank = (): Question => ({ id: crypto.randomUUID(), type: "SINGLE", prompt: "", options: [{ id: crypto.randomUUID(), text: "" }, { id: crypto.randomUUID(), text: "" }], key: [] });

export function TrainingAssessmentAdminClient({ initial, courses, rights, grants, candidates }: { initial: Version[]; courses: Course[]; rights: Rights; grants: Grant[]; candidates: Candidate[] }) {
  const [versions, setVersions] = useState(initial);
  const [grantRows, setGrantRows] = useState(grants);
  const [selected, setSelected] = useState<string>(initial.find(v => v.state === "DRAFT")?.id ?? "");
  const [courseId, setCourseId] = useState(courses[0]?.courseVersionId ?? "");
  const [questions, setQuestions] = useState<Question[]>(initial.find(v => v.id === selected)?.questions ?? [blank()]);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [personId, setPersonId] = useState(candidates[0]?.personId ?? "");
  const [capability, setCapability] = useState("ASSESSMENT_AUTHOR"); const [reason, setReason] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [attemptHistory, setAttemptHistory] = useState<{ id: string; assessmentVersionId: string; state: string; startedAt: string; submittedAt: string | null; scorePercent: number | null; result: string | null }[]>([]);
  const current = versions.find(v => v.id === selected);
  async function reload() {
    const response = await fetch("/api/training-assessments?view=admin", { cache: "no-store" });
    if (!response.ok) throw new Error("Assessment records unavailable");
    const payload = await response.json(); setVersions(payload.data as Version[]);
    if (rights.superAdmin) { const grantsResponse = await fetch("/api/training-assessments?view=grants", { cache: "no-store" }); if (grantsResponse.ok) setGrantRows((await grantsResponse.json()).data as Grant[]); }
  }
  async function loadHistory() {
    setMessage("");
    const response = await fetch(`/api/training-assessments?view=history&assignmentId=${encodeURIComponent(assignmentId)}`, { cache: "no-store" });
    if (!response.ok) { setAttemptHistory([]); setMessage("Attempt history unavailable for that exact Assignment."); return; }
    setAttemptHistory((await response.json()).data as typeof attemptHistory);
  }
  async function act(action: string, extra: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/training-assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      if (!response.ok) throw new Error("Action denied or draft changed. Check the fields and refresh.");
      const payload = await response.json();
      if (action === "CREATE") setSelected(payload.data as string);
      await reload(); setMessage(`${action.toLowerCase().replaceAll("_", " ")} saved.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action unavailable"); }
    finally { setBusy(false); }
  }
  function updateQuestion(index: number, change: Partial<Question>) { setQuestions(questions.map((q, i) => i === index ? { ...q, ...change } : q)); }
  function updateOption(qi: number, oi: number, text: string) { updateQuestion(qi, { options: questions[qi].options.map((o, i) => i === oi ? { ...o, text } : o) }); }
  function toggleKey(qi: number, id: string) { const q = questions[qi]; updateQuestion(qi, { key: q.type === "SINGLE" ? [id] : q.key.includes(id) ? q.key.filter(k => k !== id) : [...q.key, id] }); }
  function selectVersion(v: Version) { setSelected(v.id); setQuestions(v.questions.map(q => ({ ...q, options: q.options.map(o => ({ ...o })), key: [...(q.key ?? [])] }))); }
  return <div className="training-admin training-assessment-admin">
    <section className="training-admin-list"><h2>Assessment versions</h2>{versions.length === 0 && <p>No assessment yet.</p>}{versions.map(v => <button className={selected === v.id ? "selected" : ""} type="button" key={v.id} onClick={() => selectVersion(v)}>Version {v.versionNumber} · {v.state}{v.retiredAt ? " · retired" : ""} · {courses.find(c => c.courseVersionId === v.courseVersionId)?.title ?? "Course"}</button>)}</section>
    <section className="training-admin-edit"><h2>{current ? `Version ${current.versionNumber}` : "New assessment"}</h2><p>All questions are required. 1–25 questions, 2–6 options each, equal weight, exact answer matching. Pass threshold 80%; three submitted attempts; 30-minute failed retake delay.</p><p role="status" aria-live="polite">{message}</p>
      {!current && rights.author && <label>Published course version<select value={courseId} onChange={event => setCourseId(event.target.value)}>{courses.map(c => <option key={c.courseVersionId} value={c.courseVersionId}>{c.title} · Course version {c.versionNumber}</option>)}</select></label>}
      {rights.author && (!current || current.state === "DRAFT") && <>{questions.map((q, qi) => <fieldset key={q.id}><legend>Question {qi + 1}</legend><label>Question text<input value={q.prompt} maxLength={1500} onChange={event => updateQuestion(qi, { prompt: event.target.value })} /></label><label>Answer type<select value={q.type} onChange={event => updateQuestion(qi, { type: event.target.value as Question["type"], key: [] })}><option value="SINGLE">Choose one</option><option value="MULTIPLE">Choose all that apply</option></select></label>
        {q.options.map((option, oi) => <div key={option.id} className="training-option-admin"><label>Option {oi + 1}<input value={option.text} maxLength={500} onChange={event => updateOption(qi, oi, event.target.value)} /></label><label><input type={q.type === "SINGLE" ? "radio" : "checkbox"} name={`key-${q.id}`} checked={q.key.includes(option.id)} onChange={() => toggleKey(qi, option.id)} /> Correct answer</label><button type="button" disabled={q.options.length <= 2} onClick={() => updateQuestion(qi, { options: q.options.filter(o => o.id !== option.id), key: q.key.filter(k => k !== option.id) })}>Remove option</button></div>)}
        <button type="button" disabled={q.options.length >= 6} onClick={() => updateQuestion(qi, { options: [...q.options, { id: crypto.randomUUID(), text: "" }] })}>Add option</button><button type="button" disabled={questions.length <= 1} onClick={() => setQuestions(questions.filter(x => x.id !== q.id))}>Remove question</button></fieldset>)}
        <div className="training-editor-actions"><button type="button" disabled={questions.length >= 25} onClick={() => setQuestions([...questions, blank()])}>Add question</button><button type="button" disabled={busy || (!current && !courseId)} onClick={() => act(current ? "EDIT" : "CREATE", current ? { versionId: current.id, revision: current.revision, questions } : { courseVersionId: courseId, questions })}>{current ? "Save draft" : "Create draft"}</button>{current?.state === "DRAFT" && <button type="button" disabled={busy} onClick={() => act("ABANDON_DRAFT", { versionId: current.id, revision: current.revision, reason: "Synthetic draft abandoned by author" })}>Abandon draft</button>}</div></>}
      {current && current.state !== "DRAFT" && <p>Published assessment content is sealed. A change requires a new draft/version.</p>}
      {current && <section className="training-preview" aria-label="Assessment preview"><h3>Restricted preview · Version {current.versionNumber}</h3>{current.questions.map((q, index) => <div key={q.id}><h4>{index + 1}. {q.prompt}</h4><p>{q.type === "SINGLE" ? "Choose one" : "Choose all that apply"}</p><ul>{q.options.map(o => <li key={o.id}>{o.text}{q.key?.includes(o.id) ? " · keyed answer" : ""}</li>)}</ul></div>)}</section>}
      {current?.state === "DRAFT" && rights.publisher && <button type="button" disabled={busy} onClick={() => act("PUBLISH", { versionId: current.id, revision: current.revision })}>Publish exact version</button>}
      {current?.state === "PUBLISHED" && !current.retiredAt && rights.publisher && <button type="button" disabled={busy} onClick={() => act("RETIRE", { versionId: current.id, reason: "Synthetic published assessment retired after review" })}>Retire version</button>}
      {current?.state === "PUBLISHED" && rights.author && <button type="button" onClick={() => { setSelected(""); setQuestions(current.questions.map(q => ({ ...q, id: crypto.randomUUID(), options: q.options.map(o => ({ ...o, id: crypto.randomUUID() })), key: [] }))); setCourseId(current.courseVersionId); }}>Create replacement draft</button>}
    </section>
    <section className="training-grants"><h2>Exact Assignment attempt history</h2><p>Enter one Assignment ID to inspect minimal factual history. No learner search or ranking is provided.</p><label>Assignment ID<input value={assignmentId} onChange={event => setAssignmentId(event.target.value)} /></label><button type="button" disabled={assignmentId.length !== 36} onClick={loadHistory}>View attempt history</button><ol className="training-event-list">{attemptHistory.map(a => <li key={a.id}>Assessment version {a.assessmentVersionId} · {a.state} · Started {new Date(a.startedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}{a.submittedAt && <> · Submitted {new Date(a.submittedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} · {a.scorePercent}% · {a.result}</>}</li>)}</ol></section>
    {rights.superAdmin && <section className="training-grants"><h2>Assessment authority</h2><p>Super Admin grants named Office administrators. Super Admin role alone cannot author or publish.</p><label>Office administrator<select value={personId} onChange={event => setPersonId(event.target.value)}>{candidates.map(c => <option key={c.personId} value={c.personId}>{c.displayName}</option>)}</select></label><label>Capability<select value={capability} onChange={event => setCapability(event.target.value)}><option>ASSESSMENT_AUTHOR</option><option>ASSESSMENT_PUBLISHER</option></select></label><label>Grant or revoke reason<input value={reason} onChange={event => setReason(event.target.value)} /></label><button type="button" disabled={busy || !personId || reason.trim().length < 10} onClick={() => act("GRANT", { personId, capability, reason })}>Grant capability</button><ul>{grantRows.map(g => <li key={g.id}>{g.displayName} · {g.capability} · {g.revokedAt ? "revoked" : "active"}{!g.revokedAt && <button type="button" disabled={busy || reason.trim().length < 10} onClick={() => act("REVOKE", { grantId: g.id, reason })}>Revoke</button>}</li>)}</ul></section>}
  </div>;
}
