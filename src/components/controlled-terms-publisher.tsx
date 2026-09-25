"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton, FeedbackBanner, LoadingBlock } from "@/components/ui/workflow";
import "./record-studies.css";

type PublisherVersion = { id: string; version_number: number; title: string; state: string;
  upload_state: string; published_at: string | null; effective_on: string | null };
type PublisherDocument = { id: string; title: string; versions: PublisherVersion[] };

export function ControlledTermsPublisher() {
  const [documents, setDocuments] = useState<PublisherDocument[]>([]);
  const [canPublish, setCanPublish] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/controlled-documents", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const body = await response.json();
      setCanPublish(Boolean(body.canPublish)); setDocuments(body.documents ?? []); setError("");
    } catch { setError("Controlled terms are unavailable. Refresh to try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  async function createDocument() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/controlled-documents", { method: "POST" });
      if (!response.ok) throw new Error();
      await load(); setMessage("Synthetic controlled document created. Upload its first PDF version.");
    } catch { setError("Controlled document creation was denied."); }
    finally { setBusy(false); }
  }
  async function uploadVersion(documentId: string, file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch(`/api/controlled-documents/${documentId}/versions`, { method: "POST", body: form });
      if (!response.ok) throw new Error();
      await load(); setMessage("Synthetic PDF uploaded as a draft. Publish the exact version when ready.");
    } catch { setError("Upload was denied. Use a synthetic PDF below 1 MB."); }
    finally { setBusy(false); }
  }
  async function publishVersion(documentId: string, versionId: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/controlled-documents/${documentId}/versions/${versionId}/publish`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ effectiveOn: new Date().toISOString().slice(0, 10) }),
      });
      if (!response.ok) throw new Error();
      await load(); setMessage("Exact synthetic version published. Earlier versions remain historical.");
    } catch { setError("Publication was denied. Resolve outstanding assignments and check authority."); }
    finally { setBusy(false); }
  }

  return <section className="controlled-publisher" aria-labelledby="controlled-publisher-title">
    <div className="controlled-publisher-heading"><div><p className="eyebrow">Administration / authorised publisher</p>
      <h2 id="controlled-publisher-title">Controlled terms versions</h2>
      <p>Publish exact synthetic PDF versions. Publication alone does not assign a version to a starter case.</p></div>
      {canPublish && <ActionButton onClick={() => void createDocument()} disabled={busy}>Create synthetic document</ActionButton>}</div>
    {loading ? <LoadingBlock label="Loading controlled terms…" /> : <>
      {error && <FeedbackBanner tone="error">{error}</FeedbackBanner>}
      {message && <FeedbackBanner tone="success">{message}</FeedbackBanner>}
      {!canPublish ? <p>Publication capability is not active for this account.</p> :
      <div className="controlled-publisher-list">{documents.map((doc) => <article key={doc.id} className="controlled-publisher-card">
        <h3>{doc.title}</h3>{doc.versions.length === 0 && <p>No version uploaded yet.</p>}
        {doc.versions.map((version) => <div key={version.id} className="controlled-publisher-version">
          <div><strong>Version {version.version_number}</strong> · {version.state.replaceAll("_", " ")}
            {version.published_at && <span> · Published {new Date(version.published_at).toLocaleString("en-GB")}</span>}</div>
          <div className="controlled-publisher-actions">
            {version.upload_state === "READY" && <a className="ui-action ui-action--secondary"
              href={`/api/controlled-documents/${doc.id}/versions/${version.id}/file`} target="_blank" rel="noreferrer">Preview exact PDF</a>}
            {version.state === "DRAFT" && version.upload_state === "READY" &&
              <ActionButton onClick={() => void publishVersion(doc.id, version.id)} disabled={busy}>Publish Version {version.version_number}</ActionButton>}
          </div>
        </div>)}
        {!doc.versions.some((version) => version.state === "DRAFT") && <label className="ui-field">Upload next synthetic PDF version
          <input type="file" accept="application/pdf,.pdf" disabled={busy}
            onChange={(event) => { const file = event.currentTarget.files?.[0];
              if (file) void uploadVersion(doc.id, file); event.currentTarget.value = ""; }} /></label>}
      </article>)}</div>}
    </>}
  </section>;
}
