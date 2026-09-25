"use client";
import "./record-studies.css";
import { RecordSectionTracker } from "./record-section-tracker";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton, ConfirmDialog, EmptyState, FeedbackBanner, LoadingBlock, PageHeader } from "@/components/ui/workflow";
import { Progress } from "@/components/ui/progress";

type Summary = { id: string; starterName: string; siteName: string; intendedRole: string; state: string; createdAt: string; templateVersion: number };
type Requirement = { id: string; code: string; title: string; position: number; state: string; nextAction: string;
  actor: string; documentRequestId: string | null; evidenceState: string | null; acceptedVersionId: string | null;
  feedback: string | null; verifiedAt: string | null; syntheticValidUntil: string | null; siaSubmissionId: string | null;
  controlled: { assignmentId: string; versionId: string; title: string; versionNumber: number;
    publishedAt: string | null; effectiveOn: string | null; scanState: string;
    accessedAt: string | null; acknowledgedAt: string | null; acknowledgedBy: string | null } | null };
type Case = { id: string; starterName: string; personId: string; siteName: string; intendedRole: string;
  templateVersion: number; state: string; createdAt: string; canManage: boolean; canIssueIdentity: boolean; verifiedCount: number; totalCount: number;
  requirements: Requirement[];
  profile: Record<string, string | null> | null; submittedProfile: Record<string, string | null> | null; profileSubmittedAt: string | null;
  siaCredential: { category: string; synthetic_reference: string; expires_on: string } | null;
  submittedSia: { id: string; category: string; synthetic_reference: string; expires_on: string } | null; siaSubmittedAt: string | null };
type Site = { id: string; name: string; status: string; canManage: boolean };
type Target = { person_id: string; display_name: string };
type PublisherVersion = { id: string; version_number: number; title: string; state: string;
  upload_state: string; published_at: string | null; effective_on: string | null };
type PublisherDocument = { id: string; title: string; versions: PublisherVersion[] };
const label: Record<string,string> = {
  DRAFT: "Draft", IN_PROGRESS: "In progress", CANCELLED: "Cancelled", NOT_STARTED: "Not started",
  AWAITING_EVIDENCE: "Awaiting evidence", UNDER_REVIEW: "Under review", ACTION_REQUIRED: "Action required",
  VERIFIED: "Verified", EXPIRED: "Expired", NOT_AVAILABLE: "Not available",
  NOT_CONNECTED: "Not connected", NOT_CONFIGURED: "Not configured", COMPLETE: "Complete — self-submitted",
  AWAITING_SUBMISSION: "Needs submission", UPDATE_NEEDS_SUBMISSION: "Update needs submission",
  AWAITING_EVIDENCE_REQUEST: "Office request needed",
  AWAITING_DOCUMENT_ACCESS: "Document access needed", AWAITING_ACKNOWLEDGEMENT: "Acknowledgement needed",
  ACKNOWLEDGED: "Acknowledged",
};
function requirementLabel(requirement: Requirement) {
  if (requirement.code !== "IDENTITY_EVIDENCE") return label[requirement.state] ?? requirement.state;
  if (requirement.state === "VERIFIED") return "Verified — synthetic workflow";
  if (requirement.state === "UNDER_REVIEW" && requirement.evidenceState === "ACCEPTED_AS_EVIDENCE")
    return "Office verification needed";
  if (requirement.state === "UNDER_REVIEW") return "Submitted — awaiting review";
  return label[requirement.state] ?? requirement.state;
}

export function OnboardingClient({ office, selectedCaseId }: { office: boolean; selectedCaseId?: string }) {
  const router = useRouter();
  const [cases, setCases] = useState<Summary[]>([]);
  const [detail, setDetail] = useState<Case | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [verify, setVerify] = useState<Requirement | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [publisherDocs, setPublisherDocs] = useState<PublisherDocument[]>([]);
  const [canPublish, setCanPublish] = useState(false);
  const [selectedControlledVersion, setSelectedControlledVersion] = useState("");
  const [showOlderCases, setShowOlderCases] = useState(false);

  const load = useCallback(async () => {
    try {
      const [listing, selected] = await Promise.all([
        fetch("/api/onboarding", { cache: "no-store" }),
        selectedCaseId ? fetch(`/api/onboarding/${selectedCaseId}`, { cache: "no-store" }) : Promise.resolve(null),
      ]);
      if (!listing.ok) throw new Error("list unavailable");
      setCases((await listing.json()).cases ?? []);
      if (selected) {
        if (!selected.ok) throw new Error("case unavailable");
        setDetail((await selected.json()).case);
      } else setDetail(null);
      setError(false);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [selectedCaseId]);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
  const loadPublisher = useCallback(async () => {
    const response = await fetch("/api/controlled-documents", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setCanPublish(Boolean(body.canPublish)); setPublisherDocs(body.documents ?? []);
  }, []);
  useEffect(() => { if (office) void Promise.resolve().then(() => loadPublisher()); }, [office, loadPublisher]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);
  useEffect(() => {
    if (!office) return;
    void fetch("/api/sites?search=Synthetic Static Security Site", { cache: "no-store" })
      .then(async (response) => { if (response.ok) setSites(((await response.json()).sites ?? [])
        .filter((site: Site) => site.name === "Synthetic Static Security Site" && site.status === "ACTIVE" && site.canManage)); })
      .catch(() => {});
  }, [office]);
  useEffect(() => {
    if (!office || !siteId) return;
    void fetch(`/api/documents/targets?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" })
      .then(async (response) => { setTargets(response.ok ? (await response.json()).targets ?? [] : []); })
      .catch(() => setTargets([]));
  }, [office, siteId]);

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetPersonId: targetId, siteId, requestKey }) });
      if (!response.ok) throw new Error("create denied");
      const id = (await response.json()).id;
      setRequestKey(crypto.randomUUID());
      router.push(`/onboarding/${id}`);
      router.refresh();
    } catch { setMessage("Case could not be created. Check the synthetic Site and Staff assignment, then retry."); }
    finally { setBusy(false); }
  }
  async function action(path: string) {
    if (!detail) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/onboarding/${detail.id}/${path}`, { method: "POST" });
      if (!response.ok) throw new Error("action denied");
      await load();
      setMessage(path === "rtw-request" ? "Synthetic RTW evidence request issued." :
        path === "identity-request" ? "Protected synthetic Identity Evidence request issued." :
          path === "start" ? "Case started." : "Case cancelled; history retained.");
    } catch { setMessage("Action could not be completed. Refresh and check your current authority."); }
    finally { setBusy(false); }
  }
  async function verifyEvidenceRequirement() {
    if (!detail || !verify?.acceptedVersionId) return;
    setBusy(true); setMessage("");
    try {
      const identity = verify.code === "IDENTITY_EVIDENCE";
      const response = await fetch(`/api/onboarding/${detail.id}/${identity ? "identity-verify" : "verify"}`, { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requirementId: verify.id, versionId: verify.acceptedVersionId }) });
      if (!response.ok) throw new Error("verification denied");
      setVerify(null); await load();
      setMessage(identity ? "Synthetic Identity Evidence workflow verification recorded. Identity was not authenticated." :
        "Synthetic RTW workflow verification recorded. This is not a statutory Right to Work check.");
    } catch { setMessage("Verification was not recorded. Check the exact accepted version and your authority."); }
    finally { setBusy(false); }
  }
  async function siaAction(path: "sia-request" | "sia-verify", requirement: Requirement) {
    if (!detail) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/onboarding/${detail.id}/${path}`, { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(path === "sia-verify" ?
          { requirementId: requirement.id, submissionId: requirement.siaSubmissionId, versionId: requirement.acceptedVersionId } :
          { requirementId: requirement.id, submissionId: requirement.siaSubmissionId }) });
      if (!response.ok) throw new Error("Action denied");
      await load();
      setMessage(path === "sia-request" ? "Protected synthetic SIA evidence request issued." :
        "Separate synthetic SIA verification recorded. No register check was made.");
    } catch { setMessage("SIA action could not be completed. Check the exact submission, evidence and your current authority."); }
    finally { setBusy(false); }
  }
  async function controlledAction(path: string, body?: object) {
    if (!detail) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/onboarding/${detail.id}/contract/${path}`, { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
      if (!response.ok) throw new Error("action denied");
      setConfirmed(false); await load();
      setMessage(path === "assign" ? "Exact published synthetic document assigned to this case." :
        "Exact synthetic document version acknowledged. This is not a signature.");
    } catch { setMessage("Controlled document action could not be completed. Check exact-version access and authority."); }
    finally { setBusy(false); }
  }
  async function createControlledDocument() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/controlled-documents", { method: "POST" });
      if (!response.ok) throw new Error("denied");
      await loadPublisher(); setMessage("Synthetic controlled document created. Upload the first PDF version.");
    } catch { setMessage("Controlled document creation could not be completed."); }
    finally { setBusy(false); }
  }
  async function uploadControlled(documentId: string, file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch(`/api/controlled-documents/${documentId}/versions`, { method: "POST", body: form });
      if (!response.ok) throw new Error("denied");
      await loadPublisher(); setMessage("Synthetic PDF uploaded as a Draft. Publish the exact version when ready.");
    } catch { setMessage("PDF upload could not be completed. Use a synthetic PDF below 1 MB."); }
    finally { setBusy(false); }
  }
  async function publishControlled(documentId: string, versionId: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/controlled-documents/${documentId}/versions/${versionId}/publish`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ effectiveOn: new Date().toISOString().slice(0, 10) }),
      });
      if (!response.ok) throw new Error("denied");
      await loadPublisher(); setMessage("Exact synthetic version published. Earlier versions and acknowledgements remain historical.");
    } catch { setMessage("Publication could not be completed. Resolve outstanding assignments and check authority."); }
    finally { setBusy(false); }
  }

  const shownCases = office || showOlderCases ? cases : cases.slice(0, 5);
  return <main className={`enterprise-main onboarding-main${selectedCaseId ? " onboarding-record" : ""}`}>
    {!selectedCaseId && <PageHeader eyebrow="Synthetic development onboarding" title={office ? "Onboarding" : "My Onboarding"}
      description={office ? "Manage each starter checklist. Evidence review and requirement verification remain separate decisions."
        : "See what is complete and what needs your attention next."} />}
    {selectedCaseId && <Link className="crm-record-back" href="/onboarding">← {office ? "Onboarding cases" : "My cases"}</Link>}
    {selectedCaseId && detail && <><header className="onboarding-record-header"><h1>{office ? detail.starterName : detail.intendedRole.replaceAll("_"," ")}</h1><div className="crm-record-identity"><span>Onboarding</span><strong>{label[detail.state] ?? detail.state}</strong></div><p>{office ? `${detail.intendedRole.replaceAll("_"," ")} · ` : ""}{detail.siteName}</p><p>Template Version {detail.templateVersion} · Created {new Date(detail.createdAt).toLocaleString("en-GB")}</p></header>
      <nav className="onboarding-record-sections" aria-label="Onboarding case sections"><a href="#onboarding-overview">Overview</a>{office && detail.templateVersion >= 2 && <a href="#onboarding-submitted">Submitted information</a>}<a href="#onboarding-requirements">Requirements</a></nav></>}
      {selectedCaseId && detail && <RecordSectionTracker label="Onboarding case sections" />}
    {office && <FeedbackBanner>Development workflow only. No legal Right to Work check, compliance decision or deployment approval is recorded here.</FeedbackBanner>}
    {message && <FeedbackBanner tone={message.includes("could not") || message.includes("not recorded") ? "error" : "success"}>{message}</FeedbackBanner>}
    {error && <FeedbackBanner tone="error">Onboarding is unavailable. Refresh to try again.</FeedbackBanner>}
    {office && canPublish && !selectedCaseId && <section className="controlled-publisher" aria-labelledby="controlled-publisher-title">
      <div className="controlled-publisher-heading"><div><p className="eyebrow">Scoped synthetic publisher</p>
        <h2 id="controlled-publisher-title">Controlled terms</h2>
        <p>Publish exact development-only PDF versions. Publication does not grant access to a starter case.</p></div>
        <ActionButton onClick={() => void createControlledDocument()} disabled={busy}>Create synthetic document</ActionButton></div>
      <div className="controlled-publisher-list">{publisherDocs.map((doc) => <article key={doc.id} className="controlled-publisher-card">
        <h3>{doc.title}</h3>{doc.versions.length === 0 && <p>No version uploaded yet.</p>}
        {doc.versions.map((version) => <div key={version.id} className="controlled-publisher-version">
          <div><strong>Version {version.version_number}</strong> · {label[version.state] ?? version.state}
            {version.published_at && <span> · Published {new Date(version.published_at).toLocaleString("en-GB")}</span>}</div>
          <div className="controlled-publisher-actions">
            {version.upload_state === "READY" && <a className="ui-action ui-action--secondary"
              href={`/api/controlled-documents/${doc.id}/versions/${version.id}/file`} target="_blank" rel="noreferrer">Preview exact PDF</a>}
            {version.state === "DRAFT" && version.upload_state === "READY" &&
              <ActionButton onClick={() => void publishControlled(doc.id, version.id)} disabled={busy}>Publish Version {version.version_number}</ActionButton>}
          </div>
        </div>)}
        {!doc.versions.some((version) => version.state === "DRAFT") && <label className="ui-field">Upload next synthetic PDF version
          <input type="file" accept="application/pdf,.pdf" disabled={busy}
            onChange={(event) => { const file = event.currentTarget.files?.[0];
              if (file) void uploadControlled(doc.id, file); event.currentTarget.value = ""; }} /></label>}
      </article>)}</div>
    </section>}
    <div className="onboarding-grid">
      {!selectedCaseId && <section className="onboarding-panel" aria-labelledby="onboarding-list-title">
        <h2 id="onboarding-list-title">{office ? "Authorised starters" : "My cases"}</h2>
        {loading ? <LoadingBlock label="Loading onboarding cases…" /> : cases.length ?
          <><ul className="onboarding-list">{shownCases.map((c) => <li key={c.id}><Link href={`/onboarding/${c.id}`} aria-current={selectedCaseId === c.id ? "page" : undefined}>
            <strong>{office ? c.starterName : c.intendedRole.replaceAll("_", " ")}</strong>
            <span>{c.siteName} · Template V{c.templateVersion} · {label[c.state] ?? c.state} · Started {new Date(c.createdAt).toLocaleString("en-GB")}</span></Link></li>)}</ul>
          {!office && cases.length > 5 && <button type="button" className="onboarding-history-toggle" onClick={() => setShowOlderCases(!showOlderCases)}>
            {showOlderCases ? "Show current cases" : `Show ${cases.length - 5} older synthetic cases`}</button>}</> :
          <EmptyState title="No onboarding cases" description={office ? "Start a synthetic Security Staff case below." : "An authorised Office user will start your onboarding case."} />}
        {office && <form className="onboarding-form" onSubmit={(event) => void createCase(event)}>
          <h3>Start a synthetic starter</h3>
          <label className="ui-field">Synthetic static-security Site
            <select value={siteId} onChange={(event) => { setSiteId(event.target.value); setTargetId(""); setTargets([]); }} required>
              <option value="">Choose Site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select></label>
          <label className="ui-field">Eligible synthetic Security Staff
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)} required>
              <option value="">Choose Staff</option>{targets.map((target) => <option key={target.person_id} value={target.person_id}>{target.display_name}</option>)}
            </select></label>
          {sites.length === 0 && <p className="ui-help">Create and activate “Synthetic Static Security Site” in <Link href="/sites">Sites</Link>, then assign a synthetic Security Staff member.</p>}
          <ActionButton type="submit" disabled={busy || !siteId || !targetId}>{busy ? "Creating…" : "Create draft case"}</ActionButton>
        </form>}
      </section>}
      <section className="onboarding-panel" aria-label={selectedCaseId ? "Onboarding case content" : undefined} aria-labelledby={selectedCaseId ? undefined : "onboarding-detail-title"}>
        {!selectedCaseId && <h2 id="onboarding-detail-title">Case detail</h2>}
        {loading && selectedCaseId ? <LoadingBlock label="Loading this onboarding case…" /> : !detail ? <EmptyState title={selectedCaseId ? "Case unavailable" : "Choose a case"}
          description={selectedCaseId ? "This case is not available to your account." : "Open a case to see its checklist and next actions."} /> : <>
          {!selectedCaseId && <div className="onboarding-summary">
            <div><p className="eyebrow">{office ? detail.starterName : "Your starter checklist"}</p>
              <h3>{detail.intendedRole.replaceAll("_", " ")}</h3><p>{detail.siteName} · Template Version {detail.templateVersion} · Created {new Date(detail.createdAt).toLocaleString("en-GB")}</p></div>
            <span className="onboarding-state">{label[detail.state] ?? detail.state}</span>
          </div>}
          {selectedCaseId && <h2>Overview</h2>}
          <div id="onboarding-overview" className="onboarding-progress"><strong>{detail.verifiedCount} of {detail.totalCount} requirements complete</strong>
            <Progress value={100 * detail.verifiedCount / detail.totalCount} aria-label={`${detail.verifiedCount} of ${detail.totalCount} requirements complete`} />
            <p>Mandatory unavailable or unconnected requirements remain outstanding. This is not a compliance or deployment score.</p></div>
          {!office && <p className="onboarding-development-note">Synthetic workflow only. No legal checking or deployment decision is recorded here.</p>}
          {office && detail.templateVersion >= 2 && <div id="onboarding-submitted" className="onboarding-private-summary">
            {selectedCaseId ? <h2>Submitted starter information</h2> : <h3>Submitted starter information</h3>}
            <p>Current Personal Details are visible only for this authorised case. Office cannot edit them here.</p>
            {detail.profile ? <dl>
              <div><dt>Legal name</dt><dd>{detail.profile.legal_first_name ?? "—"} {detail.profile.surname ?? ""}</dd></div>
              <div><dt>Contact email</dt><dd>{detail.profile.contact_email ?? "—"}</dd></div>
              <div><dt>Mobile</dt><dd>{detail.profile.mobile ?? "—"}</dd></div>
              <div><dt>Address</dt><dd>{[detail.profile.address_line1, detail.profile.address_line2, detail.profile.town_city, detail.profile.postcode].filter(Boolean).join(", ") || "—"}</dd></div>
              <div><dt>Submitted revision</dt><dd>{detail.submittedProfile ? `${detail.submittedProfile.id} · ${detail.profileSubmittedAt ? new Date(detail.profileSubmittedAt).toLocaleString("en-GB") : ""}` : "Not submitted"}</dd></div>
            </dl> : <p>Personal Details have not been saved.</p>}
            {detail.profile && detail.submittedProfile &&
              ["legal_first_name", "surname", "contact_email", "mobile", "address_line1", "town_city", "postcode"]
                .some((field) => detail.profile?.[field] !== detail.submittedProfile?.[field]) &&
              <FeedbackBanner tone="error">Current required Personal Details differ from the last submitted revision. Staff must resubmit; the historical revision remains unchanged.</FeedbackBanner>}
            {detail.siaCredential && <dl>
              <div><dt>Synthetic SIA category</dt><dd>{detail.siaCredential.category.replaceAll("_", " ")}</dd></div>
              <div><dt>Reference</dt><dd>{detail.siaCredential.synthetic_reference || "—"}</dd></div>
              <div><dt>Expiry</dt><dd>{detail.siaCredential.expires_on || "—"} (Europe/London date)</dd></div>
              <div><dt>Submitted revision</dt><dd>{detail.submittedSia ? `${detail.submittedSia.id} · ${detail.siaSubmittedAt ? new Date(detail.siaSubmittedAt).toLocaleString("en-GB") : ""}` : "Not submitted"}</dd></div>
            </dl>}
            {detail.siaCredential && detail.submittedSia &&
              (detail.siaCredential.synthetic_reference !== detail.submittedSia.synthetic_reference ||
                detail.siaCredential.expires_on !== detail.submittedSia.expires_on) &&
              <FeedbackBanner tone="error">Current synthetic SIA details differ from the submitted credential revision. A new submission, evidence and decision are needed.</FeedbackBanner>}
          </div>}
          {office && detail.canManage && detail.state === "DRAFT" && <ActionButton onClick={() => void action("start")} disabled={busy}>Start onboarding</ActionButton>}
          {selectedCaseId && <h2>Requirements</h2>}
          <ol id="onboarding-requirements" className="onboarding-requirements">{detail.requirements.map((r) => <li key={r.id}>
            <div className="onboarding-requirement-head"><h4>{r.position}. {r.title}</h4><span className={`onboarding-badge onboarding-badge--${r.state.toLowerCase()}`}>{requirementLabel(r)}</span></div>
            <p>{r.nextAction}</p><small>Next actor: {r.actor.replaceAll("_", " ").toLowerCase()}</small>
            {r.evidenceState && <p className="onboarding-evidence">Evidence: {r.evidenceState.replaceAll("_", " ").toLowerCase()}. Requirement: {label[r.state] ?? r.state}.</p>}
            {r.feedback && <FeedbackBanner tone="error">Evidence review feedback: {r.feedback}</FeedbackBanner>}
            {r.documentRequestId && <Link className="ui-action ui-action--secondary" href={`/documents/${r.documentRequestId}${r.acceptedVersionId ? `?version=${r.acceptedVersionId}` : ""}`}>
              {office ? "Open protected evidence" : "Open my evidence request"}</Link>}
            {r.code === "CONTRACT_TERMS" && r.controlled && <div className="controlled-assignment">
              <strong>{r.controlled.title}</strong>
              <p>Version {r.controlled.versionNumber} · Published {r.controlled.publishedAt ? new Date(r.controlled.publishedAt).toLocaleString("en-GB") : "—"}
                {r.controlled.effectiveOn ? ` · Effective ${r.controlled.effectiveOn}` : ""} · {r.controlled.scanState}</p>
              <a className="ui-action ui-action--secondary" href={`/api/onboarding/${detail.id}/contract/file`}
                target="_blank" rel="noreferrer">Open exact synthetic PDF</a>
              <p>{r.controlled.accessedAt ? `Document accessed ${new Date(r.controlled.accessedAt).toLocaleString("en-GB")}. This does not prove reading or comprehension.` :
                "The exact PDF must be opened before acknowledgement. Opening alone does not acknowledge it."}</p>
              {r.controlled.acknowledgedAt && <p><strong>Acknowledged — Version {r.controlled.versionNumber}</strong> ·
                {" "}{new Date(r.controlled.acknowledgedAt).toLocaleString("en-GB")}</p>}
              {!office && !r.controlled.acknowledgedAt && detail.state === "IN_PROGRESS" && <div className="controlled-confirm">
                <ActionButton variant="secondary" onClick={() => void load()} disabled={busy}>Refresh access status</ActionButton>
                {r.controlled.accessedAt && <><label><input type="checkbox" checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)} />
                  I confirm that this exact document version was made available to me and I acknowledge it.</label>
                  <ActionButton onClick={() => void controlledAction("acknowledge", { confirmed: true })}
                    disabled={busy || !confirmed}>Acknowledge Version {r.controlled.versionNumber}</ActionButton></>}
              </div>}
            </div>}
            {office && canPublish && detail.canManage && detail.state === "IN_PROGRESS" && r.code === "CONTRACT_TERMS" && !r.controlled &&
              <div className="controlled-assign-form"><label className="ui-field">Published synthetic terms version
                <select value={selectedControlledVersion} onChange={(event) => setSelectedControlledVersion(event.target.value)}>
                  <option value="">Choose exact version</option>
                  {publisherDocs.flatMap((doc) => doc.versions.filter((v) => v.state === "PUBLISHED")
                    .map((v) => <option key={v.id} value={v.id}>{doc.title} · Version {v.version_number} · Published {v.published_at ? new Date(v.published_at).toLocaleString("en-GB") : "unknown"}</option>))}
                </select></label>
                <ActionButton onClick={() => void controlledAction("assign", { versionId: selectedControlledVersion })}
                  disabled={busy || !selectedControlledVersion}>Assign exact published version</ActionButton></div>}
            {!office && detail.templateVersion >= 2 && detail.state === "IN_PROGRESS" &&
              (r.code === "PERSONAL_DETAILS" || r.code === "SIA_LICENCE") &&
              <Link className="ui-action ui-action--secondary" href="/profile">
                {r.code === "PERSONAL_DETAILS" ? "Open Personal Details" : "Open synthetic SIA details"}</Link>}
            {office && detail.canManage && detail.state === "IN_PROGRESS" && r.code === "RIGHT_TO_WORK" && !r.documentRequestId &&
              <ActionButton onClick={() => void action("rtw-request")} disabled={busy}>Issue synthetic evidence request</ActionButton>}
            {office && detail.canManage && detail.state === "IN_PROGRESS" && r.code === "RIGHT_TO_WORK" && r.acceptedVersionId && r.state === "UNDER_REVIEW" &&
              <ActionButton onClick={() => setVerify(r)} disabled={busy}>Verify synthetic RTW workflow</ActionButton>}
            {office && detail.canIssueIdentity && detail.state === "IN_PROGRESS" && detail.templateVersion === 2 &&
              r.code === "IDENTITY_EVIDENCE" && !r.documentRequestId &&
              <ActionButton onClick={() => void action("identity-request")} disabled={busy}>Issue protected Identity Evidence request</ActionButton>}
            {office && detail.canManage && detail.state === "IN_PROGRESS" && r.code === "IDENTITY_EVIDENCE" &&
              r.acceptedVersionId && r.state === "UNDER_REVIEW" && r.evidenceState === "ACCEPTED_AS_EVIDENCE" &&
              <ActionButton onClick={() => setVerify(r)} disabled={busy}>Verify exact Identity Evidence requirement</ActionButton>}
            {office && detail.canManage && detail.state === "IN_PROGRESS" && r.code === "SIA_LICENCE" &&
              r.siaSubmissionId && !r.documentRequestId && r.state === "AWAITING_EVIDENCE_REQUEST" &&
              <ActionButton onClick={() => void siaAction("sia-request", r)} disabled={busy}>Issue protected SIA evidence request</ActionButton>}
            {office && detail.canManage && detail.state === "IN_PROGRESS" && r.code === "SIA_LICENCE" &&
              r.siaSubmissionId && r.acceptedVersionId && r.state === "UNDER_REVIEW" && r.evidenceState === "ACCEPTED_AS_EVIDENCE" &&
              <ActionButton onClick={() => void siaAction("sia-verify", r)} disabled={busy}>Verify exact synthetic SIA submission</ActionButton>}
          </li>)}</ol>
          {office && detail.canManage && detail.state !== "CANCELLED" &&
            <ActionButton variant="caution" onClick={() => void action("cancel")} disabled={busy}>Cancel case</ActionButton>}
          <p className="ui-help">Case state does not establish legal compliance or operational deployability.</p>
        </>}
      </section>
    </div>
    <ConfirmDialog open={verify !== null} title="Record synthetic requirement verification?"
      description={verify?.code === "IDENTITY_EVIDENCE" ?
        "This separately verifies the exact accepted synthetic evidence version. It does not authenticate identity or validate a real identity document." :
        "This records a separate decision for the exact accepted evidence version. It is a development workflow proof, not a statutory UK Right to Work check."}
      confirmLabel="Record synthetic verification" variant="primary" busy={busy}
      onClose={() => setVerify(null)} onConfirm={() => void verifyEvidenceRequirement()}>
      <p className="ui-help">Evidence accepted is a prerequisite. The document review Task being Done is not this decision.</p>
    </ConfirmDialog>
  </main>;
}
