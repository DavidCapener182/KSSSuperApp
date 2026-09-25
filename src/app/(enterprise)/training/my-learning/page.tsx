import Link from "next/link";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import type { TrainingAssignment } from "@/lib/training/learning-types";
import "../training.css";

export const dynamic = "force-dynamic";
export default async function MyLearning() {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return null;
  const [{ data, error }, { data: completionData }] = await Promise.all([
    client.rpc("training_my_learning"), client.rpc("training_completion_mine"),
  ]);
  const completions = Array.isArray(completionData) ? completionData as {
    id: string; assignmentId: string; courseVersionId: string; ruleVersionId: string;
    completedAt: string; voidedAt: string | null;
  }[] : [];
  const certificateReads = await Promise.all(completions.map(completion =>
    client.rpc("training_certificate_history", { p_assignment: completion.assignmentId })));
  const certificateHistory = new Map(completions.map((completion, index) => [completion.id, certificateReads[index]]));
  const assignments = !error && Array.isArray(data) ? data as TrainingAssignment[] : [];
  const active = assignments.filter(a => a.state === "ACTIVE");
  const history = assignments.filter(a => a.state !== "ACTIVE");
  const card = (a: TrainingAssignment) => <article className="training-card" key={a.id}>
    <small>Synthetic learning · Version {a.versionNumber} · {a.state.toLowerCase()}</small><h2>{a.title}</h2>
    <p>Assigned {new Date(a.assignedAt).toLocaleDateString("en-GB", { timeZone: "Europe/London" })} · Due {a.dueOn}</p>
    <p>{a.viewedCount} of {a.pageCount} pages marked viewed</p>
    {a.retired && a.state === "ACTIVE" ? <p role="status">Content retired — assignment needs review.</p> : a.state === "ACTIVE" ? <Link href={`/training/my-learning/${a.id}`}>Resume version {a.versionNumber} →</Link> : null}
    <Link href={`/training/my-learning/${a.id}/assessment`}>Assessment and attempts</Link><Link href={`/training/my-learning/${a.id}/history`}>View assignment history</Link>
  </article>;
  return <main className="training-area"><header><p className="training-eyebrow">Native learning · Synthetic Dev</p><h1>My Learning</h1><p>Page progress records which learning pages you have marked as viewed. It does not mean the course has been completed or that you have passed an assessment.</p></header>
    <nav className="training-section-links"><Link href="/training">Course catalogue</Link><Link href="/training/my-learning" aria-current="page">My Learning</Link></nav>
    {error ? <p role="alert">My Learning is unavailable for this role.</p> : <><h2>Active assignments</h2>{active.length ? <div className="training-cards">{active.map(card)}</div> : <p>No active assignments.</p>}
      <h2>Assignment history</h2>{history.length ? <div className="training-cards">{history.map(card)}</div> : <p>No earlier assignments.</p>}
      <h2>Completion history</h2>{completions.length ? <div className="training-cards">{completions.map(completion => {
        const assignment = assignments.find(item => item.id === completion.assignmentId);
        const certificateRead = certificateHistory.get(completion.id);
        const issues = !certificateRead?.error && Array.isArray(certificateRead?.data) ? certificateRead.data as {
          id: string; reference: string; issueDate: string; expiryOn: string | null;
          state: string; current: boolean; reissueOf: string | null;
        }[] : [];
        return <article className="training-card" key={completion.id}><small>{completion.voidedAt ? "Voided completion" : "Recorded completion"}</small>
          <h3>{assignment?.title ?? "Assigned course"} · Version {assignment?.versionNumber ?? "recorded"}</h3>
          <p>Completed {new Date(completion.completedAt).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</p>
          <p>A completion is a Training record. A certificate requires a separate issue decision.</p>
          {certificateRead?.error ? <p role="status">Certificate history is unavailable.</p> : issues.length ? <div className="training-certificate-history">
            <h4>Certificate history</h4><ul>{issues.map(issue => <li key={issue.id}>
              <strong>{issue.reference}</strong>
              <span>{issue.current ? "Current" : issue.state === "REVOKED" ? "Revoked" : issue.state === "COMPLETION_VOIDED" ? "Invalidated by Completion void" : issue.state}
                {issues.some(next => next.reissueOf === issue.id) ? " · Reissued" : ""}</span>
              <span>Issued {issue.issueDate}{issue.expiryOn ? ` · Recorded expiry ${issue.expiryOn}` : ""}</span>
              {issue.current && <a href={`/api/training-certificates/${issue.id}/file`} target="_blank" rel="noreferrer">Open private certificate PDF</a>}
            </li>)}</ul>
          </div> : <p>No certificate issued for this Completion.</p>}
        </article>;
      })}</div> : <p>No course completions recorded.</p>}</>}
  </main>;
}
