"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Item = {
  id: string; title: string; status: "REQUESTED" | "SUBMITTED"; createdAt: string;
  targetPersonId: string; version: null | { id: string; filename: string; byteSize: number; scanState: string };
};
type Site = { id: string; name: string; canManage: boolean; status: string };
type Target = { person_id: string; display_name: string };
type Props = { requestId?: string; mayCreate: boolean; mayUpload: boolean; isSuperAdmin: boolean };

export function DocumentsClient({ requestId, mayCreate, mayUpload, isSuperAdmin }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("Synthetic personnel document");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/documents", { cache: "no-store" });
    if (!response.ok) { setMessage("Unable to load document requests."); return; }
    const result = await response.json();
    setItems(result.requests ?? []);
    if (requestId) {
      const detail = await fetch(`/api/documents/${requestId}`, { cache: "no-store" });
      if (!detail.ok) { setSelected(null); setMessage("Document request not found."); return; }
      setSelected((await detail.json()).request);
    }
  }, [requestId]);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
  useEffect(() => {
    if (!mayCreate) return;
    void fetch("/api/sites", { cache: "no-store" }).then(async (response) => {
      if (response.ok) setSites(((await response.json()).sites ?? []).filter((site: Site) => site.canManage && site.status === "ACTIVE"));
    });
  }, [mayCreate]);
  useEffect(() => {
    if (!mayCreate || (!siteId && !isSuperAdmin)) return;
    void fetch(`/api/documents/targets${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ""}`, { cache: "no-store" })
      .then(async (response) => { setTargets(response.ok ? (await response.json()).targets ?? [] : []); });
  }, [mayCreate, isSuperAdmin, siteId]);

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetPersonId: targetId, siteId: siteId || null, title }) });
    if (response.ok) {
      const result = await response.json();
      router.push(`/documents/${result.id}`);
    } else { setMessage("Could not create this request."); setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !selected) return;
    setBusy(true); setMessage("Uploading synthetic file. This is not submitted until the server confirms it.");
    const body = new FormData(); body.set("file", file);
    try {
      const response = await fetch(`/api/documents/${selected.id}/upload`, { method: "POST", body });
      if (!response.ok) { setMessage(response.status === 409 ? "Upload conflict. Refresh the request before retrying." : "Upload is pending or failed. Retry the same file on this request."); return; }
      setMessage("Submitted (not reviewed). Malware scanning has not been performed.");
      setFile(null); await load();
    } catch { setMessage("Upload did not complete. Retry the same file on this request."); }
    finally { setBusy(false); }
  }

  return <main className="enterprise-main documents-main">
    <p className="eyebrow">Synthetic document evidence</p>
    <h1>Documents</h1>
    <p className="enterprise-intro">Private document requests and submitted files in this development workspace. Submitted evidence has not been reviewed or verified.</p>
    {message && <p className="documents-message" role="status">{message}</p>}
    <div className="documents-grid">
      <section className="documents-card" aria-labelledby="requests-heading">
        <h2 id="requests-heading">Your document requests</h2>
        {items.length === 0 ? <p>No document requests are available to your account.</p> : <ul className="documents-list">{items.map((item) =>
          <li key={item.id}><Link href={`/documents/${item.id}`} aria-current={requestId === item.id ? "page" : undefined}><strong>{item.title}</strong><span>{item.status === "SUBMITTED" ? "Submitted (not reviewed)" : "Requested"}</span></Link></li>)}</ul>}
        {mayCreate && <form className="documents-form" onSubmit={(event) => void createRequest(event)}>
          <h3>Create a synthetic request</h3>
          <label>Site context (optional for Super Admin)
            <select value={siteId} onChange={(event) => { setSiteId(event.target.value); setTargetId(""); setTargets([]); }} required={!isSuperAdmin}>
              <option value="">{isSuperAdmin ? "No Site context" : "Choose an authorised Site"}</option>
              {sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}
            </select>
          </label>
          <label>Eligible Security Staff
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)} required>
              <option value="">Choose a synthetic Person</option>
              {targets.map((target) => <option value={target.person_id} key={target.person_id}>{target.display_name}</option>)}
            </select>
          </label>
          <label>Request title<input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} required /></label>
          <button disabled={busy || !targetId} type="submit">Create request</button>
        </form>}
      </section>
      <section className="documents-card" aria-labelledby="detail-heading">
        <h2 id="detail-heading">Request detail</h2>
        {!selected ? <p>{requestId ? "This request is not available to your account." : "Choose one of your requests."}</p> : <>
          <h3>{selected.title}</h3>
          <p><strong>Status:</strong> {selected.status === "SUBMITTED" ? "Submitted (not reviewed)" : "Requested"}</p>
          {selected.version && <div className="documents-submission">
            <p><strong>Submitted file:</strong> {selected.version.filename}</p>
            <p><strong>Scanning:</strong> Not scanned. This submission has not been verified.</p>
            <a className="documents-download" href={`/api/documents/${selected.id}/file`}>Download submitted synthetic file</a>
          </div>}
          {selected.status === "REQUESTED" && mayUpload && <form className="documents-form" onSubmit={(event) => void upload(event)}>
            <label>Choose one synthetic PDF, PNG or JPEG (maximum 5 MiB)
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
            </label>
            <button disabled={busy || !file} type="submit">{busy ? "Uploading…" : "Upload and submit"}</button>
          </form>}
        </>}
      </section>
    </div>
  </main>;
}
