"use client";

import { useState } from "react";

type Result = { status: "UNMET" | "COMPLETED" | "VOIDED"; unmet: string[] };

export function TrainingCompletionCheck({ assignmentId }: { assignmentId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  async function evaluate() {
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/training-completions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "EVALUATE", assignmentId, requestId: crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error("Completion check unavailable. Please refresh and try again.");
      const payload = await response.json();
      setResult(payload.data as Result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Completion check unavailable."); }
    finally { setBusy(false); }
  }
  return <section className="training-completion-check" aria-labelledby="completion-check-title">
    <h2 id="completion-check-title">Course completion</h2>
    <p>Page marks and assessment passes are checked against the published rule for this exact assignment. A certificate is issued separately by an authorised manager.</p>
    <button type="button" disabled={busy} onClick={evaluate}>Request completion check</button>
    <div role="status" aria-live="polite">{busy ? "Checking completion…" : error ||
      (result?.status === "COMPLETED" ? "Course completion recorded. A certificate has not been issued." :
        result?.status === "VOIDED" ? "The recorded completion was voided." :
          result?.status === "UNMET" ? "Completion requirements are not yet met." : "")}</div>
    {result?.status === "UNMET" && <ul>{result.unmet.map(item => <li key={item}>{item.startsWith("PASSED_ATTEMPT_REQUIRED:") ? "A passed attempt is required for the assessment version in the published rule." : "Every page in this assigned course version must be marked viewed."}</li>)}</ul>}
  </section>;
}
