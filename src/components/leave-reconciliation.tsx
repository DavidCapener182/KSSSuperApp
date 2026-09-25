"use client";

import { useCallback, useEffect, useState } from "react";

type Issue = { id: string; source: "EVENT" | "SITE_SHIFT"; allocationId: string;
  status: "REVIEW_REQUIRED" | "CLOSED"; revision: number; createdAt: string; closedAt: string | null };

export function LeaveReconciliation({ source, allocationId }: { source: "EVENT" | "SITE_SHIFT"; allocationId: string }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(`/api/leave-reconciliation?source=${source}&allocationId=${allocationId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Reconciliation unavailable");
    const data = await response.json();
    setIssues(data.issues ?? []);
  }, [source, allocationId]);
  useEffect(() => { const timer = setTimeout(() => { void load().catch(() => setError("Reconciliation unavailable")); }, 0);
    return () => clearTimeout(timer); }, [load]);
  async function close(issue: Issue) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/leave-reconciliation", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ issueId: issue.id, expectedRevision: issue.revision, reason: reason.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Reconciliation remains open");
      setReason(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Reconciliation remains open"); }
    finally { setBusy(false); }
  }
  if (issues.length === 0 && !error) return null;
  return <div className="deployment-reconciliation" aria-label="Approved time away reconciliation">
    {issues.map((issue) => <div key={issue.id}>
      <strong>{issue.status === "REVIEW_REQUIRED" ? "Approved time away conflict · review required" : "Approved time away conflict · reviewed"}</strong>
      <p>Review the allocation&apos;s current state before closing this issue. Its history remains available.</p>
      {issue.status === "REVIEW_REQUIRED" && <div>
        <label>Reconciliation reason<textarea value={reason} minLength={10} maxLength={300}
          onChange={(event) => setReason(event.target.value)} /></label>
        <button type="button" disabled={busy || reason.trim().length < 10} onClick={() => void close(issue)}>Close after operational review</button>
      </div>}
    </div>)}
    {error && <p role="alert">{error}</p>}
  </div>;
}
