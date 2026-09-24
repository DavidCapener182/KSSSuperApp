"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./time-away.module.css";

type Team = { id: string; name: string; actions?: string[] };
type Category = { code: string; version: number; label: string };
type Segment = { kind: "WHOLE_DAY" | "PARTIAL_DAY"; date: string; startsLocal?: string; endsLocal?: string;
  startsAt?: string; endsAt?: string };
type Summary = { id: string; personName: string; categoryLabel: string; state: string; revision: number;
  startsOn: string; endsOn: string; teamId: string | null; segments?: Segment[] };
type Detail = Summary & { teamName: string | null; categoryCode: string; segments: Segment[];
  history: { revision: number; kind: string; occurredAt: string }[];
  decisions: { kind: string; reasonCode: string; occurredAt: string }[] };
type Authority = { categories: Category[]; myTeams: Team[]; managerTeams: Team[]; canAdmin: boolean };
type Admin = { teams: (Team & { active: boolean; revision: number })[];
  memberships: { id: string; teamId: string; personId: string; personName: string; effectiveFrom: string; effectiveUntil: string | null; revokedAt: string | null }[];
  grants: { id: string; teamId: string; personId: string; personName: string; actions: string[]; effectiveUntil: string; revokedAt: string | null }[];
  people: { id: string; name: string }[] };
type Conflict = { allocations: { source: string; allocationId: string; allocationResponse: string;
  duty: string; reportAt: string; endsAt: string; remainingPositions: number }[];
  activeAllocationCount: number; affectedDutyCountWithRemainingPositions: number; allocationChanged: boolean };

const label: Record<string, string> = {
  DRAFT: "Draft", SUBMITTED: "Submitted", APPROVED: "Approved", DECLINED: "Declined",
  WITHDRAWN: "Withdrawn", CANCELLED: "Cancelled", CANCELLATION_REQUESTED: "Cancellation requested",
};
const grantActions = ["VIEW_REQUESTS", "DECIDE_REQUEST", "DECIDE_CANCELLATION", "VIEW_CALENDAR", "VIEW_COVERAGE"];
const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" })
  .format(new Date());
function dateSeries(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return [];
  const first = new Date(`${from}T12:00:00Z`), last = new Date(`${to}T12:00:00Z`);
  if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime())) return [];
  const days = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
  if (days > 366) return [];
  return Array.from({ length: days }, (_, index) => new Date(first.getTime() + index * 86_400_000).toISOString().slice(0, 10));
}
async function api(url: string, body?: object): Promise<unknown> {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Time Away unavailable");
  return data;
}
function formatDay(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00Z`)); }
function formatMoment(value: string) { return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

export function TimeAwayClient({ view }: { view: "staff" | "manager" }) {
  const [authority, setAuthority] = useState<Authority | null>(null);
  const [items, setItems] = useState<Summary[]>([]);
  const [total, setTotal] = useState(0);
  const [team, setTeam] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => londonToday().slice(0, 7));
  const [calendarItems, setCalendarItems] = useState<Summary[]>([]);
  const [calendarTotal, setCalendarTotal] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [category, setCategory] = useState("ANNUAL_LEAVE");
  const [mode, setMode] = useState<"WHOLE_DAY" | "PARTIAL_DAY">("WHOLE_DAY");
  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const [partial, setPartial] = useState<{ date: string; startsLocal: string; endsLocal: string }[]>([
    { date: "", startsLocal: "09:00", endsLocal: "13:00" },
  ]);
  const [draftId, setDraftId] = useState(""); const [draftRevision, setDraftRevision] = useState(0);
  const [savedPreview, setSavedPreview] = useState<Segment[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [reason, setReason] = useState("APPROVED_AS_REQUESTED");
  const [adminName, setAdminName] = useState(""); const [adminTeam, setAdminTeam] = useState("");
  const [adminPerson, setAdminPerson] = useState(""); const [adminUntil, setAdminUntil] = useState("");
  const [adminEnd, setAdminEnd] = useState("");
  const [adminActions, setAdminActions] = useState(grantActions);
  const [adminReason, setAdminReason] = useState("");

  const preview = useMemo<Segment[]>(() => mode === "WHOLE_DAY"
    ? dateSeries(startDate, endDate).map((date) => ({ kind: "WHOLE_DAY", date }))
    : partial.filter((row) => row.date && row.startsLocal && row.endsLocal)
      .map((row) => ({ kind: "PARTIAL_DAY" as const, ...row })).sort((a, b) =>
        `${a.date}${a.startsLocal}`.localeCompare(`${b.date}${b.startsLocal}`)),
  [mode, startDate, endDate, partial]);
  const previewKey = (segments: Segment[]) => JSON.stringify(segments.map((entry) =>
    [entry.kind, entry.date, entry.startsLocal ?? null, entry.endsLocal ?? null]));
  const draftMatchesPreview = previewKey(preview) === previewKey(savedPreview);

  const refreshAuthority = useCallback(async () => {
    const result = await api("/api/time-away?mode=authority") as Authority;
    setAuthority(result);
    if (view === "manager" && !team && result.managerTeams.length) setTeam(result.managerTeams[0].id);
    if (view === "staff" && result.myTeams.length === 1) setSelectedTeam(result.myTeams[0].id);
  }, [view, team]);
  const refreshList = useCallback(async () => {
    if (view === "manager" && !team) { setItems([]); setTotal(0); return; }
    const query = new URLSearchParams({ mode: "list" });
    if (view === "manager") query.set("team", team);
    if (from) query.set("from", from); if (to) query.set("to", to);
    const result = await api(`/api/time-away?${query}`) as { items: Summary[]; total: number };
    setItems(result.items); setTotal(result.total);
  }, [view, team, from, to]);
  useEffect(() => {
    let live = true;
    api("/api/time-away?mode=authority").then((value) => {
      if (!live) return;
      const result = value as Authority;
      setAuthority(result);
      if (view === "manager" && result.managerTeams.length) setTeam((current) => current || result.managerTeams[0].id);
      if (view === "staff" && result.myTeams.length === 1) setSelectedTeam(result.myTeams[0].id);
    }).catch((cause) => { if (live) setError(cause.message); });
    return () => { live = false; };
  }, [view]);
  useEffect(() => {
    if (view === "manager" && !team) return;
    let live = true;
    const query = new URLSearchParams({ mode: "list" });
    if (view === "manager") query.set("team", team);
    if (from) query.set("from", from); if (to) query.set("to", to);
    api(`/api/time-away?${query}`).then((value) => {
      if (live) { const result = value as { items: Summary[]; total: number }; setItems(result.items); setTotal(result.total); }
    }).catch((cause) => { if (live) setError(cause.message); });
    return () => { live = false; };
  }, [view, team, from, to]);
  const calendarBounds = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(calendarMonth)) return null;
    const [year, month] = calendarMonth.split("-").map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { start: `${calendarMonth}-01`, end: `${calendarMonth}-${String(last).padStart(2, "0")}` };
  }, [calendarMonth]);
  useEffect(() => {
    if (view !== "manager" || !team || !calendarBounds ||
      !authority?.managerTeams.find((entry) => entry.id === team)?.actions?.includes("VIEW_CALENDAR")) return;
    let live = true;
    const query = new URLSearchParams({ mode: "list", team, view: "VIEW_CALENDAR", from: calendarBounds.start,
      to: calendarBounds.end, limit: "50" });
    api(`/api/time-away?${query}`).then((value) => {
      if (live) { const result = value as { items: Summary[]; total: number }; setCalendarItems(result.items); setCalendarTotal(result.total); }
    }).catch((cause) => { if (live) setError(cause.message); });
    return () => { live = false; };
  }, [view, team, calendarBounds, authority]);

  async function openDetail(id: string) {
    try {
      setError("");
      const found = await api(`/api/time-away?mode=detail&id=${id}`) as Detail;
      setDetail(found); setConflict(null);
      if (view === "manager" && authority?.managerTeams.find((entry) => entry.id === found.teamId)?.actions?.includes("VIEW_COVERAGE")) {
        setConflict(await api(`/api/time-away?mode=conflicts&id=${id}`) as Conflict);
      }
    } catch (cause) { setError((cause as Error).message); }
  }
  async function act(action: string, target = detail) {
    if (!target) return;
    try {
      setError("");setNotice("");
      const reasonForAction = action === "APPROVED" ? "APPROVED_AS_REQUESTED"
        : action === "CANCELLATION_APPROVED" ? "CANCELLATION_ACCEPTED"
        : action === "DECLINED" ? (["STAFFING_CONFLICT", "REQUEST_NOT_SUPPORTED", "OTHER"].includes(reason) ? reason : "REQUEST_NOT_SUPPORTED")
        : action === "CANCELLATION_REJECTED" ? (["CANCELLATION_NOT_SUPPORTED", "OTHER"].includes(reason) ? reason : "CANCELLATION_NOT_SUPPORTED")
        : null;
      await api("/api/time-away", { action, requestId: target.id, expectedRevision: target.revision,
        key: crypto.randomUUID(), reason: reasonForAction });
      setNotice(`Request ${label[action] ?? action.toLowerCase().replaceAll("_", " ")}.`);
      await Promise.all([openDetail(target.id), refreshList()]);
    } catch (cause) { setError((cause as Error).message); }
  }
  async function saveDraft() {
    try {
      setError("");setNotice("");
      if (!preview.length) throw new Error("Preview at least one covered date before saving.");
      if (preview[0].date < londonToday()) throw new Error("The first date must be today or later in Europe/London.");
      const result = await api("/api/time-away", { action: "SAVE_DRAFT", requestId: draftId || null,
        category, segments: preview, expectedRevision: draftRevision, key: crypto.randomUUID() }) as { result: string };
      const found = await api(`/api/time-away?mode=detail&id=${result.result}`) as Detail;
      setDraftId(found.id);setDraftRevision(found.revision);setDetail(found);
      setSavedPreview(preview);
      setNotice("Draft saved. Review every covered date and time before submission.");
      await refreshList();
    } catch (cause) { setError((cause as Error).message); }
  }
  async function submit() {
    try {
      setError("");setNotice("");
      if (!draftId) throw new Error("Save and review a draft first.");
      if (!draftMatchesPreview) throw new Error("Save and review your changed period before submitting.");
      if (!selectedTeam && (authority?.myTeams.length ?? 0) > 1) throw new Error("Choose one Time Away team.");
      await api("/api/time-away", { action: "SUBMIT", requestId: draftId, teamId: selectedTeam || null,
        expectedRevision: draftRevision, key: crypto.randomUUID() });
      setNotice("Request submitted to its selected Time Away team.");
      setDraftId("");setDraftRevision(0);
      setSavedPreview([]);
      await Promise.all([openDetail(draftId),refreshList()]);
    } catch (cause) { setError((cause as Error).message); }
  }
  async function adminAction(action: string, extra: Record<string, unknown>) {
    try {
      setError("");setNotice("");
      await api("/api/time-away", { action, reason: adminReason, ...extra });
      setNotice("Time Away authority updated with attributable history.");
      setAdmin(await api("/api/time-away?mode=admin") as Admin);
      await refreshAuthority();
    } catch (cause) { setError((cause as Error).message); }
  }

  const managerActions = authority?.managerTeams.find((entry) => entry.id === detail?.teamId)?.actions ?? [];
  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Workforce · synthetic Dev</p>
      <h1>{view === "staff" ? "My Time Away" : "Time Away requests"}</h1>
      <p>Requests and decisions are separate from Availability, allocations, attendance and pay.</p></div></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}

    {view === "staff" && <section className={styles.panel} aria-label="New Time Away request">
      <h2>New request</h2><p>Choose a category label and preview each covered date before submission.</p>
      <div className={styles.grid}>
        <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>
          {(authority?.categories ?? []).map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}</select></label>
        <label>Period type<select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
          <option value="WHOLE_DAY">Whole days</option><option value="PARTIAL_DAY">Partial day segments</option></select></label>
      </div>
      {mode === "WHOLE_DAY" ? <div className={styles.grid}>
        <label>First day<input type="date" min={londonToday()} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label>Last day<input type="date" min={startDate || londonToday()} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      </div> : <div className={styles.stack}>{partial.map((row, index) => <div className={styles.grid} key={index}>
        <label>Date<input type="date" min={londonToday()} value={row.date} onChange={(event) => setPartial(partial.map((entry, i) => i === index ? { ...entry, date: event.target.value } : entry))} /></label>
        <label>From<input type="time" value={row.startsLocal} onChange={(event) => setPartial(partial.map((entry, i) => i === index ? { ...entry, startsLocal: event.target.value } : entry))} /></label>
        <label>To<input type="time" value={row.endsLocal} onChange={(event) => setPartial(partial.map((entry, i) => i === index ? { ...entry, endsLocal: event.target.value } : entry))} /></label>
        <button type="button" className={styles.subtle} onClick={() => setPartial(partial.filter((_, i) => i !== index))}>Remove</button>
      </div>)}<button type="button" className={styles.subtle} onClick={() => setPartial([...partial, { date: "", startsLocal: "09:00", endsLocal: "13:00" }])}>Add segment</button></div>}
      <div className={styles.preview}><h3>Covered dates and times</h3>
        {preview.length ? <ol>{preview.map((segment, index) => <li key={`${segment.date}-${index}`}>
          {formatDay(segment.date)} · {segment.kind === "WHOLE_DAY" ? "Whole day" : `${segment.startsLocal}–${segment.endsLocal} Europe/London`}</li>)}</ol>
          : <p>Enter dates to preview the request.</p>}
      </div>
      <div className={styles.actions}><button type="button" onClick={saveDraft}>Save draft</button>
        {draftId && <><label>Approval team<select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
          <option value="">{authority?.myTeams.length ? "Select a team" : "No active team membership"}</option>
          {(authority?.myTeams ?? []).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
          <button type="button" onClick={submit} disabled={!authority?.myTeams.length || !draftMatchesPreview}>Submit request</button></>}</div>
      {!authority?.myTeams.length && <p className={styles.muted}>A draft can be saved now. An administrator must configure your Time Away team before submission.</p>}
    </section>}

    <section className={styles.panel}><div className={styles.sectionHead}><h2>{view === "staff" ? "My requests" : "Team requests and calendar"}</h2>
      <span>{total} visible requests</span></div>
      {view === "manager" && <label>Time Away team<select value={team} onChange={(event) => { setTeam(event.target.value);setDetail(null); }}>
        <option value="">Select an authorised team</option>
        {(authority?.managerTeams ?? []).filter((entry) => entry.actions?.includes("VIEW_REQUESTS"))
          .map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
      <div className={styles.grid}><label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
      <div className={styles.list}>{items.map((item) => <button className={styles.request} key={item.id} onClick={() => openDetail(item.id)}>
        <span><strong>{item.categoryLabel}</strong><small>{view === "manager" ? `${item.personName} · ` : ""}{formatDay(item.startsOn)}–{formatDay(item.endsOn)}</small></span>
        <span className={styles.state}>{label[item.state] ?? item.state}</span></button>)}</div>
      {!items.length && <p className={styles.muted}>No requests in this authorised view.</p>}
    </section>

    {view === "manager" && authority?.managerTeams.find((entry) => entry.id === team)?.actions?.includes("VIEW_CALENDAR") && calendarBounds &&
      <section className={styles.panel} aria-label="Time Away calendar">
        <div className={styles.sectionHead}><h2>Team calendar</h2><label>Month<input type="month" value={calendarMonth}
          onChange={(event) => setCalendarMonth(event.target.value)} /></label></div>
        <p className={styles.muted}>Only requests bound to this exact authorised Time Away team are shown.</p>
        <div className={styles.calendar}>
          {dateSeries(calendarBounds.start, calendarBounds.end).map((day) => {
            const visible = calendarItems.filter((item) => item.startsOn <= day && item.endsOn >= day);
            return <div className={styles.calendarDay} key={day}><strong>{formatDay(day)}</strong>
              {visible.map((item) => { const onDay = (item.segments ?? []).filter((segment) => segment.date === day);
                const times = onDay.some((segment) => segment.kind === "WHOLE_DAY") ? "Whole day"
                  : onDay.map((segment) => `${segment.startsLocal?.slice(0, 5)}–${segment.endsLocal?.slice(0, 5)}`).join(", ");
                const content = `${item.personName} · ${item.categoryLabel} · ${times || "Time away"} · ${label[item.state] ?? item.state}`;
                return authority?.managerTeams.find((entry) => entry.id === team)?.actions?.includes("VIEW_REQUESTS")
                  ? <button type="button" key={item.id} onClick={() => openDetail(item.id)}>{content}</button>
                  : <span className={styles.calendarFact} key={item.id}>{content}</span>; })}</div>;
          })}
        </div>
        {calendarTotal > calendarItems.length && <p className={styles.muted}>Showing {calendarItems.length} of {calendarTotal} visible requests. Narrow the date range for complete results.</p>}
      </section>}

    {detail && <section className={styles.panel} aria-label="Time Away request detail">
      <div className={styles.sectionHead}><h2>{detail.categoryLabel} — {label[detail.state] ?? detail.state}</h2><button className={styles.subtle} onClick={() => setDetail(null)}>Close</button></div>
      <p>{detail.personName}{detail.teamName ? ` · ${detail.teamName}` : ""}</p>
      <h3>Exact period</h3><ol>{detail.segments.map((segment, index) => <li key={index}>
        {formatDay(segment.date)} · {segment.kind === "WHOLE_DAY" ? "Whole day" : `${segment.startsLocal?.slice(0, 5)}–${segment.endsLocal?.slice(0, 5)} Europe/London`}</li>)}</ol>
      {detail.state === "CANCELLATION_REQUESTED" && <p className={styles.notice}>Cancellation requested. The approved period remains effective until an approver decides.</p>}
      {view === "staff" && <div className={styles.actions}>
        {detail.state === "DRAFT" && <button type="button" onClick={() => { setDraftId(detail.id);setDraftRevision(detail.revision);setCategory(detail.categoryCode);
          setSavedPreview(detail.segments.map((segment) => ({ ...segment,
            startsLocal: segment.startsLocal?.slice(0, 5), endsLocal: segment.endsLocal?.slice(0, 5) })));
          setMode(detail.segments.some((s) => s.kind === "PARTIAL_DAY") ? "PARTIAL_DAY" : "WHOLE_DAY");
          setStartDate(detail.segments[0]?.date ?? "");setEndDate(detail.segments.at(-1)?.date ?? "");
          setPartial(detail.segments.filter((s) => s.kind === "PARTIAL_DAY").map((s) => ({ date: s.date,
            startsLocal: s.startsLocal?.slice(0, 5) ?? "",endsLocal: s.endsLocal?.slice(0, 5) ?? "" }))); }}>Edit draft</button>}
        {detail.state === "SUBMITTED" && <button type="button" onClick={() => act("WITHDRAWN")}>Withdraw submitted request</button>}
        {detail.state === "APPROVED" && <button type="button" onClick={() => act("CANCELLATION_REQUESTED")}>Request cancellation</button>}
      </div>}
      {view === "manager" && <>
        {conflict && <div className={styles.preview}><h3>Existing allocations</h3>
          {conflict.allocations.length ? <ul>{conflict.allocations.map((row) => <li key={row.allocationId}>
            {formatMoment(row.reportAt)} · {row.source === "EVENT" ? "Event" : "Site shift"} · {row.duty} · {row.allocationResponse}
            {row.remainingPositions > 0 ? ` · ${row.remainingPositions} positions remain` : ""}</li>)}</ul>
            : <p>No active allocations overlap this period.</p>}
          <h3>Planning impact</h3><p>{conflict.activeAllocationCount} active {conflict.activeAllocationCount === 1 ? "allocation" : "allocations"} overlap · {conflict.affectedDutyCountWithRemainingPositions} affected {conflict.affectedDutyCountWithRemainingPositions === 1 ? "duty has" : "duties have"} remaining positions.</p>
          <p>No allocation has been changed.</p></div>}
        {(detail.state === "SUBMITTED" && managerActions.includes("DECIDE_REQUEST") ||
          detail.state === "CANCELLATION_REQUESTED" && managerActions.includes("DECIDE_CANCELLATION")) &&
          <div className={styles.stack}><div className={styles.grid}>
            <label>{detail.state === "SUBMITTED" ? "Reason if declined" : "Reason if cancellation rejected"}
              <select value={detail.state === "SUBMITTED"
                ? (["STAFFING_CONFLICT", "REQUEST_NOT_SUPPORTED", "OTHER"].includes(reason) ? reason : "REQUEST_NOT_SUPPORTED")
                : (["CANCELLATION_NOT_SUPPORTED", "OTHER"].includes(reason) ? reason : "CANCELLATION_NOT_SUPPORTED")}
                onChange={(event) => setReason(event.target.value)}>
                {detail.state === "SUBMITTED" ? <>
                  <option value="REQUEST_NOT_SUPPORTED">Request not supported</option>
                  <option value="STAFFING_CONFLICT">Staffing conflict</option>
                  <option value="OTHER">Other</option>
                </> : <>
                  <option value="CANCELLATION_NOT_SUPPORTED">Cancellation not supported</option>
                  <option value="OTHER">Other</option>
                </>}
              </select></label>
          </div><div className={styles.actions}>
            {detail.state === "SUBMITTED" ? <><button onClick={() => act("APPROVED")}>Approve</button><button className={styles.subtle} onClick={() => act("DECLINED")}>Decline</button></>
              : <><button onClick={() => act("CANCELLATION_APPROVED")}>Approve cancellation</button><button className={styles.subtle} onClick={() => act("CANCELLATION_REJECTED")}>Reject cancellation</button></>}
          </div></div>}
      </>}
      <h3>Immutable history</h3><ol>{detail.history.map((entry) => <li key={entry.revision}>
        {formatMoment(entry.occurredAt)} · {entry.kind.replaceAll("_", " ")}</li>)}</ol>
    </section>}

    {view === "manager" && authority?.canAdmin && <section className={styles.panel}><div className={styles.sectionHead}>
      <h2>Time Away authority</h2><button className={styles.subtle} onClick={async () => { try { setAdmin(await api("/api/time-away?mode=admin") as Admin); } catch (cause) { setError((cause as Error).message); } }}>Open administration</button></div>
      {admin && <div className={styles.stack}>
        <p>Administration changes team membership and grants only. It does not confer approval authority on your own account.</p>
        <div className={styles.grid}><label>New team name<input value={adminName} onChange={(event) => setAdminName(event.target.value)} /></label>
          <label>Attributable reason<input value={adminReason} maxLength={300} onChange={(event) => setAdminReason(event.target.value)} /></label></div>
        <button onClick={() => adminAction("CREATE_TEAM", { name: adminName })}>Create Time Away team</button>
        {admin.teams.map((entry) => <div className={styles.adminRow} key={entry.id}>
          <span>{entry.name} · {entry.active ? "Active" : "Inactive"}</span>
          <button className={styles.subtle} onClick={() => adminAction("SET_TEAM_ACTIVE", { id: entry.id,
            expectedRevision: entry.revision, actions: [entry.active ? "INACTIVE" : "ACTIVE"] })}>
            {entry.active ? "Deactivate" : "Reactivate"}</button></div>)}
        <div className={styles.grid}><label>Team<select value={adminTeam} onChange={(event) => setAdminTeam(event.target.value)}>
          <option value="">Choose team</option>{admin.teams.filter((entry) => entry.active).map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label>
          <label>Person<select value={adminPerson} onChange={(event) => setAdminPerson(event.target.value)}>
            <option value="">Choose exact Person</option>{admin.people.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label>
          <label>Membership start<input type="date" min={londonToday()} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label>Membership end (optional)<input type="date" min={startDate || londonToday()} value={adminEnd} onChange={(event) => setAdminEnd(event.target.value)} /></label>
          <label>Grant expiry<input type="datetime-local" value={adminUntil} onChange={(event) => setAdminUntil(event.target.value)} /></label></div>
        <fieldset className={styles.grantOptions}><legend>Allowed approver actions</legend>{grantActions.map((action) =>
          <label key={action}><input type="checkbox" checked={adminActions.includes(action)} onChange={(event) => setAdminActions(
            event.target.checked ? [...adminActions, action] : adminActions.filter((item) => item !== action))} />{action.replaceAll("_", " ")}</label>)}</fieldset>
        <div className={styles.actions}><button onClick={() => adminAction("ADD_MEMBER", { teamId: adminTeam,personId: adminPerson,start: startDate,end: adminEnd || null })}>Add dated member</button>
          <button onClick={() => adminAction("GRANT_APPROVER", { teamId: adminTeam,personId: adminPerson,
            until: adminUntil ? new Date(adminUntil).toISOString() : null,
            actions: adminActions })}>Grant finite approver access</button></div>
        <h3>Current membership and grants</h3>
        {admin.memberships.filter((entry) => !entry.revokedAt).map((entry) => <div className={styles.adminRow} key={entry.id}>
          <span>{entry.personName} · {admin.teams.find((teamEntry) => teamEntry.id === entry.teamId)?.name} · from {formatDay(entry.effectiveFrom)}</span>
          <button className={styles.subtle} onClick={() => adminAction("REVOKE_MEMBER", { id: entry.id })}>Revoke</button></div>)}
        {admin.grants.filter((entry) => !entry.revokedAt).map((entry) => <div className={styles.adminRow} key={entry.id}>
          <span>{entry.personName} · {admin.teams.find((teamEntry) => teamEntry.id === entry.teamId)?.name} · expires {formatMoment(entry.effectiveUntil)}</span>
          <button className={styles.subtle} onClick={() => adminAction("REVOKE_APPROVER", { id: entry.id })}>Revoke</button></div>)}
      </div>}
    </section>}
  </main>;
}
