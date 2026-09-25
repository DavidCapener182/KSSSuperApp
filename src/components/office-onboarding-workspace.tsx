"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { EmptyState, FeedbackBanner, LoadingBlock } from "@/components/ui/workflow";
import styles from "./identity-admin.module.css";
import "./onboarding-workspace.css";

type QueueView = "MY_CASES" | "TEAM_QUEUE" | "NEEDS_OFFICE" | "WAITING_STAFF" | "BLOCKED" | "CANCELLED";
type QueueRow = { id: string; starterName: string; intendedRole: string; templateVersion: number;
  siteName: string; teamName: string; teamId: string; state: string; verifiedCount: number;
  totalCount: number; blocker: string; nextActor: string; nextAction: string;
  ownerName: string; ownerPersonId: string; lastActivity: string; canOpen: boolean;
  isCover: boolean; canReassign: boolean; canGrantCover: boolean };
type QueueData = { total: number; counts: { activeStarters: number; myCases: number;
  needsOffice: number; waitingStaff: number; blocked: number }; rows: QueueRow[] };
type Member = { personId: string; displayName: string; membershipId: string;
  canCoordinate: boolean; effectiveUntil: string | null };
type Team = { id: string; name: string };
type Person = { personId: string; displayName: string };
type CoverGrant = { id: string; coveringName: string; startsAt: string; endsAt: string; reason: string };

const views: { code: QueueView; label: string }[] = [
  { code: "MY_CASES", label: "My cases" }, { code: "TEAM_QUEUE", label: "Team queue" },
  { code: "NEEDS_OFFICE", label: "Needs Office" }, { code: "WAITING_STAFF", label: "Waiting for Staff" },
  { code: "BLOCKED", label: "Blocked" }, { code: "CANCELLED", label: "Cancelled / history" },
];
const date = (value: string) => new Date(value).toLocaleDateString("en-GB", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export function OfficeOnboardingWorkspace({ superAdmin }: { superAdmin: boolean }) {
  const [view, setView] = useState<QueueView>("MY_CASES");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<QueueData | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<"PIPELINE" | "PEOPLE" | "NEEDS_ACTION">("PIPELINE");
  const [previews, setPreviews] = useState<Partial<Record<QueueView, QueueData>>>({});
  const [previewError, setPreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [eligible, setEligible] = useState<Person[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [publisherPersonId, setPublisherPersonId] = useState("");
  const [publisherUntil, setPublisherUntil] = useState("");
  const [publisherGrantId, setPublisherGrantId] = useState("");
  const [selectedRow, setSelectedRow] = useState<QueueRow | null>(null);
  const [action, setAction] = useState<"reassign" | "cover" | null>(null);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [coverEndsAt, setCoverEndsAt] = useState("");
  const [coverGrants, setCoverGrants] = useState<CoverGrant[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currentPersonId, setCurrentPersonId] = useState("");
  const queueReadTail = useRef<Promise<unknown>>(Promise.resolve());
  const previewInFlight = useRef(false);
  const readQueue = useCallback((url: URL): Promise<QueueData> => {
    // The guarded queue RPC is expensive in synthetic Development. Keep this page's reads
    // sequential so the board does not cause concurrent statement timeouts.
    const pending = queueReadTail.current.then(async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) return response.json() as Promise<QueueData>;
        if (response.status !== 503 || attempt === 1) throw new Error("queue unavailable");
      }
      throw new Error("queue unavailable");
    });
    queueReadTail.current = pending.catch(() => {});
    return pending;
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/onboarding/queue", window.location.origin);
      url.searchParams.set("view", view); url.searchParams.set("search", query);
      url.searchParams.set("offset", String(offset)); url.searchParams.set("limit", "25");
      const result = await readQueue(url);
      setData(result); setError("");
      if (view === "MY_CASES" && !query && offset === 0)
        setPreviews((current) => ({ ...current, MY_CASES: { ...result, rows: result.rows.slice(0, 3) } }));
    } catch { setData(null); setError("The onboarding queue is unavailable. Refresh to try again."); }
    finally { setLoading(false); }
  }, [view, query, offset, readQueue]);
  const loadTeams = useCallback(async (teamId = "") => {
    try {
      const response = await fetch(`/api/onboarding/teams${teamId ? `?teamId=${teamId}` : ""}`, { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      setTeams(result.teams ?? []); setMembers(result.members ?? []); setEligible(result.eligible ?? []);
    } catch { /* Queue remains usable if team administration is unavailable. */ }
  }, []);
  const loadPreviews = useCallback(async (includeMine = false) => {
    if (previewInFlight.current) return;
    previewInFlight.current = true;
    setPreviewLoading(true);
    setPreviewError(false);
    const codes: QueueView[] = includeMine ? ["NEEDS_OFFICE", "WAITING_STAFF", "BLOCKED", "MY_CASES"] :
      ["NEEDS_OFFICE", "WAITING_STAFF", "BLOCKED"];
    for (const code of codes) {
      try {
        const url = new URL("/api/onboarding/queue", window.location.origin);
        url.searchParams.set("view", code); url.searchParams.set("limit", "3"); url.searchParams.set("offset", "0");
        const result = await readQueue(url);
        setPreviews((current) => ({ ...current, [code]: result }));
      } catch { setPreviewError(true); }
    }
    previewInFlight.current = false;
    setPreviewLoading(false);
  }, [readQueue]);
  const effectiveTeam = selectedTeam || teams[0]?.id || "";
  useEffect(() => { void Promise.resolve().then(() => loadQueue()); }, [loadQueue]);
  useEffect(() => { void Promise.resolve().then(() => loadPreviews()); }, [loadPreviews]);
  useEffect(() => { if (superAdmin && workspaceTab === "PEOPLE") void Promise.resolve().then(() => loadTeams(effectiveTeam)); },
    [loadTeams, effectiveTeam, superAdmin, workspaceTab]);

  function chooseView(next: QueueView) { setView(next); setOffset(0); setNotice(""); }
  function openAction(row: QueueRow, next: "reassign" | "cover") {
    setSelectedTeam(row.teamId); setSelectedRow(row); setAction(next); setTarget(""); setReason(""); setCoverEndsAt(""); setError("");
    void loadTeams(row.teamId);
    void fetch("/api/me", { cache: "no-store" }).then((response) => response.json())
      .then((result) => setCurrentPersonId(result.person?.id ?? "")).catch(() => {});
    if (next === "cover") void fetch(`/api/onboarding/${row.id}/cover`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { grants: [] })
      .then((result) => setCoverGrants(result.grants ?? []));
  }
  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!selectedRow || !action || !target || reason.trim().length < 10) return;
    setBusy(true); setError("");
    const body = action === "reassign" ? { newOwnerPersonId: target, reason } :
      { coveringPersonId: target, startsAt: new Date().toISOString(),
        endsAt: new Date(coverEndsAt).toISOString(), reason };
    try {
      const response = await fetch(`/api/onboarding/${selectedRow.id}/${action === "reassign" ? "reassign" : "cover"}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      setNotice(action === "reassign" ? "Case reassigned with history. Open work moved to the new owner." :
        "Named case cover granted for the selected period.");
      setAction(null); setSelectedRow(null); await loadQueue();
    } catch { setError(action === "reassign" ? "Reassignment was denied. Check eligibility and try again." :
      "Cover was denied. Check the 14 day limit, team membership and role."); }
    finally { setBusy(false); }
  }
  async function revokeCover(grantId: string) {
    if (!selectedRow) return;
    setBusy(true);
    const response = await fetch(`/api/onboarding/${selectedRow.id}/cover/${grantId}`, { method: "DELETE" });
    if (response.ok) {
      setCoverGrants((current) => current.filter((grant) => grant.id !== grantId));
      setNotice("Cover revoked."); await loadQueue();
    } else setError("Cover revoke was denied.");
    setBusy(false);
  }
  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveTeam) return;
    const form = new FormData(event.currentTarget);
    const personId = String(form.get("personId") ?? "");
    if (!personId) return;
    setBusy(true);
    const response = await fetch(`/api/onboarding/teams/${effectiveTeam}/members`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        personId, startsAt: new Date().toISOString(), canCoordinate: form.get("coordinator") === "on",
      }),
    });
    if (response.ok) { setNotice("Team membership granted."); await loadTeams(effectiveTeam); await loadQueue(); }
    else setError("Membership grant denied.");
    setBusy(false);
  }
  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newTeamName.trim();
    if (name.length < 3) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/onboarding/teams", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setSelectedTeam(result.id); setNewTeamName("");
      await loadTeams(result.id);
      setNotice("Onboarding team created.");
    } catch { setError("Team creation was denied."); }
    finally { setBusy(false); }
  }
  async function grantPublisher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publisherPersonId || !publisherUntil) return;
    const expiresAt = new Date(publisherUntil).toISOString();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/controlled-documents/grants", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: publisherPersonId, expiresAt }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setPublisherGrantId(result.grantId);
      setNotice("Time-limited synthetic onboarding terms publisher capability granted.");
    } catch { setError("Publisher grant denied. Check active Office role, expiry within 90 days and existing grants."); }
    finally { setBusy(false); }
  }
  async function revokePublisher() {
    if (!publisherGrantId) return;
    setBusy(true); setError("");
    const response = await fetch("/api/controlled-documents/grants", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ grantId: publisherGrantId }),
    });
    if (response.ok) { setPublisherGrantId(""); setNotice("Synthetic publisher capability revoked."); }
    else setError("Publisher revocation was denied.");
    setBusy(false);
  }
  async function updateMember(member: Member, remove: boolean) {
    setBusy(true);
    const response = await fetch(`/api/onboarding/teams/members/${member.membershipId}`, {
      method: remove ? "DELETE" : "PATCH", headers: { "content-type": "application/json" },
      body: remove ? undefined : JSON.stringify({ canCoordinate: !member.canCoordinate }),
    });
    if (response.ok) { setNotice(remove ? "Membership revoked." : "Coordinator authority updated.");
      await loadTeams(effectiveTeam); await loadQueue(); }
    else setError("Team change denied.");
    setBusy(false);
  }

  const possibleRecipients = eligible.filter((person) => person.personId !== selectedRow?.ownerPersonId &&
    (selectedRow?.canOpen || superAdmin || person.personId !== currentPersonId));
  return <main className={`enterprise-main office-onboarding-main office-onboarding-redesign ${styles.surface}`}>
    <header className="office-onboarding-hero">
      <div><p className="eyebrow">People / onboarding · synthetic development</p>
        <h1>Onboarding workspace</h1>
        <p>See what needs attention across authorised starter cases, then open the exact source to act.</p></div>
      <Link href="/onboarding/new">Start a starter case <span aria-hidden="true">↗</span></Link>
    </header>
    <nav className="office-onboarding-product-nav" aria-label="Onboarding workspace">
      {([ ["PIPELINE", "Pipeline"], ["PEOPLE", "People"], ["NEEDS_ACTION", "Needs action"] ] as const).map(([code, title]) =>
        <button type="button" key={code} aria-current={workspaceTab === code ? "page" : undefined}
          onClick={() => { setWorkspaceTab(code); if (code === "NEEDS_ACTION") chooseView("NEEDS_OFFICE"); }}>{title}</button>)}
    </nav>
    {error && <FeedbackBanner tone="error">{error}</FeedbackBanner>}
    {notice && <FeedbackBanner tone="success">{notice}</FeedbackBanner>}
    <section className="office-onboarding-command" aria-labelledby="office-onboarding-attention">
      <div className="office-onboarding-command-head"><div><p className="eyebrow">Current source counts</p><h2 id="office-onboarding-attention">Where work stands</h2></div>
        <p>Counts come from your authorised queue scope. They are not readiness or compliance scores.</p></div>
      <div className="office-onboarding-stats" aria-label="Authorised onboarding counts">
        <div><strong>{data?.counts.needsOffice ?? "—"}</strong><span>Needs Office</span></div>
        <div><strong>{data?.counts.waitingStaff ?? "—"}</strong><span>Waiting for Staff</span></div>
        <div><strong>{data?.counts.blocked ?? "—"}</strong><span>Blocked</span></div>
        <div><strong>{data?.counts.activeStarters ?? "—"}</strong><span>Active starters</span></div>
      </div>
    </section>
    {workspaceTab === "PIPELINE" && <section className="office-onboarding-board" aria-labelledby="onboarding-board-title">
      <div className="office-onboarding-board-heading"><div><p className="eyebrow">Factual work queues</p><h2 id="onboarding-board-title">Follow the next handoff</h2>
        <p>Cases may appear in more than one queue. These are source views, not lifecycle stages or readiness decisions.</p></div>
        <button type="button" onClick={() => void loadPreviews(true)} disabled={previewLoading}>
          {previewLoading ? "Loading previews…" : "Refresh previews"}</button></div>
      {previewError && <FeedbackBanner tone="error">Queue previews are unavailable. Refresh to try again.</FeedbackBanner>}
      <div className="office-onboarding-board-lanes">{([ ["NEEDS_OFFICE", "Office action", "Review and request evidence"], ["WAITING_STAFF", "Waiting for Staff", "Information and responses"], ["BLOCKED", "Blocked", "Source dependencies"], ["MY_CASES", "My cases", "Owner and named cover"] ] as const).map(([code, title, description]) =>
        <section key={code} className="office-onboarding-lane" aria-label={title}><div className="office-onboarding-lane-heading"><span>{title}</span><strong>{previews[code]?.total ?? "—"}</strong></div><p>{description}</p>
          {previews[code]?.rows.length ? <ol>{previews[code]?.rows.map((row) => <li key={row.id}>
            <span className="office-onboarding-lane-person">{row.starterName}</span><small>{row.intendedRole.replaceAll("_", " ")} · {row.siteName}</small>
            <span className="office-onboarding-lane-action"><b>{row.nextActor.replaceAll("_", " ")}</b> · {row.nextAction}</span>
            <small>Owner {row.ownerName} · Last activity {date(row.lastActivity)}</small>
            {row.canOpen ? <Link href={`/onboarding/${row.id}`}>Continue case <span aria-hidden="true">↗</span></Link> : <span>Team triage only · detail restricted</span>}
          </li>)}</ol> : !previewError && <p className="office-onboarding-lane-empty">{previews[code] ? "No cases in this authorised queue." : "Loading preview…"}</p>}
          <button type="button" onClick={() => { chooseView(code); setWorkspaceTab(code === "NEEDS_OFFICE" ? "NEEDS_ACTION" : "PEOPLE"); }}>View full queue →</button>
        </section>)}</div>
      <p className="office-onboarding-board-note">Each lane previews up to three authorised cases. Open its full queue for all matching cases.</p>
    </section>}
    {workspaceTab !== "PIPELINE" && <section className="office-onboarding-queue" aria-labelledby="office-onboarding-queue-heading">
      <div className="office-onboarding-queue-head"><div><p className="eyebrow">Case queue</p><h2 id="office-onboarding-queue-heading">{views.find((item) => item.code === view)?.label}</h2>
        <p>Choose a view, inspect the current blocker, and follow only actions you are authorised to take.</p></div>
        <button type="button" onClick={() => void loadQueue()} disabled={loading}>Refresh queue</button></div>
    <div className="office-onboarding-toolbar">
      <nav aria-label="Onboarding queue views" className="office-onboarding-views">
        {views.map((item) => <button type="button" key={item.code} aria-current={view === item.code ? "page" : undefined}
          className={view === item.code ? "is-active" : ""} onClick={() => chooseView(item.code)}>{item.label}</button>)}
      </nav>
      <form role="search" onSubmit={(event) => { event.preventDefault(); setOffset(0); setQuery(search.trim()); }}>
        <label htmlFor="onboarding-search">Search authorised cases</label>
        <div><input id="onboarding-search" value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)}
          placeholder="Starter, owner, state or Site" /><button type="submit">Search</button></div>
      </form>
    </div>
    {loading ? <LoadingBlock label="Loading onboarding queue…" /> : data?.rows.length ? <>
      <ol className="office-onboarding-case-list">{data.rows.map((row) => <li key={row.id} className="office-onboarding-case">
        <div className="office-onboarding-case-top"><div><p className="eyebrow">{row.state === "CANCELLED" ? "Cancelled case · history" : row.teamName}</p>
          <h3>{row.starterName}</h3><p>{row.intendedRole.replaceAll("_", " ")} · {row.siteName}</p></div>
          <span className="office-onboarding-case-progress"><strong>{row.verifiedCount}/{row.totalCount}</strong> requirements</span></div>
        <div className="office-onboarding-case-context"><span>Template v{row.templateVersion}</span><span>{row.state.replaceAll("_", " ")}</span>
          <span>{row.canOpen ? row.isCover ? "Named case cover" : "Current case authority" : "Team triage only"}</span></div>
        <div className="office-onboarding-case-next"><span>Next actor · {row.nextActor.replaceAll("_", " ")}</span>
          <strong>{row.nextAction}</strong></div>
        <div className="office-onboarding-case-footer"><p>Owner <strong>{row.ownerName}</strong><span>Last activity {date(row.lastActivity)}</span></p>
          <div className="office-onboarding-actions">
            {row.canOpen ? <Link href={`/onboarding/${row.id}`}>Open case <span aria-hidden="true">↗</span></Link> : <span>Private case detail restricted</span>}
            {(row.state !== "CANCELLED" && (row.canReassign || row.canGrantCover)) && <details className="office-onboarding-manage"><summary>Manage case</summary>
              {row.canReassign && <button type="button" onClick={() => openAction(row, "reassign")}>Reassign</button>}
              {row.canGrantCover && <button type="button" onClick={() => openAction(row, "cover")}>Arrange cover</button>}</details>}
          </div></div>
      </li>)}</ol>
      <div className="office-onboarding-pager"><span>{offset + 1}–{offset + data.rows.length} of {data.total}</span>
        <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</button>
        <button type="button" disabled={offset + 25 >= data.total} onClick={() => setOffset(offset + 25)}>Next</button></div>
    </> : !error && <EmptyState title={view === "CANCELLED" ? "No cancelled cases" : "No cases in this queue"}
      description="Only cases in your authorised onboarding scope appear here." />}
    </section>}
    <section className={styles.boundary} aria-label="Onboarding access explained">
      <strong>Case access follows the named Person and case</strong>
      <p>Team membership permits queue triage. The current owner, finite named cover, or Super Admin can open private case detail. Document evidence has its own exact request and version checks.</p>
    </section>
    {superAdmin && workspaceTab === "PEOPLE" && <section className="office-onboarding-team-admin" aria-labelledby="team-admin-heading">
      <h2 id="team-admin-heading">Onboarding team administration</h2>
      <p>Team membership enables queue triage. It does not grant private case or evidence access.</p>
      <form onSubmit={createTeam}>
        <label htmlFor="new-onboarding-team">Create onboarding team</label>
        <div className="office-onboarding-actions">
          <input id="new-onboarding-team" value={newTeamName} minLength={3} maxLength={100}
            onChange={(event) => setNewTeamName(event.target.value)} placeholder="Team name" required />
          <button type="submit" disabled={busy || newTeamName.trim().length < 3}>Create team</button>
        </div>
      </form>
      <label htmlFor="onboarding-team-select">Team</label>
      <select id="onboarding-team-select" value={effectiveTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
      <ul>{members.map((member) => <li key={member.membershipId}>
        <span><strong>{member.displayName}</strong><br />Office Person · {member.canCoordinate ? "Same-team coordinator" : "Queue triage"}<br />
          {member.effectiveUntil ? `Ends ${date(member.effectiveUntil)}` : "No end supplied by this membership read"}</span>
        <button type="button" disabled={busy} onClick={() => updateMember(member, false)}>{member.canCoordinate ? "Remove coordinator" : "Make coordinator"}</button>
        <button type="button" disabled={busy} onClick={() => updateMember(member, true)}>Revoke membership</button>
      </li>)}</ul>
      <form onSubmit={addMember}><label htmlFor="new-team-member">Add Office member</label>
        <select id="new-team-member" name="personId" required defaultValue=""><option value="" disabled>Select eligible Office person</option>
          {eligible.filter((person) => !members.some((member) => member.personId === person.personId))
            .map((person) => <option key={person.personId} value={person.personId}>{person.displayName}</option>)}</select>
        <label><input type="checkbox" name="coordinator" /> Same-team reassignment coordinator</label>
        <button type="submit" disabled={busy || !effectiveTeam}>Grant membership</button>
      </form>
    </section>}
    {superAdmin && <section className="office-onboarding-team-admin" aria-labelledby="publisher-admin-heading">
      <h2 id="publisher-admin-heading">Synthetic terms publication</h2>
      <p>Grant one active Office person time-limited publication authority for synthetic onboarding terms only. Case access is checked separately.</p>
      <form onSubmit={grantPublisher}>
        <label htmlFor="publisher-person">Office publisher</label>
        <select id="publisher-person" required value={publisherPersonId} onChange={(event) => setPublisherPersonId(event.target.value)}>
          <option value="">Select active Office person</option>
          {eligible.map((person) => <option key={person.personId} value={person.personId}>{person.displayName}</option>)}
        </select>
        <label htmlFor="publisher-until">Grant expires</label>
        <input id="publisher-until" type="datetime-local" required value={publisherUntil}
          onChange={(event) => setPublisherUntil(event.target.value)} />
        <button type="submit" disabled={busy || !publisherPersonId || !publisherUntil}>Grant synthetic publisher capability</button>
      </form>
      {publisherGrantId && <button type="button" disabled={busy} onClick={() => void revokePublisher()}>
        Revoke grant created here
      </button>}
    </section>}
    {action && selectedRow && <div className="office-onboarding-dialog-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="onboarding-action-heading" className="office-onboarding-dialog">
        <h2 id="onboarding-action-heading">{action === "reassign" ? "Reassign case" : "Arrange named case cover"}</h2>
        <p>{selectedRow.starterName} · Current owner: {selectedRow.ownerName}</p>
        <form onSubmit={submitAction}>
          <label htmlFor="onboarding-action-person">{action === "reassign" ? "New owner" : "Covering Office person"}</label>
          <select id="onboarding-action-person" required value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="">Select active team member</option>{possibleRecipients.map((person) =>
              <option key={person.personId} value={person.personId}>{person.displayName}</option>)}</select>
          {action === "cover" && <><label htmlFor="onboarding-cover-end">Cover ends (maximum 14 calendar days)</label>
            <input id="onboarding-cover-end" type="datetime-local" required value={coverEndsAt}
              onChange={(event) => setCoverEndsAt(event.target.value)} /></>}
          <label htmlFor="onboarding-action-reason">Reason</label>
          <textarea id="onboarding-action-reason" required minLength={10} maxLength={500} value={reason}
            onChange={(event) => setReason(event.target.value)} placeholder="Why is this ownership change or cover needed?" />
          <div className="office-onboarding-actions"><button type="submit" disabled={busy || !target || reason.trim().length < 10 || (action === "cover" && !coverEndsAt)}>
            {busy ? "Saving…" : action === "reassign" ? "Confirm reassignment" : "Grant cover"}</button>
            <button type="button" onClick={() => { setAction(null); setSelectedRow(null); }}>Close</button></div>
        </form>
        {action === "cover" && coverGrants.length > 0 && <div><h3>Current cover</h3><ul>
          {coverGrants.map((grant) => <li key={grant.id}><strong>{grant.coveringName}</strong> · named case cover<br />
            {date(grant.startsAt)} to {date(grant.endsAt)} · Reason: {grant.reason}
            <button type="button" disabled={busy} onClick={() => revokeCover(grant.id)}>Revoke</button></li>)}
        </ul></div>}
      </section>
    </div>}
  </main>;
}
