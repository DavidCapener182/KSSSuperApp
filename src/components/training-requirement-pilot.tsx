"use client";

import Link from "next/link";
import { useState } from "react";

type Rights = { author: boolean; publisher: boolean; viewer: boolean; superAdmin: boolean; staff: boolean };
type Choice = { id: string; name?: string; title?: string; siteId?: string };
type Version = {
  id: string; number: number; state: string; roleId: string; siteId: string | null;
  serviceId: string | null; courseVersionId: string; priorEvidence: string;
  effectiveFrom: string; effectiveUntil: string | null; endedOn: string | null; hash: string | null;
};
type Requirement = { id: string; label: string; versions: Version[];
  events: { action: string; versionId: string; actorPersonId: string; reason: string; occurredAt: string }[] };
type Grant = { id: string; personId: string; capability: string; serviceId: string | null; revokedAt: string | null };
type Admin = { requirements: Requirement[]; roles: Choice[]; courses: Choice[]; sites: Choice[];
  services: Choice[]; grants: Grant[] };
type Context = { personId: string; personName: string; serviceId: string; serviceName: string;
  roleId: string; roleName: string; asOf: string };
type MatrixRow = { requirementId: string; versionId: string; version: number; label: string;
  status: string; courseVersionId: string; assignmentId: string | null; completionId: string | null;
  completionRuleVersionId: string | null; completedAt: string | null;
  certificateIssueId: string | null; certificateReference: string | null; hash: string };
type Matrix = { rows: MatrixRow[]; asOf: string; policy: string };

export function TrainingRequirementPilot({ rights, initial, contexts, canReviewCompletions = false }: {
  rights: Rights; initial: Admin | null; contexts: Context[]; canReviewCompletions?: boolean;
}) {
  const [admin, setAdmin] = useState(initial);
  const [selected, setSelected] = useState(0);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [roleId, setRoleId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [courseVersionId, setCourseVersionId] = useState("");
  const [priorEvidence, setPriorEvidence] = useState("NOT_ACCEPTED");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [endOn, setEndOn] = useState("");
  const [personId, setPersonId] = useState("");
  const [capability, setCapability] = useState("VIEWER");
  const [grantServiceId, setGrantServiceId] = useState("");
  const [grantUntil, setGrantUntil] = useState("");
  const [grantReason, setGrantReason] = useState("");

  async function refreshAdmin() {
    if (!admin) return;
    const response = await fetch("/api/training-requirements?view=admin", { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setAdmin(result.data as Admin);
  }
  async function action(payload: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/training-requirements", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Action unavailable");
      setMessage("Saved. The requirement record was read back.");
      await refreshAdmin();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action unavailable"); }
    finally { setBusy(false); }
  }
  async function readMatrix() {
    const context = contexts[selected];
    if (!context) return;
    setBusy(true); setMessage(""); setMatrix(null);
    try {
      const params = new URLSearchParams({ view: "matrix", person: context.personId,
        service: context.serviceId, role: context.roleId, asOf: context.asOf });
      const response = await fetch(`/api/training-requirements?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Source unavailable");
      setMatrix(result.data as Matrix);
    } catch { setMessage("SOURCE_UNAVAILABLE — this context or its Training source could not be read."); }
    finally { setBusy(false); }
  }

  return <div className="training-requirement-pilot">
    <p className="training-source-note">Synthetic Training requirement pilot. Assignment, Attempt, Completion, CertificateIssue,
      Credential verification and deployment eligibility are separate decisions. This matrix does not decide whether someone can work.</p>
    {message && <p role="status">{message}</p>}
    <section className="training-card">
      <h2>Requirement matrix</h2>
      <p>Choose an allocated Site Shift context. Results are factual for its Person, duty role, Service and London service date.</p>
      {contexts.length ? <><label>Person and assigned context
        <select value={selected} onChange={event => { setSelected(Number(event.target.value)); setMatrix(null); }}>
          {contexts.map((context, index) => <option key={`${context.personId}-${context.serviceId}-${context.roleId}-${context.asOf}`} value={index}>
            {context.personName} · {context.roleName} · {context.serviceName} · {context.asOf}
          </option>)}
        </select></label><button disabled={busy} onClick={readMatrix}>Read requirement evidence</button></>
        : <p>No authorised allocated context in the pilot window.</p>}
      {matrix && <div aria-live="polite">
        <p>As of {matrix.asOf}. A blank result means no published Training requirement applies to this context.</p>
        {matrix.rows.length ? <div className="training-cards">{matrix.rows.map(row =>
          <article className="training-card" key={row.versionId}>
            <small>Requirement version {row.version} · Synthetic policy</small>
            <h3>{row.label}</h3><p><strong>{row.status.replaceAll("_", " ")}</strong></p>
            <p>CourseVersion {row.courseVersionId}</p>
            {row.assignmentId && <p>Assignment {rights.staff && !rights.viewer
              ? <Link href={`/training/my-learning/${row.assignmentId}`}>{row.assignmentId}</Link>
              : canReviewCompletions
                ? <Link href={`/training-admin/completions?assignment=${row.assignmentId}`}>{row.assignmentId}</Link>
                : row.assignmentId}</p>}
            {row.completionId && <p>Completion {row.completionId} · rule {row.completionRuleVersionId} · {row.completedAt}</p>}
            {row.certificateIssueId && <p>Separate certificate issue: {row.certificateReference}</p>}
          </article>)}</div> : <p>NOT_APPLICABLE — no published requirement matches this context and date.</p>}
      </div>}
    </section>
    {admin && (rights.author || rights.publisher || rights.superAdmin) && <section className="training-card">
      <h2>Requirement versions</h2>
      {(rights.author || rights.publisher) && <label>Decision reason
        <input value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={300} />
      </label>}
      {rights.publisher && <label>End published version on this date, exclusive
        <input type="date" value={endOn} onChange={event => setEndOn(event.target.value)} />
      </label>}
      {admin.requirements.length ? admin.requirements.map(item =>
        <article key={item.id}><h3>{item.label}</h3><ul>{item.versions.map(version =>
          <li key={version.id}>Version {version.number} · {version.state} · {version.effectiveFrom}
            {version.endedOn ? ` ended ${version.endedOn}` : version.effectiveUntil ? ` to ${version.effectiveUntil}` : " onward"} · CourseVersion {version.courseVersionId}
            {version.state === "DRAFT" && rights.publisher && <button disabled={busy || reason.trim().length < 10}
              onClick={() => action({ action: "PUBLISH", versionId: version.id, reason })}>Publish with reason</button>}
            {version.state === "PUBLISHED" && rights.author && <button disabled={busy || !from || reason.trim().length < 10}
              onClick={() => action({ action: "REVISE", previousVersionId: version.id, courseVersionId: courseVersionId || version.courseVersionId,
                priorEvidence, effectiveFrom: from, effectiveUntil: until || null, reason })}>Draft next version</button>}
            {version.state === "PUBLISHED" && !version.endedOn && rights.publisher &&
              <button disabled={busy || !endOn || reason.trim().length < 10}
                onClick={() => action({ action: "END", versionId: version.id, endOn, reason })}>End with reason</button>}
          </li>)}</ul><details><summary>Decision history</summary><ol>{item.events.map((event, index) =>
            <li key={`${event.versionId}-${index}`}>{event.action.replaceAll("_", " ")} · {event.occurredAt}
              · actor {event.actorPersonId} · {event.reason}</li>)}</ol></details></article>) : <p>No requirement recorded.</p>}
      {rights.author && <form onSubmit={event => {
        event.preventDefault();
        action({ action: "CREATE", label, roleId, siteId,
          serviceId: serviceId || null, courseVersionId, priorEvidence, effectiveFrom: from,
          effectiveUntil: until || null, reason });
      }}>
        <h3>Draft a synthetic requirement</h3>
        <label>Requirement label<input value={label} onChange={event => setLabel(event.target.value)} required minLength={3} maxLength={120} /></label>
        <label>Duty role<select value={roleId} onChange={event => setRoleId(event.target.value)} required>
          <option value="">Select duty role</option>{admin.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select></label>
        <label>Site<select value={siteId} onChange={event => { setSiteId(event.target.value); setServiceId(""); }} required>
          <option value="">Select Site</option>{admin.sites.map(site =>
            <option key={site.id} value={site.id}>{site.name}</option>)}
        </select></label>
        <label>Site Service scope<select value={serviceId} onChange={event => setServiceId(event.target.value)}>
          <option value="">Site-wide, all Services</option>{admin.services.filter(service => service.siteId === siteId).map(service =>
            <option key={service.id} value={service.id}>{service.name}</option>)}
        </select></label>
        <label>Exact CourseVersion<select value={courseVersionId} onChange={event => setCourseVersionId(event.target.value)} required>
          <option value="">Select published version</option>{admin.courses.map(course =>
            <option key={course.id} value={course.id}>{course.title}</option>)}
        </select></label>
        <label>Earlier Completion<select value={priorEvidence} onChange={event => setPriorEvidence(event.target.value)}>
          <option value="NOT_ACCEPTED">Not accepted</option><option value="ACCEPT_IF_CURRENT">Accept if unvoided</option>
        </select></label>
        <label>Effective from<input type="date" value={from} onChange={event => setFrom(event.target.value)} required /></label>
        <label>Effective until, exclusive<input type="date" value={until} onChange={event => setUntil(event.target.value)} /></label>
        <button disabled={busy || reason.trim().length < 10}>Create draft</button>
      </form>}
    </section>}
    {admin && rights.superAdmin && <section className="training-card"><h2>Named pilot grants</h2>
      <p>Only Super Admin manages these grants. A Viewer may be limited to one Site Service.</p>
      <label>Office Person ID<input value={personId} onChange={event => setPersonId(event.target.value)} /></label>
      <label>Capability<select value={capability} onChange={event => setCapability(event.target.value)}>
        <option value="AUTHOR">Author</option><option value="PUBLISHER">Publisher</option><option value="VIEWER">Viewer</option>
      </select></label>
      {capability === "VIEWER" && <label>Viewer Service scope<select value={grantServiceId} required
        onChange={event => setGrantServiceId(event.target.value)}>
        <option value="">Select one Service</option>{admin.services.map(service =>
          <option key={service.id} value={service.id}>{service.name}</option>)}
      </select></label>}
      <label>Grant expires<input type="datetime-local" value={grantUntil}
        onChange={event => setGrantUntil(event.target.value)} required /></label>
      <label>Grant or revocation reason<input value={grantReason} onChange={event => setGrantReason(event.target.value)}
        minLength={10} maxLength={300} /></label>
      <button disabled={busy || grantReason.trim().length < 10 || !grantUntil ||
        (capability === "VIEWER" && !grantServiceId)} onClick={() => action({
        action: "GRANT", personId, capability, serviceId: capability === "VIEWER" ? grantServiceId : null,
        effectiveUntil: new Date(grantUntil).toISOString(), reason: grantReason,
      })}>Grant with reason</button>
      <ul>{admin.grants.filter(grant => !grant.revokedAt).map(grant =>
        <li key={grant.id}>{grant.capability} · {grant.personId} · {grant.serviceId ?? "all Services"}
          <button disabled={busy || grantReason.trim().length < 10} onClick={() =>
            action({ action: "REVOKE_GRANT", grantId: grant.id, reason: grantReason })}>Revoke</button>
        </li>)}</ul>
    </section>}
  </div>;
}
