"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { EmptyState, FeedbackBanner, PageHeader } from "@/components/ui/workflow";

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
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [eligible, setEligible] = useState<Person[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
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

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/onboarding/queue", window.location.origin);
      url.searchParams.set("view", view); url.searchParams.set("search", query);
      url.searchParams.set("offset", String(offset)); url.searchParams.set("limit", "25");
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json()); setError("");
    } catch { setError("The onboarding queue is unavailable. Refresh to try again."); }
    finally { setLoading(false); }
  }, [view, query, offset]);
  const loadTeams = useCallback(async (teamId = "") => {
    try {
      const response = await fetch(`/api/onboarding/teams${teamId ? `?teamId=${teamId}` : ""}`, { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      setTeams(result.teams ?? []); setMembers(result.members ?? []); setEligible(result.eligible ?? []);
    } catch { /* Queue remains usable if team administration is unavailable. */ }
  }, []);
  const effectiveTeam = selectedTeam || teams[0]?.id || "";
  useEffect(() => { void Promise.resolve().then(() => loadQueue()); }, [loadQueue]);
  useEffect(() => { void Promise.resolve().then(() => loadTeams(effectiveTeam)); }, [loadTeams, effectiveTeam]);
  useEffect(() => { void fetch("/api/me", { cache: "no-store" }).then((response) => response.json())
    .then((result) => setCurrentPersonId(result.person?.id ?? "")).catch(() => {}); }, []);

  function chooseView(next: QueueView) { setView(next); setOffset(0); setNotice(""); }
  function openAction(row: QueueRow, next: "reassign" | "cover") {
    setSelectedTeam(row.teamId); setSelectedRow(row); setAction(next); setTarget(""); setReason(""); setCoverEndsAt(""); setError("");
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
  return <main className="enterprise-main office-onboarding-main">
    <PageHeader eyebrow="Synthetic development · Office" title="Onboarding workspace"
      description="Track starters, triage team work and arrange accountable cover. Queue rows show operational status only; private case detail requires separate authority." />
    <div className="office-onboarding-start"><Link href="/onboarding/new">Start synthetic onboarding case</Link></div>
    {error && <FeedbackBanner tone="error">{error}</FeedbackBanner>}
    {notice && <FeedbackBanner tone="success">{notice}</FeedbackBanner>}
    <div className="office-onboarding-stats" aria-label="Authorised onboarding counts">
      <div><strong>{data?.counts.activeStarters ?? "—"}</strong><span>Active starters</span></div>
      <div><strong>{data?.counts.myCases ?? "—"}</strong><span>My cases and cover</span></div>
      <div><strong>{data?.counts.needsOffice ?? "—"}</strong><span>Needs Office</span></div>
      <div><strong>{data?.counts.waitingStaff ?? "—"}</strong><span>Waiting for Staff</span></div>
      <div><strong>{data?.counts.blocked ?? "—"}</strong><span>Blocked</span></div>
    </div>
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
    {loading ? <p role="status">Loading onboarding queue…</p> : data?.rows.length ? <>
      <div className="office-onboarding-table-wrap"><table className="office-onboarding-table">
        <thead><tr><th>Starter / case</th><th>Progress</th><th>Next action</th><th>Owner</th><th>Last activity</th><th>Actions</th></tr></thead>
        <tbody>{data.rows.map((row) => <tr key={row.id}>
          <td><strong>{row.starterName}</strong><small>{row.intendedRole.replaceAll("_", " ")} · Template v{row.templateVersion} · {row.siteName}</small>
            <small>{row.state === "CANCELLED" ? "Cancelled · history" : row.teamName}</small></td>
          <td><strong>{row.verifiedCount} of {row.totalCount}</strong><small>{row.state.replaceAll("_", " ")}</small></td>
          <td><strong>{row.nextActor.replaceAll("_", " ")}</strong><small>{row.nextAction}</small></td>
          <td>{row.ownerName}{row.isCover && <small>Covering</small>}</td>
          <td>{date(row.lastActivity)}</td>
          <td><div className="office-onboarding-actions">
            {row.canOpen ? <Link href={`/onboarding/${row.id}`}>Open case</Link> : <span>Team triage only</span>}
            {row.state !== "CANCELLED" && row.canReassign && <button type="button" onClick={() => openAction(row, "reassign")}>Reassign</button>}
            {row.state !== "CANCELLED" && row.canGrantCover && <button type="button" onClick={() => openAction(row, "cover")}>Cover</button>}
          </div></td>
        </tr>)}</tbody>
      </table></div>
      <ul className="office-onboarding-mobile-list">{data.rows.map((row) => <li key={row.id}>
        <div><strong>{row.starterName}</strong><span>{row.verifiedCount} of {row.totalCount}</span></div>
        <p>{row.intendedRole.replaceAll("_", " ")} · Template v{row.templateVersion} · {row.state.replaceAll("_", " ")}</p>
        <p><b>Next:</b> {row.nextAction} · {row.nextActor}</p><p><b>Owner:</b> {row.ownerName}</p>
        <p><b>Last activity:</b> {date(row.lastActivity)}</p>
        <div className="office-onboarding-actions">
          {row.canOpen ? <Link href={`/onboarding/${row.id}`}>Open case</Link> : <span>Team triage only</span>}
          {row.state !== "CANCELLED" && row.canReassign && <button type="button" onClick={() => openAction(row, "reassign")}>Reassign</button>}
          {row.state !== "CANCELLED" && row.canGrantCover && <button type="button" onClick={() => openAction(row, "cover")}>Cover</button>}
        </div>
      </li>)}</ul>
      <div className="office-onboarding-pager"><span>{offset + 1}–{offset + data.rows.length} of {data.total}</span>
        <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</button>
        <button type="button" disabled={offset + 25 >= data.total} onClick={() => setOffset(offset + 25)}>Next</button></div>
    </> : !error && <EmptyState title={view === "CANCELLED" ? "No cancelled cases" : "No cases in this queue"}
      description="Only cases in your authorised onboarding scope appear here." />}
    {superAdmin && <section className="office-onboarding-team-admin" aria-labelledby="team-admin-heading">
      <h2 id="team-admin-heading">Onboarding team administration</h2>
      <p>Team membership enables queue triage. It does not grant private case or evidence access.</p>
      <label htmlFor="onboarding-team-select">Team</label>
      <select id="onboarding-team-select" value={effectiveTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
      <ul>{members.map((member) => <li key={member.membershipId}>
        <span>{member.displayName}{member.canCoordinate ? " · Coordinator" : ""}</span>
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
          {coverGrants.map((grant) => <li key={grant.id}>{grant.coveringName} · until {date(grant.endsAt)}
            <button type="button" disabled={busy} onClick={() => revokeCover(grant.id)}>Revoke</button></li>)}
        </ul></div>}
      </section>
    </div>}
  </main>;
}
