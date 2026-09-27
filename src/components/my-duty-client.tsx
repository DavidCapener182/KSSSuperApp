"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { addCivilDays, londonToday, londonWeekStart } from "@/lib/events/workforce-week";
import styles from "@/app/(enterprise)/my-duty/my-duty.module.css";

type Source = "EVENT" | "SITE_SHIFT";
type Duty = { source: Source; id: string; status: string; event_status: string; event_name: string; site_name: string; role_name: string; area_label: string; reporting_point: string | null; service_date: string; report_at: string; shift_starts_at: string; shift_ends_at: string; availability_conflict: string | null };
type Attendance = { attendance: { state: string; check_in_at: string | null; check_out_at: string | null } };
type Focus = { id: string; source: Source };

const when = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const key = (item: Focus) => `${item.source}:${item.id}`;
const sourceName = (source: Source) => source === "EVENT" ? "Event duty" : "Site shift";

export function MyDutyClient({ focus }: { focus?: Focus }) {
  const [duties, setDuties] = useState<Duty[]>([]);
  const [selected, setSelected] = useState<Focus | null>(focus ?? null);
  const [duty, setDuty] = useState<Duty | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [partial, setPartial] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const monday = londonWeekStart(londonToday());
      if (!monday) throw new Error("Your duty list is unavailable. Retry to refresh.");
      const next = addCivilDays(monday, 7);
      const previous = addCivilDays(monday, -7);
      const responses = await Promise.all([previous, monday, next].map((week) => fetch(`/api/my-schedule?week=${week}`, { cache: "no-store" })));
      if (responses.some((response) => !response.ok)) throw new Error("Your duty list is unavailable. Retry to refresh.");
      const schedules = await Promise.all(responses.map((response) => response.json()));
      const rows = schedules.flatMap((value) => (value.schedule?.work ?? []) as Duty[]);
      const unique = [...new Map(rows.map((item) => [key(item), item])).values()]
        .filter((item) => ["ALLOCATED", "ACCEPTED"].includes(item.status))
        .sort((a, b) => Date.parse(a.report_at) - Date.parse(b.report_at));
      setDuties(unique);
      setPartial(schedules.some((value) => Number(value.schedule?.work_total ?? 0) > 50));
      if (!focus) {
        const now = Date.now();
        const current = unique.find((item) => Date.parse(item.shift_starts_at) <= now && Date.parse(item.shift_ends_at) >= now);
        const today = unique.find((item) => item.service_date === londonToday() && Date.parse(item.shift_ends_at) >= now);
        const upcoming = unique.find((item) => Date.parse(item.shift_ends_at) >= now);
        const candidate = current ?? today ?? upcoming ?? null;
        setSelected(candidate ? { id: candidate.id, source: candidate.source } : null);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Your duty list is unavailable."); }
    finally { setLoading(false); }
  }, [focus]);

  useEffect(() => { const timer = setTimeout(() => void loadList(), 0); return () => clearTimeout(timer); }, [loadList]);

  const loadDetail = useCallback(async (item: Focus) => {
    setDetailLoading(true); setDetailError(""); setDuty(null); setAttendance(null);
    try {
      const params = new URLSearchParams({ allocationId: item.id, source: item.source });
      const response = await fetch(`/api/deployments/me?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("This duty could not be confirmed from your allocation record.");
      const data = await response.json();
      const exact = ((data.deployments?.items ?? []) as Duty[]).find((row) => key(row) === key(item));
      if (!exact) throw new Error("This allocation is not available in your own duty records.");
      setDuty(exact);
      if (exact.status === "ACCEPTED") {
        const attendanceResponse = await fetch(`/api/attendance/me?${params}`, { cache: "no-store" });
        if (!attendanceResponse.ok) throw new Error("Allocation confirmed, but attendance is unavailable. Refresh before using its state.");
        const attendanceData = await attendanceResponse.json();
        const attendanceRow = ((attendanceData.attendance?.items ?? []) as (Attendance & { source: Source; allocation_id: string })[])
          .find((row) => row.source === item.source && row.allocation_id === item.id);
        if (!attendanceRow) throw new Error("Allocation confirmed, but its attendance record could not be confirmed.");
        setAttendance(attendanceRow);
      }
    } catch (caught) { setDetailError(caught instanceof Error ? caught.message : "Duty detail unavailable."); }
    finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { if (!selected) return; const timer = setTimeout(() => void loadDetail(selected), 0); return () => clearTimeout(timer); }, [selected, loadDetail]);
  useEffect(() => { if (!selected) return; const refresh = () => { if (document.visibilityState === "visible") void loadDetail(selected); }; document.addEventListener("visibilitychange", refresh); return () => document.removeEventListener("visibilitychange", refresh); }, [selected, loadDetail]);

  const sourceQuery = duty ? new URLSearchParams({ allocationId: duty.id, source: duty.source }).toString() : "";
  const today = londonToday();
  const isToday = duty?.service_date === today;
  const phase = attendance?.attendance.check_out_at ? "Completed attendance" : attendance?.attendance.check_in_at ? "On duty" : duty?.status === "ALLOCATED" ? "Response needed" : "Before shift";
  const attendanceMismatch = Boolean(duty && attendance && (
    (attendance.attendance.check_out_at && Date.parse(attendance.attendance.check_out_at) < Date.parse(duty.shift_starts_at) - 2 * 60 * 60 * 1000) ||
    (attendance.attendance.check_in_at && Date.parse(attendance.attendance.check_in_at) > Date.parse(duty.shift_ends_at))
  ));

  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>My work / Duty</p><h1>Today’s Duty</h1><p>Your own allocation, attendance and source actions in one place.</p></div><span className={styles.today}>{new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })}</span></header>
    {error && <div className={styles.alert} role="alert">{error} <button type="button" onClick={() => void loadList()}>Retry</button></div>}
    {loading ? <p role="status">Loading your duties…</p> : <>
      {partial && <p className={styles.note}>This view shows the first 50 duties in each week. Open <Link href="/my-schedule">My Schedule</Link> for the full week.</p>}
      {duties.length > 1 && <div className={styles.switcher}><label htmlFor="duty-select">Choose duty</label><select id="duty-select" value={selected ? key(selected) : ""} onChange={(event) => { const match = duties.find((item) => key(item) === event.target.value); setSelected(match ? { id: match.id, source: match.source } : null); }}><option value="">Select a duty</option>{duties.map((item) => <option key={key(item)} value={key(item)}>{when(item.report_at)} · {item.event_name} · {item.site_name}</option>)}</select></div>}
      {!selected && <section className={styles.empty}><h2>No current or upcoming duty shown</h2><p>This view checks this week and next week. Past duties and a fuller view are in My Schedule.</p><Link href="/my-schedule">Open My Schedule <span aria-hidden="true">→</span></Link></section>}
    </>}
    {selected && detailLoading && <p role="status">Checking this duty’s source records…</p>}
    {selected && detailError && <div className={styles.alert} role="alert">{detailError} <button type="button" onClick={() => void loadDetail(selected)}>Retry</button></div>}
    {duty && !detailLoading && !detailError && <>
      <section className={styles.hero} aria-labelledby="duty-title"><div className={styles.heroTop}><span>{isToday ? "TODAY" : "UPCOMING"} · {sourceName(duty.source)}</span><span className={styles.phase}>{phase}</span></div><h2 id="duty-title">{duty.event_name}</h2><p>{duty.site_name} <span aria-hidden="true">·</span> {duty.role_name}</p><div className={styles.heroFacts}><div><small>Report</small><strong>{when(duty.report_at)}</strong></div><div><small>Shift</small><strong>{when(duty.shift_starts_at)} – {when(duty.shift_ends_at)}</strong></div><div><small>Area</small><strong>{duty.area_label}</strong></div></div>{duty.reporting_point && <p className={styles.reporting}><strong>Reporting point</strong> {duty.reporting_point}</p>}<Link className={styles.primaryAction} href={duty.status === "ALLOCATED" ? `/my-deployments?${sourceQuery}` : `/my-attendance?${sourceQuery}`}>{duty.status === "ALLOCATED" ? "Respond to allocation" : attendance?.attendance.check_out_at ? "Review attendance" : attendance?.attendance.check_in_at ? "Check out or review attendance" : "Check in or review attendance"} <span aria-hidden="true">↗</span></Link></section>
      {attendanceMismatch && <p className={styles.alert} role="status">Recorded attendance falls outside the current scheduled shift. Review the allocation and attendance history before relying on this duty’s timing. <Link href={`/my-attendance?${sourceQuery}`}>Open attendance</Link></p>}
      {duty.availability_conflict && <p className={styles.alert} role="status">{duty.availability_conflict === "UNAVAILABLE_CONFLICT" ? "Availability conflicts with this allocation." : "Your availability declaration no longer covers this allocation."} Your response has not changed. <Link href="/my-availability">Review availability</Link></p>}
      <div className={styles.sections}>
        <section className={styles.panel}><div className={styles.panelHead}><span>01</span><div><p>Before shift</p><h2>Get ready</h2></div></div><div className={styles.rows}><div><span>Allocation response</span><strong>{duty.status === "ALLOCATED" ? "Awaiting your response" : duty.status === "ACCEPTED" ? "Accepted" : duty.status.replaceAll("_", " ")}</strong><Link href={`/my-deployments?${sourceQuery}`}>{duty.status === "ALLOCATED" ? "Respond" : "Open allocation"} <span aria-hidden="true">↗</span></Link></div><div><span>Attendance</span><strong>{duty.status !== "ACCEPTED" ? "Available after acceptance" : attendance?.attendance.check_in_at ? `Checked in · ${when(attendance.attendance.check_in_at)}` : "Not checked in"}</strong>{duty.status === "ACCEPTED" && <Link href={`/my-attendance?${sourceQuery}`}>{attendance?.attendance.check_in_at ? "Review" : "Check in"} <span aria-hidden="true">↗</span></Link>}</div><div><span>Handover</span><strong>Open your authorised Site Books</strong><Link href="/site-book">Find Site Book <span aria-hidden="true">↗</span></Link></div><div><span>Equipment</span><strong>Review your own custody record</strong><Link href="/my-equipment">My equipment <span aria-hidden="true">↗</span></Link></div></div></section>
        <section className={styles.panel}><div className={styles.panelHead}><span>02</span><div><p>During shift</p><h2>Operational tools</h2></div></div><div className={styles.rows}><div><span>Operational contacts</span><strong>{duty.status === "ACCEPTED" ? "Open authorised contacts" : "Available after acceptance"}</strong>{duty.status === "ACCEPTED" && <Link href={`/operational-contacts?${sourceQuery}`}>View contacts <span aria-hidden="true">↗</span></Link>}</div><div><span>Site Book</span><strong>Choose the authorised service book</strong><Link href="/site-book">Open Site Book <span aria-hidden="true">↗</span></Link></div><div><span>Report an incident</span><strong>Choose the exact site or service there</strong><Link href="/incidents">Create incident <span aria-hidden="true">↗</span></Link></div></div></section>
        <section className={styles.panel}><div className={styles.panelHead}><span>03</span><div><p>End of shift</p><h2>Close your records</h2></div></div><div className={styles.rows}><div><span>Attendance</span><strong>{attendance?.attendance.check_out_at ? `Checked out · ${when(attendance.attendance.check_out_at)}` : attendance?.attendance.check_in_at ? "Not checked out" : "No check-in recorded"}</strong>{duty.status === "ACCEPTED" && <Link href={`/my-attendance?${sourceQuery}`}>{attendance?.attendance.check_in_at && !attendance.attendance.check_out_at ? "Check out" : "Open attendance"} <span aria-hidden="true">↗</span></Link>}</div><div><span>Outgoing handover</span><strong>Open your authorised Site Books</strong><Link href="/site-book">Find Site Book <span aria-hidden="true">↗</span></Link></div>{duty.source === "EVENT" && <div><span>Worked time</span><strong>Separate from scheduled hours and attendance</strong><Link href={`/my-work-time?allocationId=${encodeURIComponent(duty.id)}`}>Open worked time <span aria-hidden="true">↗</span></Link></div>}</div></section>
      </div><p className={styles.note}>This screen brings together existing records. It does not approve worked time, verify equipment use or establish duty readiness. <Link href="/my-schedule">View full schedule</Link></p>
    </>}
  </main>;
}
