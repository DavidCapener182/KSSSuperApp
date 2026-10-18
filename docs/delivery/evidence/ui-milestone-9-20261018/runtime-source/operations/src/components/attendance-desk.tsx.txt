"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import styles from "./attendance.module.css";

type AttendanceSummary = {
  allocation_id: string; person_name: string; role_name: string; area_label: string; site_name: string; report_at: string;
  attendance: { state: string; check_in_at: string | null; check_out_at: string | null };
};
const time = (value: string | null) => value ? new Date(value).toLocaleString("en-GB", {
  timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
}) : "Not recorded";

/** Attendance-only presentation. Source-specific actions stay in each caller. */
export function AttendanceDesk<T extends AttendanceSummary>({ rows, loading, busy, renderDetail, feedback }: {
  rows: T[]; loading: boolean; busy: boolean; renderDetail: (row: T) => ReactNode; feedback?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const selected = rows.find((row) => row.allocation_id === selectedId);
  return <>
    <section className={styles.register} hidden={loading||rows.length===0} aria-busy={loading} aria-label="Attendance register">
      <header className={styles.registerTitle}><div><h2>Named allocations</h2><p>{rows.length} on this page · observed facts, London times</p></div></header>
      <div className={styles.registerColumns} aria-hidden="true"><span>Officer / duty</span><span>Report time</span><span>Observed attendance</span><span>Recorded state</span><span /></div>
      <ul className={styles.registerList}>{rows.map((row) => <li key={row.allocation_id} className={styles.registerRow} aria-labelledby={`attendance-officer-${row.allocation_id}`}>
        <div><strong id={`attendance-officer-${row.allocation_id}`}>{row.person_name}</strong><span>{row.role_name}{row.area_label ? ` · ${row.area_label}` : ""}</span></div>
        <div><span className={styles.mobileLabel}>Report time</span><time dateTime={row.report_at}>{time(row.report_at)}</time></div>
        <div className={styles.observed}><span>In <b>{time(row.attendance.check_in_at)}</b></span><span>Out <b>{time(row.attendance.check_out_at)}</b></span></div>
        <div><span className={styles.state}>{row.attendance.state.replaceAll("_", " ")}</span></div>
        <Button variant="outline" disabled={busy} aria-label={`Open attendance for ${row.person_name}`} onClick={(event) => { trigger.current = event.currentTarget; setSelectedId(row.allocation_id); }}>Open attendance</Button>
      </li>)}</ul>
    </section>
    <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open && !busy) setSelectedId(null); }}>
      <SheetContent className={styles.deskDrawer} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}
        onCloseAutoFocus={(event) => { event.preventDefault(); if(trigger.current?.isConnected)trigger.current.focus();else document.querySelector<HTMLElement>("[data-attendance-refresh]")?.focus(); }}>
        <SheetHeader className={styles.drawerHeading}><p className={styles.deskEyebrow}>Selected allocation · factual attendance</p><SheetTitle>{selected?.person_name ?? "Attendance"}</SheetTitle>
          <SheetDescription>{selected ? `${selected.site_name} · ${selected.role_name}${selected.area_label ? ` · ${selected.area_label}` : ""}` : "Allocation details"}</SheetDescription></SheetHeader>
        <div className={styles.drawerBody}>{busy && <p role="status">Recording attendance and checking the source…</p>}{feedback}{selected && !loading && renderDetail(selected)}</div>
      </SheetContent>
    </Sheet>
  </>;
}
