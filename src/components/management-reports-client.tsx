"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { addCivilDays, londonToday } from "@/lib/events/workforce-week";
import { ContextHeader, FactualMetrics, FactualStatus, FilterBar, ResponsiveRecordList, SourceCard, StatePanel } from "@/components/ui13/operational";
import styles from "./management-reports.module.css";

type Choice = { id: string; name: string };
type Line = {
  source: "EVENT" | "SITE_SHIFT"; source_id: string; parent_id: string; service_id: string | null;
  client_id: string; site_id: string; client_name: string; site_name: string; parent_name: string;
  service_date: string; source_state: string; required: number; allocated: number; accepted: number;
  remaining: number; unavailable_conflicts: number; removed_coverage_conflicts: number;
  missing_declarations: number; partial_coverage: number; definition_version: number;
};
type Report = {
  mode: string; period_start: string; period_end: string; data_as_of: string;
  status?: string; reason?: string; definitions: Record<string, number>;
  estate_current_state?: Record<string, Record<string, number>>;
  static_coverage?: { status: string; latest_run_state: string | null; latest_run_at: string | null; note: string };
  total_lines?: number; totals?: Record<string, number>; lines?: Line[];
  breakdowns?: Array<Pick<Line, "client_id" | "client_name" | "site_id" | "site_name" | "parent_id" | "parent_name" | "service_date" | "source" | "required" | "allocated" | "accepted" | "remaining">>;
  filters?: { clients: Choice[]; sites: Choice[]; services: Choice[]; events: Choice[] };
};
const currentDate = londonToday();
const clock = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
const title = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (first) => first.toUpperCase());
const destination = (line: Line) => line.source === "EVENT" ? `/events/${line.parent_id}` : `/sites/${line.site_id}/services/${line.parent_id}`;

export function ManagementReportsClient() {
  const [preset, setPreset] = useState("last28");
  const [start, setStart] = useState(addCivilDays(currentDate, -27));
  const [endInclusive, setEndInclusive] = useState(currentDate);
  const [mode, setMode] = useState("CURRENT");
  const [client, setClient] = useState(""); const [site, setSite] = useState("");
  const [service, setService] = useState(""); const [event, setEvent] = useState("");
  const [source, setSource] = useState(""); const [offset, setOffset] = useState(0);
  const [focusMeasure, setFocusMeasure] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ preset, mode, offset: String(offset) });
    if (preset === "custom") { params.set("start", start); params.set("end", addCivilDays(endInclusive, 1)); }
    for (const [key, value] of Object.entries({ client, site, service, event, source })) if (value) params.set(key, value);
    try {
      const response = await fetch(`/api/management-reports?${params}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error(response.status === 400 ? "Select a valid range of up to 90 London days." : "Management report unavailable. No totals can be shown.");
      const body = await response.json(); setReport(body.report);
    } catch (caught) {
      if (!signal.aborted) { setReport(null); setError(caught instanceof Error ? caught.message : "Management report unavailable."); }
    } finally { if (!signal.aborted) setLoading(false); }
  }, [preset, start, endInclusive, mode, client, site, service, event, source, offset]);
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => void load(controller.signal), 0); return () => { clearTimeout(timer); controller.abort(); }; }, [load]);

  const updateFilter = (setter: (value: string) => void) => (value: string) => { setter(value); setOffset(0); };
  const totals = report?.totals;
  const estate = report?.estate_current_state;
  const metrics = [
    ["Required", totals?.required, "REQUIRED"], ["Allocated", totals?.allocated, "ALLOCATED"],
    ["Accepted", totals?.accepted, "ACCEPTED"], ["Remaining", totals?.remaining, "REMAINING"],
    ["Explicit availability conflicts", totals ? (totals.unavailable_conflicts ?? 0) + (totals.removed_coverage_conflicts ?? 0) : undefined, "EXPLICIT_CONFLICTS"],
  ] as const;
  const estateGroups = [["Clients", estate?.clients], ["Sites", estate?.sites], ["Site Services", estate?.services], ["Events", estate?.events]] as const;
  const activeFilters = [client, site, service, event, source].filter(Boolean).length;
  const clearFilters = () => { setClient(""); setSite(""); setService(""); setEvent(""); setSource(""); setOffset(0); };

  return <main className={`enterprise-main ${styles.page}`}>
    <ContextHeader context="Synthetic development · source facts" title="Management Reports"
      description="Overview · factual period reporting with source reconciliation." />
    <FilterBar><section className={styles.toolbar} aria-label="Reporting mode and period">
      <label>Report mode<select value={mode} onChange={(event) => { setMode(event.target.value); setOffset(0); }}><option value="CURRENT">Current snapshot</option><option value="HISTORICAL">Historical report</option></select></label>
      <label>Reporting period<select value={preset} onChange={(event) => { setPreset(event.target.value); setOffset(0); }}><option value="today">Today</option><option value="last7">Last 7 days</option><option value="last28">Last 28 days</option><option value="custom">Custom, up to 90 days</option></select></label>
      {preset === "custom" && <><label>From<input type="date" value={start} onChange={(event) => { setStart(event.target.value); setOffset(0); }} /></label><label>Through<input type="date" value={endInclusive} onChange={(event) => { setEndInclusive(event.target.value); setOffset(0); }} /></label></>}
    </section></FilterBar>
    <details className={styles.filters}><summary>Filters{activeFilters ? ` · ${activeFilters} applied` : " · all authorised records"}</summary><div className={styles.filterGrid}>
      <label>Client<select value={client} onChange={(event) => updateFilter(setClient)(event.target.value)}><option value="">All authorised</option>{report?.filters?.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Site<select value={site} onChange={(event) => updateFilter(setSite)(event.target.value)}><option value="">All authorised</option>{report?.filters?.sites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Site Service<select value={service} onChange={(event) => updateFilter(setService)(event.target.value)}><option value="">All authorised</option>{report?.filters?.services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Event<select value={event} onChange={(eventChange) => updateFilter(setEvent)(eventChange.target.value)}><option value="">All authorised</option>{report?.filters?.events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Source<select value={source} onChange={(event) => updateFilter(setSource)(event.target.value)}><option value="">Event and Site Shift</option><option value="EVENT">Event</option><option value="SITE_SHIFT">Site Shift</option></select></label>
    </div><button type="button" className={styles.clear} onClick={clearFilters} disabled={!activeFilters}>Clear filters</button></details>
    {loading && <StatePanel kind="loading" title="Loading source facts" description="Waiting for the authorised reporting read." />}
    {error && <StatePanel kind="error" title="Management report unavailable" description={error} />}
    {report && !loading && <>
      <div className={styles.context}><p><strong>{report.mode === "CURRENT" ? "Current snapshot" : "Historical report"}</strong> · Reporting period: {report.period_start} to {addCivilDays(report.period_end, -1)} (London dates)</p><p>Data as of {clock(report.data_as_of)}</p><details><summary>Measure definitions and versions</summary><p>{Object.entries(report.definitions).map(([code, version]) => `${code} v${version}`).join(" · ")}</p></details></div>
      {report.status ? <StatePanel kind="empty" title={report.status} description={report.reason ?? "Historical source facts are unavailable."} /> : <>
        <section aria-labelledby="period-heading"><h2 id="period-heading">Operational demand during period</h2><p className={styles.note}>Select a measure to inspect its authorised source lines below. Totals cover every line in the selected filters; the line list is paginated.</p><FactualMetrics className={styles.metricGrid} metrics={metrics.map(([label, value, code]) => ({
          label,
          value: value?.toLocaleString("en-GB") ?? "Unavailable",
          selected: focusMeasure === code,
          action: <a href="#lines-heading" onClick={() => setFocusMeasure(code)}>Inspect {label.toLowerCase()} lines</a>,
        }))} />
          <p className={styles.note}>Allocated and accepted are staffing responses, not attendance or worked time. Missing declarations are unknown.</p>
          <p className={styles.note}>Unavailable conflict: {totals?.unavailable_conflicts ?? 0} · Coverage no longer declared: {totals?.removed_coverage_conflicts ?? 0} · Missing declaration: {totals?.missing_declarations ?? 0} · Partial coverage: {totals?.partial_coverage ?? 0}</p>
        </section>
        <section aria-labelledby="estate-heading"><h2 id="estate-heading">Current operational estate</h2><p>Current state as of {clock(report.data_as_of)}. The selected reporting period does not describe how long records held these states.</p><div className={styles.cards}>{estateGroups.map(([label, states]) => <article className={styles.card} key={label}><h3>{label}</h3><strong>{states ? Object.values(states).reduce((sum, count) => sum + count, 0) : "Unavailable"}</strong><small>{states ? Object.entries(states).map(([state, count]) => `${title(state)} ${count}`).join(" · ") || "No authorised records" : "Source unavailable"}</small></article>)}</div></section>
        <section aria-labelledby="coverage-heading"><h2 id="coverage-heading">Source coverage</h2><SourceCard identity="Static Site Shift coverage" context="08D materialisation source" state={title(report.static_coverage?.status ?? "unavailable")}
          tone={report.static_coverage?.status === "CURRENT_HORIZON_REPORTED" ? "neutral" : "attention"}
          freshness={`Latest 08D run: ${report.static_coverage?.latest_run_state ?? "unavailable"}${report.static_coverage?.latest_run_at ? ` at ${clock(report.static_coverage.latest_run_at)}` : ""}`}>
          {report.static_coverage?.note && <p>{report.static_coverage.note}</p>}
          <p>Missing materialisation does not mean zero demand.</p>
        </SourceCard></section>
        <section aria-labelledby="breakdown-heading"><h2 id="breakdown-heading">Breakdown by Client, Site, Service/Event and date</h2>{!report.breakdowns?.length && <p className={styles.empty}>No contributing breakdowns for this period and filter selection.</p>}<div className={styles.rows}>{report.breakdowns?.map((row, index) => <article className={styles.row} key={`${row.source}-${row.parent_id}-${row.service_date}-${index}`}><div><strong>{row.client_name} · {row.site_name}</strong><p>{row.source === "EVENT" ? "Event" : "Site Shift"} · {row.parent_name} · {row.service_date}</p></div><p>Required {row.required} · Allocated {row.allocated} · Accepted {row.accepted} · Remaining {row.remaining}</p></article>)}</div></section>
        <section aria-labelledby="lines-heading">
          <h2 id="lines-heading" tabIndex={-1}>Contributing source lines</h2>
          <p>{report.total_lines ?? 0} lines; page {Math.floor(offset / 30) + 1}. Totals include all authorised lines for these filters.{focusMeasure ? ` Inspecting ${title(focusMeasure)}; each line still shows all staffing measures.` : ""}</p>
          <ResponsiveRecordList label="Contributing source lines"
            columns={["Source / date", "Client / Site / parent", "State / definition", "Required", "Allocated", "Accepted", "Remaining", "Record"]}
            rows={report.lines?.map((line) => ({
              id: `${line.source}-${line.source_id}`,
              cells: [
                <span key="source"><strong>{line.source === "EVENT" ? "Event requirement" : "Site Shift demand"}</strong><br />{line.service_date}<br /><code>Source UUID: {line.source_id}</code></span>,
                <span key="context">{line.client_name} · {line.site_name} · {line.parent_name}<br /><code>Parent UUID: {line.parent_id}</code></span>,
                <span key="state"><FactualStatus label={line.source_state} /><br />Definition v{line.definition_version}</span>,
                line.required, line.allocated, line.accepted, line.remaining,
                <Link key="record" href={destination(line)}>Open source record</Link>,
              ],
              mobile: {
                title: `${line.source === "EVENT" ? "Event requirement" : "Site Shift demand"} · ${line.service_date}`,
                status: <FactualStatus label={line.source_state} />,
                details: [
                  `${line.client_name} · ${line.site_name} · ${line.parent_name}`,
                  `Required ${line.required} · Allocated ${line.allocated} · Accepted ${line.accepted} · Remaining ${line.remaining}`,
                  <span key="ids"><code>Source UUID: {line.source_id}</code> · <code>Parent UUID: {line.parent_id}</code> · Definition v{line.definition_version}</span>,
                ],
                action: <Link href={destination(line)}>Open source record</Link>,
              },
            })) ?? []}
            empty={<StatePanel kind="empty" title="No source lines" description="No source lines for this period and filter selection." />} />
          <div className={styles.pager}><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 30))}>Previous</button><button type="button" disabled={offset + 30 >= (report.total_lines ?? 0)} onClick={() => setOffset(offset + 30)}>Next</button></div>
        </section>
      </>}
    </>}
  </main>;
}
