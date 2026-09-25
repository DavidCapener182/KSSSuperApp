"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./operational-documents.module.css";

type Version = { id: string; version_number: number; title: string; state: string; upload_state: string; effective_on: string | null };
type Document = { id: string; title: string; controlled_document_versions: Version[] };
type Assignment = { id: string; documentId: string; versionId: string; title: string; version: number;
  targetKind: string; targetId: string; contextKind: string | null; contextId: string | null;
  required: boolean; effectiveFrom: string; effectiveUntil: string | null; closedAt: string | null;
  closeKind: string | null; replacementId: string | null };
type Mine = { id: string; document_id: string; version_id: string; version_number: number; title: string;
  target_kind: string; target_id: string; required: boolean; effective_from: string;
  current: boolean; conflict: boolean; opened: boolean; acknowledged_at: string | null; close_kind: string | null;
  context_label?: string };

async function jsonRequest(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request unavailable");
  return data;
}
const dateText = (value: string | null) => value ? new Date(value).toLocaleString("en-GB") : "—";
const iso = (value: string) => value ? new Date(value).toISOString() : null;

export function OperationalDocumentsClient({ staff, manager, operations, superAdmin }: { staff: boolean; manager: boolean; operations: boolean; superAdmin: boolean }) {
  const [mine, setMine] = useState<Mine[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [caps, setCaps] = useState({ publish: false, assign: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [versionId, setVersionId] = useState("");
  const [targetKind, setTargetKind] = useState("SITE_SERVICE");
  const [targetId, setTargetId] = useState("");
  const [contextKind, setContextKind] = useState("SITE_SERVICE");
  const [contextId, setContextId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [required, setRequired] = useState(true);
  const [assignmentReason, setAssignmentReason] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [replacementVersion, setReplacementVersion] = useState("");
  const [replacementAt, setReplacementAt] = useState("");
  const [reason, setReason] = useState("");
  const [replacementPreview, setReplacementPreview] = useState<{ key: string; rows: Array<{ id: string; title: string; recipients: number; acknowledged: number; asOf: string }> } | null>(null);
  const [ackConfirmed, setAckConfirmed] = useState<string[]>([]);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [opsKind, setOpsKind] = useState("SITE_SERVICE");
  const [opsId, setOpsId] = useState("");
  const [opsStatus, setOpsStatus] = useState<{ assignments: Array<{ assignmentId: string; title: string;
    version: number; required: boolean; recipientCount: number; acknowledgedCount: number }> ; asOf: string } | null>(null);
  const [grantPerson, setGrantPerson] = useState("");
  const [grantCapability, setGrantCapability] = useState("PUBLISH");
  const [grantUntil, setGrantUntil] = useState("");
  const [revokeGrantId, setRevokeGrantId] = useState("");

  const load = useCallback(async () => {
    if (staff) {
      const result = await jsonRequest("/api/operational-documents/my");
      setMine(result.assignments ?? []);
    }
    if (manager) {
      const result = await jsonRequest("/api/operational-documents");
      setDocuments(result.documents ?? []);
      setAssignments(result.assignments?.assignments ?? []);
      setCaps(result.capabilities);
    }
  }, [staff, manager]);
  useEffect(() => { void Promise.resolve().then(load).catch((caught) => setError(caught instanceof Error ? caught.message : "Documents unavailable")); }, [load]);
  async function act(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await work(); await load(); setMessage(success); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Action unavailable"); }
    finally { setBusy(false); }
  }
  const published = documents.flatMap((doc) => doc.controlled_document_versions
    .filter((version) => version.state === "PUBLISHED" && version.upload_state === "READY")
    .map((version) => ({ ...version, documentTitle: doc.title, documentId: doc.id })));
  const active = assignments.filter((item) => !item.closedAt || new Date(item.closedAt) > new Date());
  const grouped = new Map<string, Mine[]>();
  for (const item of mine) {
    const key = `${item.document_id}:${item.version_id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  const reading = Array.from(grouped.values()).map((items) => {
    const currentItems = items.filter((item) => item.current);
    const selected = currentItems.find((item) => item.opened) ?? currentItems[0] ?? items[0];
    return { ...selected, contexts: items.map((item) => item.context_label ?? item.target_kind.replaceAll("_", " ")),
      current: currentItems.length > 0, conflict: items.some((item) => item.conflict),
      opened: currentItems.some((item) => item.opened),
      acknowledged_at: items.find((item) => item.acknowledged_at)?.acknowledged_at ?? null,
      required: items.some((item) => item.required) };
  });
  const remaining = selected.length && replacementVersion ? active.filter((item) =>
    item.documentId === active.find((candidate) => candidate.id === selected[0])?.documentId &&
    item.versionId !== replacementVersion && !selected.includes(item.id)).length : 0;
  const previewKey = JSON.stringify({ ids: [...selected].sort(), replacementVersion, replacementAt });

  return <main className={`enterprise-main ${styles.page}`}>
    <div className="enterprise-page-heading"><div><p className="enterprise-eyebrow">Controlled operational instructions</p>
      <h1>{staff && !manager ? "My Documents" : "Operational documents"}</h1>
      <p>Exact published versions and factual acknowledgements. Reading is separate from training and qualification.</p></div></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.message} role="status">{message}</p>}

    {staff && <section className={styles.section} aria-labelledby="reading-heading"><h2 id="reading-heading">Required reading</h2>
      {!reading.length && <p>No current operational documents or acknowledgement history.</p>}
      <div className={styles.grid}>{reading.map((item) => <article key={`${item.document_id}:${item.version_id}`} className={styles.card}>
        <p className={styles.eyebrow}>{item.contexts.join(" · ")} · Version {item.version_number}</p>
        <h3>{item.title}</h3><p>Effective {dateText(item.effective_from)} · {item.required ? "Acknowledgement required" : "Optional reading"}</p>
        {item.conflict ? <p className={styles.error}>Conflicting current versions. Ask a manager to resolve the assignments.</p>
          : item.current ? <><p>{item.acknowledged_at ? `Acknowledged ${dateText(item.acknowledged_at)}` :
            item.opened ? "Opened; acknowledgement still required if marked required" : "Not opened"}</p>
            <a href={`/api/operational-documents/my/${item.id}/file`} target="_blank" rel="noreferrer"
              onClick={() => window.setTimeout(() => void load(), 1200)}>Open exact PDF</a>
            {item.opened && !item.acknowledged_at && <div className={styles.actions}>
              <label><input type="checkbox" checked={ackConfirmed.includes(item.id)} onChange={(event) =>
                setAckConfirmed((previous) => event.target.checked ? [...previous, item.id] : previous.filter((id) => id !== item.id))} />
                I acknowledge this exact version</label>
              <button disabled={busy || !ackConfirmed.includes(item.id)} onClick={() => void act(() =>
                jsonRequest(`/api/operational-documents/my/${item.id}/acknowledge`, "POST", { confirmed: true }),
                "Acknowledgement recorded for this version")}>Acknowledge version {item.version_number}</button></div>}</>
          : <p>Historical {item.close_kind?.toLowerCase() ?? "assignment"}.
            {item.acknowledged_at ? ` Acknowledged ${dateText(item.acknowledged_at)}.` : " No acknowledgement recorded."}
            {" "}PDF access has ended.</p>}
      </article>)}</div>
    </section>}

    {operations && <section className={styles.section} aria-labelledby="ops-doc-heading"><h2 id="ops-doc-heading">Operational document status</h2>
      <p>Factual acknowledgement counts for one exact operational context. No publishing or assignment actions.</p>
      <div className={styles.actions}><label>Context<select value={opsKind} onChange={(event) => setOpsKind(event.target.value)}>
        <option value="SITE">Site</option><option value="SITE_SERVICE">Site Service</option><option value="EVENT">Event</option></select></label>
        <label>Exact context ID<input value={opsId} onChange={(event) => setOpsId(event.target.value)} /></label>
        <button disabled={busy || !opsId} onClick={() => void act(async () => {
          const result = await jsonRequest(`/api/operational-documents/context-status?kind=${opsKind}&id=${encodeURIComponent(opsId)}`);
          setOpsStatus(result); }, "Current context status loaded")}>View status</button></div>
      {opsStatus && <><p>As of {dateText(opsStatus.asOf)}</p><div className={styles.grid}>
        {opsStatus.assignments.map((item) => <article className={styles.card} key={item.assignmentId}>
          <h3>{item.title} · v{item.version}</h3><p>{item.required ? "Acknowledgement required" : "Optional reading"}</p>
          <p>{item.acknowledgedCount} of {item.recipientCount} currently resolved people acknowledged.</p>
        </article>)}</div>{!opsStatus.assignments.length && <p>No current documents assigned to this exact context.</p>}</>}
    </section>}

    {manager && <>
      {superAdmin && <section className={styles.section} aria-labelledby="doc-grant-heading"><h2 id="doc-grant-heading">Finite Office capabilities</h2>
        <p>Grant Publisher and Assigner separately to a current Office Person for up to 90 days.</p>
        <div className={styles.form}><label>Office Person ID<input value={grantPerson} onChange={(event) => setGrantPerson(event.target.value)} /></label>
          <label>Capability<select value={grantCapability} onChange={(event) => setGrantCapability(event.target.value)}>
            <option value="PUBLISH">Controlled Document Publisher</option><option value="ASSIGN">Operational Document Assigner</option></select></label>
          <label>Expires at<input type="datetime-local" value={grantUntil} onChange={(event) => setGrantUntil(event.target.value)} /></label>
          <button disabled={busy || !grantPerson || !grantUntil} onClick={() => void act(async () => {
            const result = await jsonRequest("/api/operational-documents/grants", "POST", { personId: grantPerson,
              capability: grantCapability, expiresAt: iso(grantUntil) });
            setRevokeGrantId(result.grantId); }, "Finite grant created. Keep the grant ID for revocation")}>Grant capability</button></div>
        <div className={styles.actions}><label>Grant ID to revoke<input value={revokeGrantId} onChange={(event) => setRevokeGrantId(event.target.value)} /></label>
          <button disabled={busy || !revokeGrantId} onClick={() => void act(() => jsonRequest(
            "/api/operational-documents/grants", "DELETE", { grantId: revokeGrantId }), "Grant revoked")}>Revoke grant</button></div>
      </section>}
      {caps.publish && <section className={styles.section} aria-labelledby="catalog-heading"><h2 id="catalog-heading">Controlled catalogue</h2>
        <div className={styles.actions}><label>Document title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></label>
          <button disabled={busy || title.trim().length < 3} onClick={() => void act(() =>
            jsonRequest("/api/operational-documents", "POST", { title }), "Synthetic document created")}>Create document</button></div>
        <div className={styles.grid}>{documents.map((doc) => <article key={doc.id} className={styles.card}><h3>{doc.title}</h3>
          <p className={styles.eyebrow}>Controlled document {doc.id}</p>
          <label>Upload a synthetic PDF version<input type="file" accept="application/pdf,.pdf" onChange={(event) => {
            const file = event.target.files?.[0]; if (!file) return;
            void act(async () => { const form = new FormData(); form.set("file", file);
              const response = await fetch(`/api/controlled-documents/${doc.id}/versions`, { method: "POST", body: form });
              if (!response.ok) throw new Error("Private PDF upload failed"); }, "Version uploaded; publish deliberately");
          }} /></label>
          {doc.controlled_document_versions.sort((a, b) => b.version_number - a.version_number).map((version) =>
            <div key={version.id} className={styles.version}><strong>Version {version.version_number}</strong> · {version.state}
              {version.state === "DRAFT" && version.upload_state === "READY" &&
                <button disabled={busy} onClick={() => void act(() => jsonRequest(
                  `/api/controlled-documents/${doc.id}/versions/${version.id}/publish`, "POST",
                  { effectiveOn: new Date().toISOString().slice(0, 10) }), "Version published. Existing assignments are unchanged")}>Publish version</button>}
            </div>)}
        </article>)}</div></section>}

      {caps.assign && <section className={styles.section} aria-labelledby="assignment-heading"><h2 id="assignment-heading">Exact assignments</h2>
        <p>A Site Service or role without a qualifying current or future allocation remains manager-side configuration.</p>
        <div className={styles.form}>
          <label>Published version<select value={versionId} onChange={(event) => setVersionId(event.target.value)}><option value="">Choose exact version</option>
            {published.map((version) => <option key={version.id} value={version.id}>{version.documentTitle} · v{version.version_number}</option>)}</select></label>
          <label>Target kind<select value={targetKind} onChange={(event) => setTargetKind(event.target.value)}>
            {["SITE", "SITE_SERVICE", "EVENT", "OPERATIONAL_ROLE", "PERSON"].map((kind) => <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>)}</select></label>
          <label>Exact target ID<input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="UUID from source record" /></label>
          {targetKind === "OPERATIONAL_ROLE" && <><label>Context kind<select value={contextKind} onChange={(event) => setContextKind(event.target.value)}>
            <option value="SITE">Site</option><option value="SITE_SERVICE">Site Service</option><option value="EVENT">Event</option></select></label>
            <label>Exact context ID<input value={contextId} onChange={(event) => setContextId(event.target.value)} /></label></>}
          <label>Effective from<input type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label>
          <label>Effective until, optional<input type="datetime-local" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} /></label>
          <label><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} /> Acknowledgement required</label>
          <label>Assignment reason<textarea value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} maxLength={300} /></label>
          <button disabled={busy || !versionId || !targetId || !effectiveFrom || assignmentReason.trim().length < 3} onClick={() => void act(() => jsonRequest(
            "/api/operational-documents/assignments", "POST", { versionId, targetKind, targetId,
              contextKind: targetKind === "OPERATIONAL_ROLE" ? contextKind : null,
              contextId: targetKind === "OPERATIONAL_ROLE" ? contextId : null, required,
              effectiveFrom: iso(effectiveFrom), effectiveUntil: iso(effectiveUntil), reason: assignmentReason }), "Exact assignment created")}>Assign exact version</button>
        </div>
        <div className={styles.grid}>{assignments.map((item) => <article key={item.id} className={styles.card}>
          <h3>{item.title} · v{item.version}</h3><p>{item.targetKind.replaceAll("_", " ")} · {item.targetId}</p>
          <p>{item.required ? "Acknowledgement required" : "Optional"} · Effective {dateText(item.effectiveFrom)}
            {item.closedAt ? ` · ${item.closeKind} ${dateText(item.closedAt)}` : ""}</p>
          <p className={styles.eyebrow}>Assignment {item.id}</p>
          <a href={`/api/operational-documents/assignments/${item.id}/file`} target="_blank" rel="noreferrer">View controlled version</a>
          <div className={styles.actions}><button disabled={busy} onClick={() => void act(async () => {
            const result = await jsonRequest(`/api/operational-documents/assignments/${item.id}`);
            setStatus((previous) => ({ ...previous, [item.id]: `${result.acknowledgedCount} of ${result.recipientCount} acknowledged as of ${dateText(result.asOf)}` }));
          }, "Current factual status loaded")}>Check status</button>
            {!item.closedAt && <button disabled={busy} onClick={() => {
              const explanation = window.prompt("Reason for revoking this exact assignment (3–300 characters)");
              if (explanation) void act(() => jsonRequest(`/api/operational-documents/assignments/${item.id}`, "DELETE",
                { reason: explanation }), "Assignment revoked; acknowledgement history retained");
            }}>Revoke</button>}
            {!item.closedAt && <label><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) =>
              setSelected((previous) => event.target.checked ? [...previous, item.id] : previous.filter((id) => id !== item.id))} /> Select for replacement</label>}</div>
          {status[item.id] && <p>{status[item.id]}</p>}
        </article>)}</div>
      </section>}
      {caps.assign && <section className={styles.section} aria-labelledby="replace-heading"><h2 id="replace-heading">Explicit replacement</h2>
        <p>{selected.length} assignment{selected.length === 1 ? "" : "s"} selected. {remaining} older-version assignment{remaining === 1 ? "" : "s"} would remain for the same document.</p>
        <div className={styles.form}><label>Published replacement version<select value={replacementVersion} onChange={(event) => setReplacementVersion(event.target.value)}>
          <option value="">Choose exact version</option>{published.map((version) => <option key={version.id} value={version.id}>{version.documentTitle} · v{version.version_number}</option>)}</select></label>
          <label>Replacement effective date and time<input type="datetime-local" value={replacementAt} onChange={(event) => setReplacementAt(event.target.value)} /></label>
          <label>Reason, including partial exceptions<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} /></label>
          <button disabled={busy || !selected.length || !replacementVersion || !replacementAt} onClick={() => void act(async () => {
            const rows = await Promise.all(selected.map(async (id) => {
              const result = await jsonRequest(`/api/operational-documents/assignments/${id}`);
              return { id, title: assignments.find((item) => item.id === id)?.title ?? id,
                recipients: result.recipientCount, acknowledged: result.acknowledgedCount, asOf: result.asOf };
            }));
            setReplacementPreview({ key: previewKey, rows });
          }, "Replacement audience preview loaded")}>Preview selected</button>
          {replacementPreview?.key === previewKey && <div role="status"><p>Preview as of {dateText(replacementPreview.rows[0]?.asOf ?? null)}. Staff audience can change with allocations before the effective time.</p>
            {replacementPreview.rows.map((row) => <p key={row.id}>{row.title}: {row.recipients} resolved people; {row.acknowledged} acknowledged. Assignment {row.id}</p>)}
            <p>{remaining} older-version assignments remain outside this selection.</p></div>}
          <button disabled={busy || !selected.length || !replacementVersion || !replacementAt || reason.trim().length < 3 || replacementPreview?.key !== previewKey}
            onClick={() => void act(async () => { await jsonRequest("/api/operational-documents/replacements", "POST", {
              assignmentIds: selected, newVersionId: replacementVersion, effectiveAt: iso(replacementAt), reason });
              setSelected([]); setReplacementPreview(null); }, "Replacement scheduled; old acknowledgements remain historical")}>Replace selected assignments</button></div>
      </section>}
    </>}
  </main>;
}
