"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton, ConfirmDialog, EmptyState, FeedbackBanner, PageHeader, StatusBadge, type WorkflowStatus } from "@/components/ui/workflow";

type Review = { id: string; version_id: string; reviewer_person_id: string; decision: "ACCEPTED_AS_EVIDENCE" | "REJECTED";
  reason_code: string | null; reviewer_comment: string | null; decided_at: string };
type Version = { id: string; number: number; filename: string; byteSize: number; sha256: string;
  scanState: "NOT_SCANNED"; submittedAt: string; review: Review | null };
type Item = { id: string; title: string; status: "REQUESTED" | "SUBMITTED"; createdAt: string;
  targetPersonId: string; requesterPersonId: string; subjectName: string | null;
  workflowStatus: WorkflowStatus; hasPendingUpload: boolean; canUploadReplacement: boolean;
  version: Version | null; versions: Version[] };
type Site = { id: string; name: string; canManage: boolean; status: string };
type Target = { person_id: string; display_name: string };
type Props = { requestId?: string; mayCreate: boolean; mayUpload: boolean; mayReview: boolean; isSuperAdmin: boolean; personId: string };
const REASONS: Record<string, string> = {
  UNREADABLE: "Unreadable", WRONG_DOCUMENT: "Wrong document", INCOMPLETE: "Incomplete",
  EXPIRED_OR_OUTDATED: "Expired or outdated", DETAILS_DO_NOT_MATCH: "Details do not match", OTHER: "Other",
};
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function DocumentsClient({ requestId, mayCreate, mayUpload, mayReview, isSuperAdmin, personId }: Props) {
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
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [dialogKind, setDialogKind] = useState<"accept" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      if (!response.ok) { setMessageTone("error"); setMessage("Unable to load document requests."); return; }
      const result = await response.json();
      setItems(result.requests ?? []);
      if (requestId) {
        const detail = await fetch(`/api/documents/${requestId}`, { cache: "no-store" });
        if (!detail.ok) { setSelected(null); setMessageTone("error"); setMessage("Document request not found."); return; }
        setSelected((await detail.json()).request);
      } else setSelected(null);
    } catch { setMessageTone("error"); setMessage("Unable to load document requests."); }
  }, [requestId]);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
  useEffect(() => {
    if (!mayCreate) return;
    void fetch("/api/sites", { cache: "no-store" }).then(async (response) => {
      if (response.ok) setSites(((await response.json()).sites ?? []).filter((site: Site) => site.canManage && site.status === "ACTIVE"));
    }).catch(() => { /* creation form remains unavailable until sites can load */ });
  }, [mayCreate]);
  useEffect(() => {
    if (!mayCreate || (!siteId && !isSuperAdmin)) return;
    void fetch(`/api/documents/targets${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ""}`, { cache: "no-store" })
      .then(async (response) => { setTargets(response.ok ? (await response.json()).targets ?? [] : []); })
      .catch(() => setTargets([]));
  }, [mayCreate, isSuperAdmin, siteId]);

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetPersonId: targetId, siteId: siteId || null, title }) });
      if (!response.ok) throw new Error("create failed");
      router.push(`/documents/${(await response.json()).id}`);
    } catch { setMessageTone("error"); setMessage("Could not create this request. Check the selected person and Site."); setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!file || !selected) return;
    setBusy(true); setMessageTone("info"); setMessage("Uploading synthetic file. It is not submitted until the server confirms it.");
    const body = new FormData(); body.set("file", file);
    try {
      const response = await fetch(`/api/documents/${selected.id}/upload`, { method: "POST", body });
      if (!response.ok) {
        setMessageTone("error");
        setMessage(response.status === 409 ? "Upload conflict. Refresh the request before retrying." : "Upload is pending or failed. Retry the same file on this request.");
        return;
      }
      setMessageTone("success"); setMessage("Submitted — awaiting review. Malware scanning has not been performed.");
      setFile(null); await load();
    } catch { setMessageTone("error"); setMessage("Upload did not complete. Retry the same file on this request."); }
    finally { setBusy(false); }
  }
  async function submitReview() {
    if (!selected?.version || !dialogKind) return;
    if (dialogKind === "reject" && (!reason || comment.trim().length < 10 || comment.trim().length > 500)) {
      setReviewError("Choose a reason and enter 10–500 characters of actionable feedback."); return;
    }
    setBusy(true); setReviewError("");
    try {
      const response = await fetch(`/api/documents/${selected.id}/reviews`, { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId: selected.version.id, decision: dialogKind === "accept" ? "ACCEPTED_AS_EVIDENCE" : "REJECTED",
          reasonCode: dialogKind === "reject" ? reason : null, comment: dialogKind === "reject" ? comment.trim() : null }) });
      if (!response.ok) { setReviewError(response.status === 409 ? "This version has changed or was already reviewed. Close and refresh." : "Review could not be saved."); return; }
      setDialogKind(null); setReason(""); setComment("");
      setMessageTone("success"); setMessage(dialogKind === "accept" ? "Version accepted as evidence. This is not compliance verification." : "Version rejected. Staff can see your feedback and submit a replacement.");
      await load();
    } catch { setReviewError("Review could not be saved. Check your connection and retry."); }
    finally { setBusy(false); }
  }

  const queue = items.filter((item) => item.workflowStatus === "AWAITING_REVIEW" && item.targetPersonId !== personId);
  const mayDecide = mayReview && selected?.version && !selected.version.review && selected.targetPersonId !== personId;
  const maySubmit = mayUpload && selected && (selected.workflowStatus === "REQUESTED" || selected.canUploadReplacement);
  return <main className="enterprise-main documents-main">
    <PageHeader eyebrow="Synthetic personnel evidence" title="Documents"
      description="Request, submit and review private synthetic evidence. Evidence accepted here is not a compliance or deployment decision." />
    {message && <FeedbackBanner tone={messageTone}>{message}</FeedbackBanner>}
    <div className="documents-grid">
      <section className="documents-card" aria-labelledby="requests-heading">
        <h2 id="requests-heading">{mayReview ? "Review work" : "Your requests"}</h2>
        {mayReview && <div className="documents-queue-summary"><strong>{queue.length} awaiting review in recent requests</strong><span>Only requests you are authorised to see appear here.</span></div>}
        {items.length === 0 ? <EmptyState title="No document requests" description="Authorised synthetic requests will appear here." /> :
          <ul className="documents-list">{items.map((item) => <li key={item.id}>
            <Link href={`/documents/${item.id}`} aria-current={requestId === item.id ? "page" : undefined}>
              <strong>{mayReview ? (item.subjectName ?? "Security Staff") : item.title}</strong>
              {mayReview && <small>{item.title}</small>}
              <StatusBadge state={item.workflowStatus} />
            </Link>
          </li>)}</ul>}
        {mayCreate && <form className="documents-form" onSubmit={(event) => void createRequest(event)}>
          <h3>Create a synthetic request</h3>
          <label className="ui-field">Site context {isSuperAdmin ? "(optional)" : ""}
            <select value={siteId} onChange={(event) => { setSiteId(event.target.value); setTargetId(""); setTargets([]); }} required={!isSuperAdmin}>
              <option value="">{isSuperAdmin ? "No Site context" : "Choose an authorised Site"}</option>
              {sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}
            </select>
          </label>
          <label className="ui-field">Eligible Security Staff
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)} required>
              <option value="">Choose a synthetic Person</option>
              {targets.map((target) => <option value={target.person_id} key={target.person_id}>{target.display_name}</option>)}
            </select>
          </label>
          <label className="ui-field">Request title<input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} required /></label>
          <ActionButton disabled={busy || !targetId} type="submit">Create request</ActionButton>
        </form>}
      </section>
      <section className="documents-card" aria-labelledby="detail-heading">
        <h2 id="detail-heading">Request detail</h2>
        {!selected ? <EmptyState title={requestId ? "Request unavailable" : "Choose a request"}
          description={requestId ? "This request is not available to your account." : "Select a request to view its evidence and history."} /> : <>
          <div className="documents-record-header"><div><p className="eyebrow">{selected.subjectName ?? "Your evidence"}</p><h3>{selected.title}</h3>
            <p>Requested {date(selected.createdAt)}</p></div><StatusBadge state={selected.workflowStatus} /></div>
          {selected.hasPendingUpload && <FeedbackBanner>Upload pending. Any earlier rejection remains in the history until the replacement is submitted.</FeedbackBanner>}
          {selected.version ? <div className="documents-current">
            <h4>Current evidence · Version {selected.version.number}</h4>
            <p>Submitted {date(selected.version.submittedAt)} · {selected.version.filename}</p>
            <p className="documents-scan">Not scanned. Evidence review does not establish file safety, compliance or deployment eligibility.</p>
            <a className="ui-action ui-action--secondary" href={`/api/documents/${selected.id}/versions/${selected.version.id}/file`}>Download Version {selected.version.number}</a>
            {selected.version.review?.decision === "REJECTED" && <FeedbackBanner tone="error"><strong>{REASONS[selected.version.review.reason_code ?? ""] ?? "Rejected"}:</strong> {selected.version.review.reviewer_comment}</FeedbackBanner>}
            {mayDecide && <div className="documents-review-actions">
              <ActionButton type="button" onClick={() => { setReviewError(""); setDialogKind("accept"); }}>Accept as evidence</ActionButton>
              <ActionButton type="button" variant="caution" onClick={() => { setReviewError(""); setDialogKind("reject"); }}>Reject evidence</ActionButton>
            </div>}
          </div> : <p>No file has been submitted yet.</p>}
          {maySubmit && <form className="documents-form" onSubmit={(event) => void upload(event)}>
            <h4>{selected.canUploadReplacement ? `Submit Version ${(selected.version?.number ?? 0) + 1} replacement` : "Submit evidence"}</h4>
            {selected.canUploadReplacement && <p>Your rejected file remains in the history. Select a new synthetic file for the next version.</p>}
            <label className="ui-field">Choose one synthetic PDF, PNG or JPEG (maximum 5 MiB)
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
            </label>
            <ActionButton disabled={busy || !file} type="submit">{busy ? "Uploading…" : selected.canUploadReplacement ? "Upload replacement" : "Upload and submit"}</ActionButton>
          </form>}
          {selected.versions.length > 0 && <div className="documents-history"><h4>Version and decision history</h4>
            <ol>{selected.versions.map((version) => <li key={version.id}>
              <div><strong>Version {version.number}</strong><span>Submitted {date(version.submittedAt)}</span></div>
              <p>{version.review ? version.review.decision === "REJECTED" ? `Rejected · ${REASONS[version.review.reason_code ?? ""] ?? "Other"} · ${date(version.review.decided_at)}` : `Accepted as evidence · ${date(version.review.decided_at)}` : "Awaiting review"}</p>
              {version.review && <p>Reviewer Person ID: <code>{version.review.reviewer_person_id}</code></p>}
              {version.review?.decision === "REJECTED" && <p className="documents-feedback-text">{version.review.reviewer_comment}</p>}
              <a href={`/api/documents/${selected.id}/versions/${version.id}/file`}>Download Version {version.number}</a>
            </li>)}</ol>
          </div>}
        </>}
      </section>
    </div>
    <ConfirmDialog open={dialogKind !== null} title={dialogKind === "accept" ? "Accept this version as evidence?" : "Reject this version?"}
      description={dialogKind === "accept" ? `Version ${selected?.version?.number ?? ""} will be accepted as evidence only. This does not verify a requirement or employee.` : `Version ${selected?.version?.number ?? ""} stays in history. Staff will see your reason and feedback.`}
      confirmLabel={dialogKind === "accept" ? "Accept as evidence" : "Reject with feedback"}
      variant={dialogKind === "accept" ? "primary" : "caution"} busy={busy} error={reviewError}
      onClose={() => { setDialogKind(null); setReviewError(""); }} onConfirm={() => void submitReview()}>
      {dialogKind === "reject" && <div className="documents-review-fields">
        <label className="ui-field">Reason
          <select value={reason} onChange={(event) => setReason(event.target.value)} required aria-describedby="review-reason-help">
            <option value="">Choose a reason</option>
            {Object.entries(REASONS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </label>
        <p id="review-reason-help" className="ui-help">Use the closest reason; explain what the employee should correct below.</p>
        <label className="ui-field">Feedback for the employee
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} minLength={10} maxLength={500}
            required aria-describedby="review-comment-help" />
        </label>
        <p id="review-comment-help" className="ui-help">Required, 10–500 characters. Avoid unnecessary personal details.</p>
      </div>}
    </ConfirmDialog>
  </main>;
}
