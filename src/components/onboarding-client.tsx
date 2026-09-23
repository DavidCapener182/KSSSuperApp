"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton, ConfirmDialog, EmptyState, FeedbackBanner, PageHeader } from "@/components/ui/workflow";

type Summary = { id: string; starterName: string; siteName: string; intendedRole: string; state: string; createdAt: string; templateVersion: number };
type Requirement = { id: string; code: string; title: string; position: number; state: string; nextAction: string;
  actor: string; documentRequestId: string | null; evidenceState: string | null; acceptedVersionId: string | null;
  feedback: string | null; verifiedAt: string | null; syntheticValidUntil: string | null; siaSubmissionId: string | null };
type Case = { id: string; starterName: string; personId: string; siteName: string; intendedRole: string;
  templateVersion: number; state: string; createdAt: string; canManage: boolean; verifiedCount: number; totalCount: number;
  requirements: Requirement[];
  profile: Record<string, string | null> | null; submittedProfile: Record<string, string | null> | null; profileSubmittedAt: string | null;
  siaCredential: { category: string; synthetic_reference: string; expires_on: string } | null;
  submittedSia: { id: string; category: string; synthetic_reference: string; expires_on: string } | null; siaSubmittedAt: string | null };
type Site = { id: string; name: string; status: string; canManage: boolean };
type Target = { person_id: string; display_name: string };
const label: Record<string,string> = {
  DRAFT: "Draft", IN_PROGRESS: "In progress", CANCELLED: "Cancelled", NOT_STARTED: "Not started",
  AWAITING_EVIDENCE: "Awaiting evidence", UNDER_REVIEW: "Under review", ACTION_REQUIRED: "Action required",
  VERIFIED: "Verified", EXPIRED: "Expired", NOT_AVAILABLE: "Not available",
  NOT_CONNECTED: "Not connected", NOT_CONFIGURED: "Not configured", COMPLETE: "Complete — self-submitted",
  AWAITING_SUBMISSION: "Needs submission", UPDATE_NEEDS_SUBMISSION: "Update needs submission",
  AWAITING_EVIDENCE_REQUEST: "Office request needed",
};

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

  const load = useCallback(async () => {
    try {
      const listing = await fetch("/api/onboarding", { cache: "no-store" });
      if (!listing.ok) throw new Error("list unavailable");
      setCases((await listing.json()).cases ?? []);
      if (selectedCaseId) {
        const response = await fetch(`/api/onboarding/${selectedCaseId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("case unavailable");
        setDetail((await response.json()).case);
      } else setDetail(null);
      setError(false);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [selectedCaseId]);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
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
      setMessage(path === "rtw-request" ? "Synthetic RTW evidence request issued." : path === "start" ? "Case started." : "Case cancelled; history retained.");
    } catch { setMessage("Action could not be completed. Refresh and check your current authority."); }
    finally { setBusy(false); }
  }
  async function verifyRtw() {
    if (!detail || !verify?.acceptedVersionId) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/onboarding/${detail.id}/verify`, { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requirementId: verify.id, versionId: verify.acceptedVersionId }) });
      if (!response.ok) throw new Error("verification denied");
      setVerify(null); await load();
      setMessage("Synthetic RTW workflow verification recorded. This is not a statutory Right to Work check.");
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

  return <main className="enterprise-main onboarding-main">
    <PageHeader eyebrow="Synthetic development onboarding" title={office ? "Onboarding" : "My Onboarding"}
      description="Follow one starter checklist. Evidence acceptance, requirement verification and deployment eligibility are separate decisions." />
    <FeedbackBanner>Development workflow only. No legal Right to Work check, compliance decision or deployment approval is recorded here.</FeedbackBanner>
    {message && <FeedbackBanner tone={message.includes("could not") || message.includes("not recorded") ? "error" : "success"}>{message}</FeedbackBanner>}
    {error && <FeedbackBanner tone="error">Onboarding is unavailable. Refresh to try again.</FeedbackBanner>}
    <div className="onboarding-grid">
      <section className="onboarding-panel" aria-labelledby="onboarding-list-title">
        <h2 id="onboarding-list-title">{office ? "Authorised starters" : "My cases"}</h2>
        {loading ? <p role="status">Loading onboarding…</p> : cases.length ?
          <ul className="onboarding-list">{cases.map((c) => <li key={c.id}><Link href={`/onboarding/${c.id}`} aria-current={selectedCaseId === c.id ? "page" : undefined}>
            <strong>{office ? c.starterName : c.intendedRole.replaceAll("_", " ")}</strong>
            <span>{c.siteName} · Template V{c.templateVersion} · {label[c.state] ?? c.state} · Started {new Date(c.createdAt).toLocaleString("en-GB")}</span></Link></li>)}</ul> :
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
      </section>
      <section className="onboarding-panel" aria-labelledby="onboarding-detail-title">
        <h2 id="onboarding-detail-title">Case detail</h2>
        {!detail ? <EmptyState title={selectedCaseId ? "Case unavailable" : "Choose a case"}
          description={selectedCaseId ? "This case is not available to your account." : "Open a case to see its checklist and next actions."} /> : <>
          <div className="onboarding-summary">
            <div><p className="eyebrow">{office ? detail.starterName : "Your starter checklist"}</p>
              <h3>{detail.intendedRole.replaceAll("_", " ")}</h3><p>{detail.siteName} · Template Version {detail.templateVersion} · Created {new Date(detail.createdAt).toLocaleString("en-GB")}</p></div>
            <span className="onboarding-state">{label[detail.state] ?? detail.state}</span>
          </div>
          <div className="onboarding-progress"><strong>{detail.verifiedCount} of {detail.totalCount} requirements complete</strong>
            <p>Mandatory unavailable or unconnected requirements remain outstanding. This is not a compliance or deployment score.</p></div>
          {office && detail.templateVersion >= 2 && <div className="onboarding-private-summary">
            <h3>Submitted starter information</h3>
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
          <ol className="onboarding-requirements">{detail.requirements.map((r) => <li key={r.id}>
            <div className="onboarding-requirement-head"><h4>{r.position}. {r.title}</h4><span className={`onboarding-badge onboarding-badge--${r.state.toLowerCase()}`}>{label[r.state] ?? r.state}</span></div>
            <p>{r.nextAction}</p><small>Next actor: {r.actor.replaceAll("_", " ").toLowerCase()}</small>
            {r.evidenceState && <p className="onboarding-evidence">Evidence: {r.evidenceState.replaceAll("_", " ").toLowerCase()}. Requirement: {label[r.state] ?? r.state}.</p>}
            {r.feedback && <FeedbackBanner tone="error">Evidence review feedback: {r.feedback}</FeedbackBanner>}
            {r.documentRequestId && <Link className="ui-action ui-action--secondary" href={`/documents/${r.documentRequestId}${r.acceptedVersionId ? `?version=${r.acceptedVersionId}` : ""}`}>
              {office ? "Open protected evidence" : "Open my evidence request"}</Link>}
            {!office && detail.templateVersion >= 2 && detail.state === "IN_PROGRESS" &&
              (r.code === "PERSONAL_DETAILS" || r.code === "SIA_LICENCE") &&
              <Link className="ui-action ui-action--secondary" href="/profile">
                {r.code === "PERSONAL_DETAILS" ? "Open Personal Details" : "Open synthetic SIA details"}</Link>}
            {office && detail.canManage && detail.state === "IN_PROGRESS" && r.code === "RIGHT_TO_WORK" && !r.documentRequestId &&
              <ActionButton onClick={() => void action("rtw-request")} disabled={busy}>Issue synthetic evidence request</ActionButton>}
            {office && detail.canManage && detail.state === "IN_PROGRESS" && r.code === "RIGHT_TO_WORK" && r.acceptedVersionId && r.state === "UNDER_REVIEW" &&
              <ActionButton onClick={() => setVerify(r)} disabled={busy}>Verify synthetic RTW workflow</ActionButton>}
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
      description="This records a separate decision for the exact accepted evidence version. It is a development workflow proof, not a statutory UK Right to Work check."
      confirmLabel="Record synthetic verification" variant="primary" busy={busy}
      onClose={() => setVerify(null)} onConfirm={() => void verifyRtw()}>
      <p className="ui-help">Evidence accepted is a prerequisite. The document review Task being Done is not this decision.</p>
    </ConfirmDialog>
  </main>;
}
