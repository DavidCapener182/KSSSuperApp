"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Kind = "SITE" | "SITE_SERVICE" | "EVENT";
type Status = { asOf: string; assignments: Array<{ assignmentId: string; title: string;
  version: number; required: boolean; effectiveFrom: string; recipientCount: number;
  acknowledgedCount: number }> };

export function OperationalDocumentContextCard({ kind, id }: { kind: Kind; id: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/operational-documents/context-card?kind=${kind}&id=${encodeURIComponent(id)}`,
      { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) { setError(true); return; }
      setStatus(await response.json()); setError(false);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [kind, id]);
  const params = new URLSearchParams({ kind, id });
  return <section className="crm-panel" aria-labelledby={`operational-documents-${kind}-${id}`}>
    <h2 id={`operational-documents-${kind}-${id}`}>Operational documents</h2>
    {!status && !error && <p>Loading authorised document status…</p>}
    {error && <p>Document status is unavailable for this account or context.</p>}
    {status && <>
      {status.assignments.length === 0 && <p>No current operational document assignments for this exact context.</p>}
      <ul>{status.assignments.map((row) => <li key={row.assignmentId}>
        <strong>{row.title} · v{row.version}</strong> · {row.required ? "Required" : "Optional"} ·
        Effective {new Date(row.effectiveFrom).toLocaleDateString("en-GB")} ·
        {` ${row.acknowledgedCount}/${row.recipientCount} acknowledged`}
      </li>)}</ul>
      <p>As of {new Date(status.asOf).toLocaleString("en-GB")}. Status access does not grant PDF access.</p>
      <Link href={`/operational-documents?${params}`}>Open operational document status</Link>
    </>}
  </section>;
}
