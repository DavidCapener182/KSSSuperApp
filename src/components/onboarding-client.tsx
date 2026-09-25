"use client";
import "./record-studies.css";
import "./onboarding-journey.css";

import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react";
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
  templateVersion: number; state: string; createdAt: string; startedAt: string | null; ownerName: string | null;
  ownerPersonId: string; teamId: string | null; isCover: boolean; canReassign: boolean;
  canManage: boolean; canIssueIdentity: boolean; verifiedCount: number; totalCount: number;
  requirements: Requirement[];
  profile: Record<string, string | null> | null; submittedProfile: Record<string, string | null> | null; profileSubmittedAt: string | null;
  siaCredential: { category: string; synthetic_reference: string; expires_on: string } | null;
  submittedSia: { id: string; category: string; synthetic_reference: string; expires_on: string } | null; siaSubmittedAt: string | null };
type Site = { id: string; name: string; status: string; canManage: boolean };
type Target = { person_id: string; display_name: string };
type EligibleOffice = { personId: string; displayName: string };
type CaseCoverGrant = { id: string; coveringName: string; startsAt: string; endsAt: string; reason: string };
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
  if (requirement.code === "CORE_KSS_INDUCTION" && requirement.state === "NOT_CONNECTED") return "Case link pending";
  if (requirement.code === "CONTRACT_TERMS" && requirement.state === "NOT_AVAILABLE") return "Exact version not assigned";
  if (requirement.code !== "IDENTITY_EVIDENCE") return label[requirement.state] ?? requirement.state;
  if (requirement.state === "VERIFIED") return "Verified — synthetic workflow";
  if (requirement.state === "UNDER_REVIEW" && requirement.evidenceState === "ACCEPTED_AS_EVIDENCE")
    return "Office verification needed";
  if (requirement.state === "UNDER_REVIEW") return "Submitted — awaiting review";
  return label[requirement.state] ?? requirement.state;
}
function evidenceLabel(state: string) {
  const labels: Record<string, string> = {
    REQUESTED: "Evidence requested — awaiting submission",
    AWAITING_REVIEW: "Submitted — awaiting evidence review",
    ACCEPTED_AS_EVIDENCE: "Accepted as evidence (separate from requirement verification)",
    REJECTED_ACTION_REQUIRED: "Rejected — replacement needed",
  };
  return labels[state] ?? state.replaceAll("_", " ").toLowerCase();
}
function actorLabel(actor: string) {
  const labels: Record<string, string> = {
    STAFF: "Staff", OFFICE: "Office", NONE: "No action due",
    SYSTEM: "System configuration", EXTERNAL_PROVIDER: "External provider",
  };
  return labels[actor] ?? actor.replaceAll("_", " ").toLowerCase();
}
function nextActionText(requirement: Requirement) {
  if (requirement.code === "CORE_KSS_INDUCTION" && requirement.state === "NOT_CONNECTED") return "Training status is unavailable for this case.";
  if (requirement.code === "CONTRACT_TERMS" && requirement.state === "NOT_AVAILABLE") return "No exact terms version is assigned to this case.";
  return requirement.nextAction;
}
type CaseView = "OVERVIEW" | "JOURNEY" | "EVIDENCE" | "TRAINING" | "DOCUMENTS" | "PERSONAL_DETAILS";
const caseViews: { code: CaseView; label: string }[] = [
  { code: "OVERVIEW", label: "Overview" }, { code: "JOURNEY", label: "Journey" },
  { code: "EVIDENCE", label: "Evidence" }, { code: "TRAINING", label: "Training" },
  { code: "DOCUMENTS", label: "Documents" }, { code: "PERSONAL_DETAILS", label: "Personal details" },
];
const isComplete = (requirement: Requirement) => ["VERIFIED", "COMPLETE", "ACKNOWLEDGED"].includes(requirement.state);
function requirementView(requirement: Requirement): CaseView {
  if (["RIGHT_TO_WORK", "SIA_LICENCE", "IDENTITY_EVIDENCE"].includes(requirement.code)) return "EVIDENCE";
  if (requirement.code === "CONTRACT_TERMS") return "DOCUMENTS";
  if (requirement.code === "CORE_KSS_INDUCTION") return "TRAINING";
  return "PERSONAL_DETAILS";
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
  const [caseView, setCaseView] = useState<CaseView>("OVERVIEW");
  const [caseAction, setCaseAction] = useState<"reassign" | "cover" | null>(null);
  const [caseActionPeople, setCaseActionPeople] = useState<EligibleOffice[]>([]);
  const [caseActionTarget, setCaseActionTarget] = useState("");
  const [caseActionReason, setCaseActionReason] = useState("");
  const [caseCoverEnds, setCaseCoverEnds] = useState("");
  const [caseCovers, setCaseCovers] = useState<CaseCoverGrant[]>([]);
  const [caseActionError, setCaseActionError] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState(false);

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
  useEffect(() => { if (office && selectedCaseId) void Promise.resolve().then(() => loadPublisher()); }, [office, selectedCaseId, loadPublisher]);
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
  async function openCaseAction(next: "reassign" | "cover") {
    if (!detail?.teamId) return;
    setCaseAction(next); setCaseActionTarget(""); setCaseActionReason(""); setCaseCoverEnds("");
    setCaseActionPeople([]); setCaseCovers([]); setCaseActionError("");
    try {
      const [teamResponse, coverResponse] = await Promise.all([
        fetch(`/api/onboarding/teams?teamId=${encodeURIComponent(detail.teamId)}`, { cache: "no-store" }),
        next === "cover" ? fetch(`/api/onboarding/${detail.id}/cover`, { cache: "no-store" }) : Promise.resolve(null),
      ]);
      if (!teamResponse.ok || (coverResponse && !coverResponse.ok)) throw new Error();
      setCaseActionPeople((await teamResponse.json()).eligible ?? []);
      if (coverResponse) setCaseCovers((await coverResponse.json()).grants ?? []);
    } catch { setCaseActionError("Case management choices are unavailable. Close and try again."); }
  }
  async function submitCaseAction() {
    if (!detail || !caseAction || !caseActionTarget || caseActionReason.trim().length < 10 ||
      (caseAction === "cover" && !caseCoverEnds)) return;
    setBusy(true); setMessage("");
    const body = caseAction === "reassign" ? { newOwnerPersonId: caseActionTarget, reason: caseActionReason } :
      { coveringPersonId: caseActionTarget, startsAt: new Date().toISOString(),
        endsAt: new Date(caseCoverEnds).toISOString(), reason: caseActionReason };
    try {
      const response = await fetch(`/api/onboarding/${detail.id}/${caseAction}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      setCaseAction(null); await load();
      setMessage(caseAction === "reassign" ? "Case reassigned with history." : "Named finite cover granted.");
    } catch { setCaseActionError("Case management was denied. Check your authority and selected team member."); }
    finally { setBusy(false); }
  }
  async function revokeCaseCover(grantId: string) {
    if (!detail) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/onboarding/${detail.id}/cover/${grantId}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setCaseCovers((current) => current.filter((grant) => grant.id !== grantId));
      setMessage("Named case cover revoked."); await load();
    } catch { setMessage("Cover revocation was denied."); }
    finally { setBusy(false); }
  }

  const shownCases = office || showOlderCases ? cases : cases.slice(0, 5);
  return <main className={`enterprise-main onboarding-main${selectedCaseId ? " onboarding-record" : ""}`}>
    {!selectedCaseId && <PageHeader eyebrow="Synthetic development onboarding" title={office ? "Onboarding" : "My Onboarding"}
      description={office ? "Manage each starter checklist. Evidence review and requirement verification remain separate decisions."
        : "See what is complete and what needs your attention next."} />}
    {selectedCaseId && <Link className="crm-record-back" href="/onboarding">← {office ? "Onboarding cases" : "My cases"}</Link>}
    {selectedCaseId && detail && <><header className="onboarding-record-header onboarding-case-hero"><div>
        <p className="eyebrow">Person / onboarding · synthetic development</p>
        <h1>{detail.starterName}</h1>
        <p>{detail.intendedRole.replaceAll("_"," ")} · {detail.siteName}</p>
        <p>Owner {detail.ownerName ?? "No named owner in this read"} · {detail.startedAt ? "Started" : "Created"} {new Date(detail.startedAt ?? detail.createdAt).toLocaleDateString("en-GB")}</p></div>
        <div className="onboarding-case-hero-state"><span>Case state</span><strong>{label[detail.state] ?? detail.state}</strong>
          <span>{detail.verifiedCount} of {detail.totalCount} requirements complete</span>
          {office && detail.state !== "CANCELLED" && (detail.canReassign || detail.canManage) && <details className="onboarding-case-actions">
            <summary>Case actions</summary><div>
              {detail.canReassign && detail.teamId && <button type="button" onClick={() => void openCaseAction("reassign")}>Reassign owner</button>}
              {detail.canManage && !detail.isCover && detail.teamId && <button type="button" onClick={() => void openCaseAction("cover")}>Manage finite cover</button>}
              {detail.canManage && <button type="button" onClick={() => setCancelConfirm(true)}>Cancel case</button>}
            </div></details>}
        </div></header>
      <nav className="onboarding-record-sections" aria-label="Onboarding case views">
        {caseViews.filter((item) => item.code !== "PERSONAL_DETAILS" || detail.templateVersion >= 2).map((item) =>
          <button type="button" key={item.code} aria-current={caseView === item.code ? "page" : undefined}
            onClick={() => setCaseView(item.code)}>{item.label}</button>)}
      </nav></>}
    {office && <FeedbackBanner>Development workflow only. No legal Right to Work check, compliance decision or deployment approval is recorded here.</FeedbackBanner>}
    {message && <FeedbackBanner tone={message.includes("could not") || message.includes("not recorded") ? "error" : "success"}>{message}</FeedbackBanner>}
    {error && <FeedbackBanner tone="error">Onboarding is unavailable. Refresh to try again.</FeedbackBanner>}
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
          {selectedCaseId && caseView === "OVERVIEW" && <h2 className="onboarding-case-section-title">{detail.starterName}&apos;s onboarding</h2>}
          {(!selectedCaseId || caseView === "OVERVIEW") && <div id="onboarding-overview" className="onboarding-progress"><strong>{detail.verifiedCount} of {detail.totalCount} requirements complete</strong>
            <Progress value={100 * detail.verifiedCount / detail.totalCount} aria-label={`${detail.verifiedCount} of ${detail.totalCount} requirements complete`} />
            <p>Verified requirement count from this case. It is not a compliance or deployment decision.</p></div>}
          {selectedCaseId && caseView === "OVERVIEW" && <>
            <section className="onboarding-case-focus" aria-labelledby="onboarding-focus-heading">
              <div className="onboarding-case-focus-heading"><div><p className="eyebrow">Current handoff</p><h2 id="onboarding-focus-heading">What happens next</h2></div>
                <p>Owner {detail.ownerName ?? "not named"}</p></div>
              <div className="onboarding-overview-columns">
                <div><h3>Action required now</h3><ul>{detail.requirements.filter((r) => r.actor === "OFFICE" || r.actor === "STAFF").map((r) =>
                  <li key={r.id}><div><strong>{r.title}</strong><span>{actorLabel(r.actor)} · {requirementLabel(r)}</span><span>{nextActionText(r)}</span></div>
                    <button type="button" onClick={() => setCaseView(requirementView(r))}>Continue →</button></li>)}</ul>
                  {detail.requirements.every((r) => r.actor !== "OFFICE" && r.actor !== "STAFF") && <p>No Staff or Office action is identified in this snapshot.</p>}
                </div>
                <div><h3>Waiting / dependency</h3><ul>{detail.requirements.filter((r) => r.actor === "SYSTEM" || r.actor === "EXTERNAL_PROVIDER").map((r) =>
                  <li key={r.id}><div><strong>{r.title}</strong><span>{requirementLabel(r)}</span><span>{nextActionText(r)}</span></div>
                    <button type="button" onClick={() => setCaseView(requirementView(r))}>View status →</button></li>)}</ul>
                  {detail.requirements.every((r) => r.actor !== "SYSTEM" && r.actor !== "EXTERNAL_PROVIDER") && <p>No source dependency is identified.</p>}
                </div>
              </div>
            </section>
            <section className="onboarding-overview-journey" aria-labelledby="onboarding-overview-journey-heading">
              <div><h2 id="onboarding-overview-journey-heading">Journey at a glance</h2><button type="button" onClick={() => setCaseView("JOURNEY")}>View full journey →</button></div>
              <ol>{detail.requirements.map((r) => <li key={r.id}>
                <span aria-hidden="true">{isComplete(r) ? "✓" : "○"}</span><strong>{r.title}</strong><small>{requirementLabel(r)}</small>
              </li>)}</ol>
            </section>
          </>}
          {!office && <p className="onboarding-development-note">Synthetic workflow only. No legal checking or deployment decision is recorded here.</p>}
          {selectedCaseId && caseView === "PERSONAL_DETAILS" && <h2 className="onboarding-case-section-title">Personal details</h2>}
          {office && detail.templateVersion >= 2 && (!selectedCaseId || caseView === "PERSONAL_DETAILS") && <details open={caseView === "PERSONAL_DETAILS"} id="onboarding-submitted" className="onboarding-private-summary onboarding-private-disclosure">
            <summary>Submitted starter information <span>Restricted to this authorised case</span></summary>
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
          </details>}
          {!office && selectedCaseId && caseView === "PERSONAL_DETAILS" && <section className="onboarding-source-panel">
            <h3>Your submitted information</h3>
            <p>{detail.profileSubmittedAt ? `Last submitted ${new Date(detail.profileSubmittedAt).toLocaleString("en-GB")}.` : "Personal details have not been submitted for this case."}</p>
            <Link className="ui-action ui-action--secondary" href="/profile">Open my Personal Details</Link>
          </section>}
          {office && detail.canManage && detail.state === "DRAFT" && (!selectedCaseId || caseView === "OVERVIEW") &&
            <ActionButton onClick={() => void action("start")} disabled={busy}>Start onboarding</ActionButton>}
          {selectedCaseId && caseView === "TRAINING" && <section className="onboarding-source-panel" aria-labelledby="onboarding-training-heading">
            <p className="eyebrow">Native KSS Training</p><h2 id="onboarding-training-heading">Core KSS induction</h2>
            <strong>Training status unavailable for this onboarding case</strong>
            <p>KSS Training exists, but this case has no authorised Person-specific Training assignment or completion read. No induction outcome is inferred.</p>
            <Link className="ui-action ui-action--secondary" href={office ? "/training" : "/training/my-learning"}>Open Training</Link>
          </section>}
          {selectedCaseId && caseView === "JOURNEY" && <h2 className="onboarding-case-section-title">Six steps, one case</h2>}
          {selectedCaseId && caseView === "EVIDENCE" && <h2 className="onboarding-case-section-title">Evidence &amp; decisions</h2>}
          {selectedCaseId && caseView === "EVIDENCE" && detail.siaCredential && <section className="onboarding-source-panel" aria-label="Submitted synthetic SIA details">
            <h3>Submitted SIA details</h3><p>{detail.siaCredential.category.replaceAll("_", " ")} · Expires {detail.siaCredential.expires_on || "not supplied"}</p>
            <details><summary>View exact submitted revision</summary><dl>
              <div><dt>Reference</dt><dd>{detail.siaCredential.synthetic_reference || "—"}</dd></div>
              <div><dt>Submitted revision</dt><dd>{detail.submittedSia ? `${detail.submittedSia.id} · ${detail.siaSubmittedAt ? new Date(detail.siaSubmittedAt).toLocaleString("en-GB") : ""}` : "Not submitted"}</dd></div>
            </dl></details>
            {detail.submittedSia && (detail.siaCredential.synthetic_reference !== detail.submittedSia.synthetic_reference ||
              detail.siaCredential.expires_on !== detail.submittedSia.expires_on) &&
              <FeedbackBanner tone="error">Current SIA details differ from the submitted revision. Staff must submit a new revision before review.</FeedbackBanner>}
          </section>}
          {selectedCaseId && caseView === "DOCUMENTS" && <h2 className="onboarding-case-section-title">Employment terms</h2>}
          {(!selectedCaseId || caseView === "JOURNEY" || caseView === "EVIDENCE" || caseView === "DOCUMENTS") && <>
          <p className="onboarding-journey-intro">{caseView === "EVIDENCE" ? "Protected evidence and separate requirement decisions for this case." : caseView === "DOCUMENTS" ? "Only the exact controlled terms version assigned to this case can be acknowledged." : "Current requirements in template order. Expand a step for its exact source details and guarded actions."}</p>
          <ol id="onboarding-requirements" className="onboarding-requirements onboarding-journey">{detail.requirements
            .filter((r) => caseView === "EVIDENCE" ? ["RIGHT_TO_WORK", "SIA_LICENCE", "IDENTITY_EVIDENCE"].includes(r.code) :
              caseView === "DOCUMENTS" ? r.code === "CONTRACT_TERMS" : true)
            .map((r) => <Fragment key={r.id}>
            {caseView === "JOURNEY" && (r.code === "PERSONAL_DETAILS" || r.code === "RIGHT_TO_WORK" || r.code === "CONTRACT_TERMS") && <li className="onboarding-journey-group"><span>{r.code === "PERSONAL_DETAILS" ? "01 / Getting started" : r.code === "RIGHT_TO_WORK" ? "02 / Evidence checks" : "03 / Terms and learning"}</span></li>}
            <li id={`onboarding-requirement-${r.id}`}>
            <div className="onboarding-journey-step" aria-hidden="true">{r.position}</div>
            <div className="onboarding-journey-content">
              <details className="onboarding-step-detail" open={!isComplete(r)}><summary>
                <span className="onboarding-requirement-head"><strong>{r.title}</strong><span className={`onboarding-badge onboarding-badge--${r.state.toLowerCase()}`}>{requirementLabel(r)}</span></span>
                <small>{isComplete(r) ? `${r.verifiedAt ? `Verified ${new Date(r.verifiedAt).toLocaleDateString("en-GB")}` : requirementLabel(r)}${r.acceptedVersionId ? " · Evidence accepted" : ""}` : `${actorLabel(r.actor)} · ${nextActionText(r)}`}</small>
              </summary><div className="onboarding-step-expanded">
              <dl className="onboarding-journey-facts">
                <div><dt>Current requirement</dt><dd>{requirementLabel(r)}{r.verifiedAt && ` · Decision recorded ${new Date(r.verifiedAt).toLocaleString("en-GB")}`}</dd></div>
                {r.evidenceState && <div><dt>Document evidence</dt><dd>{evidenceLabel(r.evidenceState)}</dd></div>}
                {r.controlled && <div><dt>Exact terms</dt><dd>{r.controlled.title} · Version {r.controlled.versionNumber}{r.controlled.acknowledgedAt ? " · Acknowledged" : " · Awaiting acknowledgement"}</dd></div>}
                <div><dt>Next actor</dt><dd>{actorLabel(r.actor)}</dd></div>
              </dl>
              <p className="onboarding-journey-next"><strong>{r.actor === "NONE" ? "Current outcome" : "Next action"}</strong> {nextActionText(r)}</p>
              {r.code === "CORE_KSS_INDUCTION" && <button type="button" className="onboarding-view-link" onClick={() => setCaseView("TRAINING")}>Open Training view →</button>}
              {r.code === "CONTRACT_TERMS" && caseView === "JOURNEY" && <button type="button" className="onboarding-view-link" onClick={() => setCaseView("DOCUMENTS")}>Open Documents view →</button>}
              {r.code === "CONTRACT_TERMS" && caseView === "DOCUMENTS" && <p className="onboarding-source-note">Opened and acknowledged are separate states. This exact version is not a signature or proof of comprehension.</p>}
              {r.code === "RIGHT_TO_WORK" && <span id="onboarding-evidence" className="onboarding-anchor" />}
              {r.evidenceState && <p className="onboarding-evidence-chain">Evidence: {evidenceLabel(r.evidenceState)} · Requirement: {requirementLabel(r)}</p>}
            {r.feedback && <FeedbackBanner tone="error">Evidence review feedback: {r.feedback}</FeedbackBanner>}
            {r.documentRequestId && <Link className="ui-action ui-action--secondary" href={`/documents/${r.documentRequestId}${r.acceptedVersionId ? `?version=${r.acceptedVersionId}` : ""}`}>
              {office ? "Open protected evidence" : "Open my evidence request"}</Link>}
            {caseView === "DOCUMENTS" && r.code === "CONTRACT_TERMS" && r.controlled && <div className="controlled-assignment">
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
            {caseView === "DOCUMENTS" && office && canPublish && detail.canManage && detail.state === "IN_PROGRESS" && r.code === "CONTRACT_TERMS" && !r.controlled &&
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
            </div></details></div>
          </li></Fragment>)}</ol>
          </>}
        </>}
      </section>
    </div>
    <ConfirmDialog open={caseAction !== null} title={caseAction === "reassign" ? "Reassign case owner" : "Manage named case cover"}
      description={detail ? `${detail.starterName} · Current owner: ${detail.ownerName ?? "not named"}. This action uses the existing guarded case workflow.` : ""}
      confirmLabel={caseAction === "reassign" ? "Confirm reassignment" : "Grant finite cover"} variant="primary" busy={busy}
      error={caseActionError} onClose={() => setCaseAction(null)} onConfirm={() => void submitCaseAction()}>
      <label className="ui-field">{caseAction === "reassign" ? "New owner" : "Covering Office person"}
        <select required value={caseActionTarget} onChange={(event) => setCaseActionTarget(event.target.value)}>
          <option value="">Select eligible Office person</option>
          {caseActionPeople.filter((person) => person.personId !== detail?.ownerPersonId).map((person) =>
            <option key={person.personId} value={person.personId}>{person.displayName}</option>)}
        </select></label>
      {caseAction === "cover" && <label className="ui-field">Cover ends (maximum 14 calendar days)
        <input type="datetime-local" required value={caseCoverEnds} onChange={(event) => setCaseCoverEnds(event.target.value)} /></label>}
      <label className="ui-field">Reason
        <textarea required minLength={10} maxLength={500} value={caseActionReason}
          onChange={(event) => setCaseActionReason(event.target.value)} /></label>
      {caseAction === "cover" && caseCovers.length > 0 && <div className="onboarding-case-cover-list"><h3>Current cover</h3><ul>
        {caseCovers.map((grant) => <li key={grant.id}><strong>{grant.coveringName}</strong> · {new Date(grant.startsAt).toLocaleString("en-GB")} to {new Date(grant.endsAt).toLocaleString("en-GB")}
          <button type="button" disabled={busy} onClick={() => void revokeCaseCover(grant.id)}>Revoke cover</button></li>)}
      </ul></div>}
    </ConfirmDialog>
    <ConfirmDialog open={cancelConfirm} title="Cancel this onboarding case?"
      description="This ends the case and retains its history. Existing open work is cancelled by the guarded source action. No cancellation reason is accepted by the current source contract."
      confirmLabel="Cancel case" variant="caution" busy={busy}
      onClose={() => setCancelConfirm(false)} onConfirm={() => { setCancelConfirm(false); void action("cancel"); }} />
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
