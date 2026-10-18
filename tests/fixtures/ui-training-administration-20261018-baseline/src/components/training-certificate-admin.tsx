"use client";

import { useEffect, useState } from "react";

type Template = { id: string; version: number; title: string; issuerLabel: string; statement: string; hash: string };
type Issue = { id: string; reference: string; completionId: string; issueDate: string; expiryOn: string | null;
  reissueOf: string | null; state: string; current: boolean; revokedAt: string | null;
  issuedBy?: string; revokedBy?: string | null; reason?: string; revokeReason?: string | null;
  events: { action: string; occurredAt: string; actorPersonId?: string; reason?: string | null }[] };

export function TrainingCertificateAdmin({ publisher, manager, assignmentId, completionId, completionVoided, initialTemplates }: {
  publisher: boolean; manager: boolean; assignmentId: string | null; completionId: string | null;
  completionVoided: boolean; initialTemplates: unknown;
}) {
  const [templates, setTemplates] = useState<Template[]>(Array.isArray(initialTemplates) ? initialTemplates : []);
  const [history, setHistory] = useState<Issue[]>([]);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [title, setTitle] = useState("Training completion certificate");
  const [issuerLabel, setIssuerLabel] = useState("KSS Training");
  const [statement, setStatement] = useState("This certificate records an explicit issue against the named learner's recorded course completion.");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!assignmentId || !manager) return;
    let cancelled = false;
    fetch(`/api/training-certificates?view=history&assignmentId=${encodeURIComponent(assignmentId)}`)
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(value => { if (!cancelled) setHistory(Array.isArray(value.data) ? value.data : []); })
      .catch(() => { if (!cancelled) setMessage("Certificate history unavailable; actions need a fresh readback."); });
    return () => { cancelled = true; };
  }, [assignmentId, completionId, manager]);

  async function readHistory(expectedId?: string, expectedState?: string) {
    if (!assignmentId) throw new Error("Select an exact assignment first.");
    const response = await fetch(`/api/training-certificates?view=history&assignmentId=${encodeURIComponent(assignmentId)}`);
    if (!response.ok) throw new Error("Authoritative certificate history unavailable.");
    const value = await response.json();
    if (!Array.isArray(value.data)) throw new Error("Authoritative certificate history unavailable.");
    const fresh = value.data as Issue[];
    setHistory(fresh);
    if (expectedId && !fresh.some(item => item.id === expectedId && item.state === expectedState))
      throw new Error("Certificate change could not be confirmed from history.");
    return fresh;
  }

  async function submit(payload: Record<string, unknown>, confirmation: string) {
    setBusy(true); setMessage("Pending server acceptance…");
    try {
      const response = await fetch("/api/training-certificates", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Certificate action denied or unconfirmed.");
      if (payload.action === "PUBLISH_TEMPLATE") {
        const updated = await fetch("/api/training-certificates?view=templates");
        if (!updated.ok) throw new Error("Template readback unavailable.");
        const read = await updated.json();
        if (!Array.isArray(read.data) || !read.data.some((item: Template) => item.id === value.data?.id))
          throw new Error("Template publication could not be confirmed.");
        setTemplates(read.data); setTemplateId(value.data.id);
      } else {
        await readHistory(value.data?.issueId, payload.action === "REVOKE" ? "REVOKED" : "ISSUED");
      }
      setMessage(confirmation);
    } catch (cause) {
      setMessage(cause instanceof Error ? `${cause.message} No success is confirmed.` : "Certificate action unconfirmed.");
    } finally { setBusy(false); }
  }

  const relevant = history.filter(item => item.completionId === completionId);
  const current = relevant.find(item => item.current);
  const lastRevoked = relevant.find(item => item.state === "REVOKED" && !relevant.some(next => next.reissueOf === item.id));
  return <section className="training-card" aria-label="Certificate issue and history">
    <h2>Certificates</h2>
    <p>Certificate issue is a separate manager decision. Each PDF is tied to one immutable issue and private download authority.</p>
    {publisher && <div><h3>Publish certificate template version</h3>
      <label htmlFor="certificate-template-title">Certificate title</label>
      <input id="certificate-template-title" maxLength={32} value={title} onChange={event => setTitle(event.target.value)} />
      <label htmlFor="certificate-template-issuer">Issuer label</label>
      <input id="certificate-template-issuer" maxLength={40} value={issuerLabel} onChange={event => setIssuerLabel(event.target.value)} />
      <label htmlFor="certificate-template-statement">Factual statement</label>
      <textarea id="certificate-template-statement" minLength={10} maxLength={180} value={statement} onChange={event => setStatement(event.target.value)} />
      <button type="button" disabled={busy || title.trim().length < 3 || issuerLabel.trim().length < 3 || statement.trim().length < 10}
        onClick={() => submit({ action: "PUBLISH_TEMPLATE", title, issuerLabel, statement }, "Template publication confirmed from readback.")}>Publish immutable template</button>
    </div>}
    {manager && <div><h3>Exact issue decision</h3>
      <p>{assignmentId ? `Selected assignment ${assignmentId}` : "Review an exact assignment above to inspect certificate history."}</p>
      <label htmlFor="certificate-template-version">Published template version</label>
      <select id="certificate-template-version" value={templateId} onChange={event => setTemplateId(event.target.value)}>
        <option value="">Select template</option>{templates.map(item => <option key={item.id} value={item.id}>v{item.version} · {item.title}</option>)}
      </select>
      <label htmlFor="certificate-reason">Issue, revoke or reissue reason</label>
      <textarea id="certificate-reason" minLength={10} maxLength={300} value={reason} onChange={event => setReason(event.target.value)} />
      {completionId && !completionVoided && !current && !lastRevoked && relevant.length === 0 &&
        <button type="button" disabled={busy || !templateId || reason.trim().length < 10} onClick={() => submit({ action: "ISSUE", completionId,
          templateVersionId: templateId, reissueOf: null, reason, requestId: crypto.randomUUID() }, "Certificate issue confirmed from authoritative history.")}>Issue certificate</button>}
      {completionId && !completionVoided && lastRevoked && !current &&
        <button type="button" disabled={busy || !templateId || reason.trim().length < 10} onClick={() => submit({ action: "ISSUE", completionId,
          templateVersionId: templateId, reissueOf: lastRevoked.id, reason, requestId: crypto.randomUUID() }, "New certificate issue confirmed; prior issue remains historical.")}>Reissue as a new certificate</button>}
      {completionVoided && <p role="status">Completion voided. Current certificate download is invalidated; historical issues remain.</p>}
      <h3>Certificate history</h3>
      {relevant.length ? <ul className="training-certificate-history">{relevant.map(item => <li key={item.id}>
        <strong>{item.reference}</strong><span>{item.state} · Issued {item.issueDate}{item.expiryOn ? ` · Expiry ${item.expiryOn}` : ""}</span>
        {item.reissueOf && <span> · Reissue of {item.reissueOf}</span>}
        {item.issuedBy && <span> · Issuer {item.issuedBy}</span>}
        {item.revokeReason && <span> · Revocation reason {item.revokeReason}</span>}
        {item.current && <><a href={`/api/training-certificates/${item.id}/file`} target="_blank" rel="noreferrer">Open private PDF</a>
          <button type="button" disabled={busy || reason.trim().length < 10} onClick={() => submit({ action: "REVOKE", issueId: item.id,
            reason, requestId: crypto.randomUUID() }, "Revocation confirmed; current download access removed.")}>Revoke with reason</button></>}
        <ul>{item.events.map((event, index) => <li key={`${item.id}-${index}`}>{event.action} · {new Date(event.occurredAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}
          {event.actorPersonId ? ` · Actor ${event.actorPersonId}` : ""}{event.reason ? ` · ${event.reason}` : ""}</li>)}</ul>
      </li>)}</ul> : <p>No certificate issued for this Completion.</p>}
    </div>}
    <p role="status">{message}</p>
  </section>;
}
