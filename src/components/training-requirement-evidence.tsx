"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type TrainingRequirementContext = { personId: string; personName: string; serviceId: string; serviceName: string;
  roleId: string; roleName: string; asOf: string };
type MatrixRow = { requirementId: string; versionId: string; version: number; label: string;
  status: string; courseVersionId: string; assignmentId: string | null; completionId: string | null;
  completionRuleVersionId: string | null; completedAt: string | null;
  certificateIssueId: string | null; certificateReference: string | null; hash: string };
type Matrix = { rows: MatrixRow[]; asOf: string; policy: string };


// These identities already belong to the guarded 20F-A matrix response.
// A successful response for another context cannot stand in for this read.
export function matchesTrainingMatrix(value: unknown, context: TrainingRequirementContext): value is Matrix {
  if (!value || typeof value !== 'object') return false;
  const result = value as Matrix & Partial<TrainingRequirementContext>;
  return result.personId === context.personId && result.serviceId === context.serviceId && result.roleId === context.roleId &&
    result.asOf === context.asOf && result.policy === 'SYNTHETIC_TRAINING_PILOT' && Array.isArray(result.rows) &&
    result.rows.every(row => row && typeof row.label === 'string' && typeof row.versionId === 'string' &&
      typeof row.courseVersionId === 'string' && ['NOT_ASSIGNED','ASSIGNED_IN_PROGRESS','COMPLETED'].includes(row.status));
}

export function TrainingRequirementEvidence({context, staffLinks, canReviewCompletions, actionBusy = false, onBusyChange}: {
  context: TrainingRequirementContext; staffLinks: boolean; canReviewCompletions: boolean;
  actionBusy?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { activeRequest.current?.abort(); onBusyChange?.(false); }, [onBusyChange]);
  async function readMatrix() {
    activeRequest.current?.abort();
    const controller = new AbortController(); activeRequest.current = controller;
    setBusy(true); onBusyChange?.(true); setMessage(''); setMatrix(null);
    try {
      const params = new URLSearchParams({view:'matrix',person:context.personId,service:context.serviceId,role:context.roleId,asOf:context.asOf});
      const response = await fetch(`/api/training-requirements?${params}`,{cache:'no-store',signal:controller.signal});
      const result = await response.json();
      if (!response.ok || !matchesTrainingMatrix(result.data,context)) throw new Error('Source unavailable');
      if (!controller.signal.aborted) setMatrix(result.data);
    } catch {
      if (!controller.signal.aborted) setMessage('SOURCE_UNAVAILABLE — this context or its Training source could not be read.');
    } finally { if (!controller.signal.aborted) { setBusy(false); onBusyChange?.(false); } }
  }
  return <div>
    <button disabled={busy || actionBusy} onClick={readMatrix}>Read requirement evidence</button>
    {busy && <p role="status">Reading exact context evidence…</p>}
    {message && <p role="status">{message}</p>}
    {matrix && <div aria-live="polite">
      <p>As of {matrix.asOf}. A blank result means no published Training requirement applies to this context.</p>
      {matrix.rows.length ? <div className="training-cards">{matrix.rows.map(row =>
        <article className="training-card training-requirement-row" key={row.versionId}>
          <small>Requirement version {row.version} · Synthetic policy</small>
          <h3>{row.label}</h3><p><strong>{row.status.replaceAll('_',' ')}</strong></p>
          <details className="training-requirement-provenance"><summary>Exact evidence identities</summary><p>Requirement {row.requirementId} · Version {row.versionId} · CourseVersion {row.courseVersionId} · Hash {row.hash}</p></details>
          {row.assignmentId && <p>Assignment {staffLinks
            ? <Link href={`/training/my-learning/${row.assignmentId}`}>{staffLinks ? "Open assigned learning" : "Review completion evidence"}</Link>
            : canReviewCompletions
              ? <Link href={`/training-admin/completions?assignment=${row.assignmentId}`}>{staffLinks ? "Open assigned learning" : "Review completion evidence"}</Link>
              : row.assignmentId}</p>}
          {row.completionId && <p>Completion {row.completionId} · rule {row.completionRuleVersionId} · {row.completedAt}</p>}
          {row.certificateIssueId && <p>Separate certificate issue: {row.certificateReference}</p>}
        </article>)}</div> : <p>NOT_APPLICABLE — no published requirement matches this context and date.</p>}
    </div>}
  </div>;
}
