"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SIA_CATEGORIES, SIA_LABELS, type SiaCategory } from "@/lib/profile/policy";
import { credentialState } from "@/lib/credentials/state";

type Claim = { id: string; type_code: SiaCategory; draft_reference: string | null; draft_issued_on: string | null;
  draft_expires_on: string | null; draft_change_seq: number; latest_revision_id: string | null; withdrawn_at: string | null };
type Revision = { id: string; claim_id: string; type_code: SiaCategory; revision_number: number; synthetic_reference: string;
  issued_on: string | null; expires_on: string | null; draft_change_seq: number; evidence_version_id: string; submitted_at: string };
type Decision = { id: string; revision_id: string; decision: "VERIFIED" | "REJECTED" | "REVOKED";
  method: "STAFF_DECLARED" | "OFFICE_CHECKED_EVIDENCE"; reason_code: string | null; decided_at: string };
type Grant = { id: string; reviewer_person_id: string; subject_person_id: string; type_code: SiaCategory;
  effective_until: string; revoked_at: string | null };
type Document = { id: string; title: string; status: string };
type HistoricalSia = { caseId: string; category: SiaCategory; submittedAt: string; state: string };
type QueueItem = { subject_person_id: string; display_name: string; type_code: SiaCategory };
type CredentialData = { claims: Claim[]; revisions: Revision[]; decisions: Decision[]; grants: Grant[]; documents: Document[] };
type AcceptedVersion = { id: string; requestId: string; type: SiaCategory };
const LABELS = { ...SIA_LABELS, DOOR_SUPERVISION: "Door Supervision" };
const empty: CredentialData = { claims: [], revisions: [], decisions: [], grants: [], documents: [] };
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" })
  .format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : "Not recorded";

export function CredentialsClient({ personId, self, office, superAdmin }: { personId: string; self: boolean; office: boolean; superAdmin: boolean }) {
  const [data, setData] = useState<CredentialData>(empty);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [accepted, setAccepted] = useState<AcceptedVersion[]>([]);
  const [historical, setHistorical] = useState<HistoricalSia[]>([]);
  const [category, setCategory] = useState<SiaCategory>("SECURITY_GUARDING");
  const [reference, setReference] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [grantUntil, setGrantUntil] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const staff = self && !office && !superAdmin;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/credentials?personId=${encodeURIComponent(personId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Credential access is unavailable.");
      const result = await response.json() as CredentialData;
      setData(result);
      setLoading(false);
      if (office || superAdmin) {
        void fetch("/api/credentials?queue=1", { cache: "no-store" })
          .then(async (response) => { if (response.ok) setQueue((await response.json()).queue ?? []); }).catch(() => {});
      }
      if (staff) {
        void Promise.all(result.documents.map(async (document) => {
          const detail = await fetch(`/api/documents/${document.id}`, { cache: "no-store" });
          if (!detail.ok) return null;
          const item = (await detail.json()).request;
          const version = item?.version;
          const type = document.title.replace("Synthetic credential evidence: ", "") as SiaCategory;
          return version?.review?.decision === "ACCEPTED_AS_EVIDENCE" && SIA_CATEGORIES.includes(type)
            ? { id: version.id, requestId: document.id, type } as AcceptedVersion : null;
        })).then((items) => setAccepted(items.filter((item): item is AcceptedVersion => item !== null))).catch(() => {});
        void fetch("/api/onboarding", { cache: "no-store" }).then(async (response) => {
          if (!response.ok) return;
          const listing = await response.json();
          const history = await Promise.all((listing.cases ?? []).slice(0, 20).map(async (row: { id: string }) => {
            const caseResponse = await fetch(`/api/onboarding/${row.id}`, { cache: "no-store" });
            if (!caseResponse.ok) return null;
            const detail = (await caseResponse.json()).case;
            return detail?.submittedSia && detail?.siaSubmittedAt ? { caseId: row.id,
              category: detail.submittedSia.category, submittedAt: detail.siaSubmittedAt,
              state: detail.requirements?.find((item: { code: string }) => item.code === "SIA_LICENCE")?.state ?? "UNKNOWN" } as HistoricalSia : null;
          }));
          const seen = new Set<SiaCategory>();
          setHistorical(history.filter((item): item is HistoricalSia => {
            if (!item || seen.has(item.category)) return false;
            seen.add(item.category); return true;
          }));
        }).catch(() => {});
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Credentials unavailable."); }
    finally { setLoading(false); }
  }, [personId, office, superAdmin, staff]);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  async function action(input: Record<string, unknown>, success: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/credentials", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error((await response.json()).error ?? "Action denied");
      await load(); setMessage(success);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action denied"); }
    finally { setBusy(false); }
  }
  const decisionsFor = (revisionId: string) => data.decisions.filter((item) => item.revision_id === revisionId);
  const currentState = (claim: Claim, revision: Revision | undefined) => {
    const state = credentialState(claim, revision ?? null, data.decisions);
    return ({ WITHDRAWN: "Withdrawn", DRAFT: "Draft only", RESUBMISSION_REQUIRED: "Changed — fresh submission required",
      REVOKED: "Revoked", REJECTED: "Rejected", EXPIRED: "Expired",
      VERIFIED: "Verified — Office checked evidence", REVIEW_PENDING: "Submitted — review pending" } as const)[state];
  };
  return <main className="enterprise-main">
    <p className="eyebrow">Synthetic development · TASK-16B</p>
    <h1>{staff ? "My Credentials" : "Credential review"}</h1>
    <p className="enterprise-intro">These synthetic claims and reviews do not establish a live SIA check or deployment eligibility.</p>
    {message && <p role="status" className="enterprise-honesty">{message}</p>}
    {loading ? <p>Loading credentials…</p> : <>
      {(office || superAdmin) && <section className="profile-card"><h2>Assigned review responsibility</h2>
        {queue.length ? <ul>{queue.map((item) => <li key={`${item.subject_person_id}-${item.type_code}`}>
          <Link href={`/credentials?personId=${item.subject_person_id}`}>{item.display_name} — {LABELS[item.type_code]}</Link>
        </li>)}</ul> : <p>No active Credential Reviewer grants.</p>}
      </section>}
      <section className="profile-card" aria-labelledby="current-credentials"><h2 id="current-credentials">Current credentials</h2>
        {!data.claims.some((item) => !item.withdrawn_at) && <p>No current 16B credential claims are available.</p>}
        {data.claims.filter((item) => !item.withdrawn_at).map((claim) => {
          const revision = data.revisions.find((item) => item.id === claim.latest_revision_id);
          const state = currentState(claim, revision);
          return <article key={claim.id} className="profile-card" style={{ marginBlock: "1rem" }}>
            <h3>{LABELS[claim.type_code]}</h3>
            <dl className="people-details-list">
              <div><dt>Status</dt><dd>{state}</dd></div>
              <div><dt>Expiry</dt><dd>{dateLabel(revision?.expires_on ?? claim.draft_expires_on)}</dd></div>
              <div><dt>Evidence</dt><dd>{revision ? claim.draft_change_seq === revision.draft_change_seq ? "Accepted as evidence" : "Accepted for earlier revision" : "No submitted evidence"}</dd></div>
              <div><dt>Verification</dt><dd>{state.startsWith("Verified") ? "Office checked evidence" : state === "Revoked" ? "Revoked" : "No current verification"}</dd></div>
            </dl>
            {staff && !claim.withdrawn_at && <div className="profile-actions">
              {accepted.filter((item) => item.type === claim.type_code).map((item) => <button type="button" className="ui-action ui-action--primary" disabled={busy}
                key={item.id} onClick={() => void action({ action: "submit", claimId: claim.id, versionId: item.id }, "New credential revision submitted for review.")}>Submit with accepted evidence from request {item.requestId.slice(0, 8)}</button>)}
              <button type="button" className="ui-action ui-action--destructive" disabled={busy} onClick={() => void action({ action: "withdraw", claimId: claim.id }, "Claim withdrawn; its history is retained.")}>Withdraw claim</button>
            </div>}
            {(office || superAdmin) && revision && !claim.withdrawn_at && <div className="profile-actions">
              {data.documents.map((item) => <Link key={item.id} href={`/documents/${item.id}`}>Open exact evidence request</Link>)}
              {state === "Submitted — review pending" && <>
                <button className="ui-action ui-action--primary" disabled={busy} onClick={() => void action({ action: "decide", revisionId: revision.id, decision: "VERIFIED", method: "OFFICE_CHECKED_EVIDENCE" }, "Verification recorded.")}>Verify after evidence check</button>
                <button className="ui-action ui-action--caution" disabled={busy} onClick={() => void action({ action: "decide", revisionId: revision.id, decision: "REJECTED", method: "OFFICE_CHECKED_EVIDENCE", reasonCode: "EVIDENCE_MISMATCH" }, "Rejection recorded.")}>Reject — evidence mismatch</button>
              </>}
              {state.startsWith("Verified") && <button className="ui-action ui-action--destructive" disabled={busy} onClick={() => void action({ action: "decide", revisionId: revision.id, decision: "REVOKED", method: "OFFICE_CHECKED_EVIDENCE", reasonCode: "CORRECTION" }, "Verification revoked.")}>Revoke verification</button>}
            </div>}
          </article>;
        })}
      </section>
      {staff && <section className="profile-card"><h2>Save a credential draft</h2>
        <p>Reference must be synthetic and start SYN-SIA-. Dates must come from your evidence; leave issue or expiry blank if the evidence does not establish it.</p>
        <form className="profile-form" onSubmit={(event) => { event.preventDefault(); void action({ action: "save", category, reference, issuedOn: issuedOn || null, expiresOn: expiresOn || null }, "Draft saved. A material change requires a fresh submission and review."); }}>
          <label className="ui-field">Credential category<select value={category} onChange={(event) => setCategory(event.target.value as SiaCategory)}>{SIA_CATEGORIES.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}</select></label>
          <label className="ui-field">Synthetic reference<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="SYN-SIA-EXAMPLE" required /></label>
          <label className="ui-field">Issue date, if evidenced<input type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} /></label>
          <label className="ui-field">Expiry date, if evidenced<input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></label>
          <div className="profile-actions"><button className="ui-action ui-action--primary" disabled={busy}>Save draft</button></div>
        </form>
        <p>Upload and replace files through <Link href="/documents">My Documents</Link>. A Credential Reviewer must request and accept the exact evidence version before submission.</p>
      </section>}
      {office && personId !== "" && <section className="profile-card"><h2>Evidence request</h2>
        <p>Request one protected document for this Person and category. Existing Documents review decides evidence acceptance separately.</p>
        {data.grants.filter((grant) => !grant.revoked_at)
          .map((grant) => grant.type_code).filter((item, index, all) => all.indexOf(item) === index)
          .map((item) => <button key={item} className="ui-action ui-action--secondary" disabled={busy} onClick={() => void action({ action: "requestEvidence", personId, category: item }, "Protected evidence request created.")}>Request {LABELS[item]} evidence</button>)}
      </section>}
      {superAdmin && <section className="profile-card"><h2>Credential Reviewer grants</h2>
        <p>Grant one active Office Admin finite responsibility for this Person and category.</p>
        <form className="profile-form" onSubmit={(event) => { event.preventDefault(); void action({ action: "grant", personId, reviewerId, category, untilAt: new Date(grantUntil).toISOString() }, "Reviewer grant recorded."); }}>
          <label className="ui-field">Reviewer Person ID<input value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} required /></label>
          <label className="ui-field">Category<select value={category} onChange={(event) => setCategory(event.target.value as SiaCategory)}>{SIA_CATEGORIES.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}</select></label>
          <label className="ui-field">Grant ends<input type="datetime-local" value={grantUntil} onChange={(event) => setGrantUntil(event.target.value)} required /></label>
          <div className="profile-actions"><button className="ui-action ui-action--primary" disabled={busy}>Grant review responsibility</button></div>
        </form>
        {data.grants.filter((item) => !item.revoked_at).map((item) => <p key={item.id}>{LABELS[item.type_code]} · reviewer {item.reviewer_person_id} · until {dateLabel(item.effective_until)} <button className="ui-action ui-action--destructive" disabled={busy} onClick={() => void action({ action: "revokeGrant", grantId: item.id }, "Grant revoked.")}>Revoke</button></p>)}
      </section>}
      <section className="profile-card"><h2>Credential history</h2>
        {data.revisions.length ? <ul>{data.revisions.map((item) => <li key={item.id}>{LABELS[item.type_code]} · revision {item.revision_number} · submitted {dateLabel(item.submitted_at)} · {decisionsFor(item.id).map((decision) => `${decision.decision} ${dateLabel(decision.decided_at)}`).join(", ") || "No verification decision"}</li>)}</ul> : <p>No 16B submissions yet.</p>}
        {data.claims.filter((item) => item.withdrawn_at).map((item) => <p key={item.id}>{LABELS[item.type_code]} claim withdrawn; revisions and decisions retained.</p>)}
        <p>History is retained in synthetic Dev. An old verification cannot be reactivated by restoring a previous value.</p>
      </section>
      {staff && <section className="profile-card"><h2>Historical onboarding evidence</h2>
        {historical.length ? <ul>{historical.map((item) => <li key={item.caseId}>
          <strong>{LABELS[item.category]} — onboarding submission</strong> · Submitted: {dateLabel(item.submittedAt)} · Onboarding verification: {item.state.replaceAll("_", " ")} · <Link href={`/onboarding/${item.caseId}`}>Open case</Link>
        </li>)}</ul> : <p>No authorised historical onboarding SIA submission is available.</p>}
        <p>These case results provide provenance only. They do not create a current 16B credential.</p>
      </section>}
    </>}
  </main>;
}
