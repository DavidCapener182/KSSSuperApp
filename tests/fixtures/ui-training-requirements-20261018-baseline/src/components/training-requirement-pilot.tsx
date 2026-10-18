"use client";

import { useEffect, useRef, useState } from "react";
import { TrainingRequirementEvidence, type TrainingRequirementContext as Context } from "@/components/training-requirement-evidence";

import { trainingActionAllowed, trainingAdminReadback, trainingAdminShape } from "@/lib/training/admin-readback";

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

export function TrainingRequirementPilot({ rights, initial, contexts, canReviewCompletions = false }: {
  rights: Rights; initial: Admin | null; contexts: Context[]; canReviewCompletions?: boolean;
}) {
  const [adminRecord, setAdmin] = useState(initial);
  const activeRequest = useRef<AbortController | null>(null);
  const contextKey = JSON.stringify([rights, contexts, canReviewCompletions, initial]);
  const [recordContext] = useState(contextKey);
  const admin = recordContext === contextKey ? adminRecord : null;
  const previousContext = useRef(contextKey);
  const [selected, setSelected] = useState(0);
  const selectedContext = contexts[selected] ?? contexts[0];
  const selectedIndex = contexts[selected] ? selected : 0;
  const [message, setMessage] = useState("");
  const [actionBusy, setBusy] = useState(false);
  const [matrixBusy, setMatrixBusy] = useState(false);
  const busy = actionBusy || matrixBusy;
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

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (previousContext.current !== contextKey) {
      previousContext.current = contextKey;
      timer = setTimeout(() => { activeRequest.current = null; setAdmin(null); setBusy(false);
        setMessage("Context changed. Reload to read the current admin record."); }, 0);
    }
    return () => { clearTimeout(timer); activeRequest.current?.abort(); };
  }, [contextKey]);

  async function action(payload: Record<string, unknown>) {
    if (busy || activeRequest.current || !admin || !trainingActionAllowed(rights, payload.action)) return;
    const controller = new AbortController(); activeRequest.current = controller;
    const before = admin;
    setAdmin(null); setBusy(true); setMessage("Saving and checking the current admin record…");
    try {
      const response = await fetch("/api/training-requirements", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal,
      });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.error ?? "Action unavailable");
      const accessResponse = await fetch("/api/training-requirements?view=access", { cache: "no-store", signal: controller.signal });
      const access = await accessResponse.json();
      if (controller.signal.aborted) return;
      if (!accessResponse.ok || !trainingActionAllowed(access.data, payload.action)) throw new Error("Admin access changed");
      const readResponse = await fetch("/api/training-requirements?view=admin", { cache: "no-store", signal: controller.signal });
      const read = await readResponse.json();
      if (controller.signal.aborted) return;
      if (!readResponse.ok || !trainingAdminShape(read.data) || !trainingAdminReadback(before, read.data, payload, result.data)) throw new Error("Readback unavailable");
      setAdmin(read.data as Admin);
      setMessage(payload.action === "GRANT" || payload.action === "REVOKE_GRANT"
        ? "The requested grant state was confirmed in the refreshed admin record."
        : "The exact requirement change and decision history were confirmed in the refreshed admin record.");
    } catch {
      if (!controller.signal.aborted) setMessage("The action could not be confirmed and may have saved. Reload and verify the current admin record before another change.");
    } finally {
      if (!controller.signal.aborted) { activeRequest.current = null; setBusy(false); }
    }
  }

  return <div className="training-requirement-pilot">
    <p className="training-source-note">Synthetic Training requirement pilot. Assignment, Attempt, Completion, CertificateIssue,
      Credential verification and deployment eligibility are separate decisions. This matrix does not decide whether someone can work.</p>
    {message && <p role="status">{message}</p>}
    <section className="training-card">
      <h2>Requirement matrix</h2>
      <p>Choose an allocated Site Shift context. Results are factual for its Person, duty role, Service and London service date.</p>
      {(rights.staff || rights.viewer) && contexts.length ? <><label>Person and assigned context
        <select value={selectedIndex} onChange={event => setSelected(Number(event.target.value))}>
          {contexts.map((context, index) => <option key={`${context.personId}-${context.serviceId}-${context.roleId}-${context.asOf}`} value={index}>
            {context.personName} · {context.roleName} · {context.serviceName} · {context.asOf}
          </option>)}
        </select></label>{selectedContext && <TrainingRequirementEvidence
          key={JSON.stringify([selectedContext.personId, selectedContext.serviceId, selectedContext.roleId, selectedContext.asOf, rights.staff, rights.viewer, canReviewCompletions])}
          context={selectedContext} actionBusy={actionBusy} onBusyChange={setMatrixBusy} staffLinks={rights.staff && !rights.viewer} canReviewCompletions={canReviewCompletions} />}</>
        : <p>No authorised allocated context in the pilot window.</p>}
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
