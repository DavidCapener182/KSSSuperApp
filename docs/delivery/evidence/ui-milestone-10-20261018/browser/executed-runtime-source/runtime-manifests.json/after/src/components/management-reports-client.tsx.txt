"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addCivilDays } from "@/lib/events/workforce-week";
import { defaultReportNavigation, parseReportNavigation, reportApiQuery, reportHref, reportNavigationQuery, reportSourceHref, validReportNavigation, type ReportNavigation, type ReportMeasure } from "@/lib/reports/navigation";
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
const clock = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
const title = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, (first) => first.toUpperCase());
export function ManagementReportsClient({ initial, invalidQuery = false }: { initial?: ReportNavigation; invalidQuery?: boolean }) {
  const router = useRouter(); const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [state, setState] = useState<ReportNavigation>(() => initial ?? defaultReportNavigation());
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const [invalidUrl, setInvalidUrl] = useState(invalidQuery);
  const { preset, start, end: endInclusive, mode, client, site, service, event, source, offset, measure: focusMeasure } = state;
  const [reportState, setReport] = useState<Report | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const valid = !invalidUrl && parseReportNavigation(new URLSearchParams(query)) !== null && validReportNavigation(state);
  const requestKey = valid ? reportApiQuery(state) : "";
  const report = valid && loadedKey === requestKey ? reportState : null;

  useEffect(() => {
    const parsed = parseReportNavigation(new URLSearchParams(query));
    const timer = setTimeout(() => {
      setInvalidUrl(!parsed);
      if (!parsed) { setReport(null); return; }
      if (!validReportNavigation(stateRef.current) || reportApiQuery(stateRef.current) !== reportApiQuery(parsed)) setReport(null);
      setState(current => reportNavigationQuery(current) === reportNavigationQuery(parsed) ? current : parsed);
      if (query !== reportNavigationQuery(parsed)) router.replace(reportHref(parsed), { scroll: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [query, router]);

  useEffect(() => {
    const controller = new AbortController(); const current = ++sequence.current;
    const timer = setTimeout(async () => {
      setError(""); setReport(null);
      if (!requestKey) { setLoading(false); return; }
      setLoading(true);
      try {
        const response = await fetch(`/api/management-reports?${requestKey}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 400 ? "Select a valid range of up to 90 London days." : "Management report unavailable. No totals can be shown.");
        const body = await response.json();
        if (!controller.signal.aborted && current === sequence.current) { setLoadedKey(requestKey); setReport(body.report); }
      } catch (caught) {
        if (!controller.signal.aborted && current === sequence.current) { setReport(null); setError(caught instanceof Error ? caught.message : "Management report unavailable."); }
      } finally { if (!controller.signal.aborted && current === sequence.current) setLoading(false); }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [requestKey]);

  function change(patch: Partial<ReportNavigation>) {
    const next = { ...state, ...patch };
    setState(next); setInvalidUrl(false); setError("");
    if (!validReportNavigation(state) || !validReportNavigation(next) || reportApiQuery(state) !== reportApiQuery(next)) setReport(null);
    if (validReportNavigation(next)) router.push(reportHref(next), { scroll: false });
  }
  const updateFilter = (key: "client" | "site" | "service" | "event" | "source") => (value: string) => change({ [key]: value, offset: 0 });
  const destination = (line: Line) => reportSourceHref(line, state);
  const totals = report?.totals;
  const estate = report?.estate_current_state;
  const unavailableConflicts = totals?.unavailable_conflicts;
  const removedConflicts = totals?.removed_coverage_conflicts;
  const explicitConflicts = typeof unavailableConflicts === "number" && Number.isFinite(unavailableConflicts) && typeof removedConflicts === "number" && Number.isFinite(removedConflicts) ? unavailableConflicts + removedConflicts : undefined;
  const metrics = [
    ["Required", totals?.required, "REQUIRED"], ["Allocated", totals?.allocated, "ALLOCATED"],
    ["Accepted", totals?.accepted, "ACCEPTED"], ["Remaining", totals?.remaining, "REMAINING"],
    ["Explicit availability conflicts", explicitConflicts, "EXPLICIT_CONFLICTS"],
  ] as const;
  const estateGroups = [["Clients", estate?.clients], ["Sites", estate?.sites], ["Site Services", estate?.services], ["Events", estate?.events]] as const;
  const activeFilters = [client, site, service, event, source].filter(Boolean).length;
  const clearFilters = () => change({ client: "", site: "", service: "", event: "", source: "", offset: 0 });

  return <main className={`enterprise-main ${styles.page}`}>
    <ContextHeader context="Source reporting · authorised facts" title="Management Reports"
      description="Overview · factual period reporting with source reconciliation." />
    <FilterBar><section className={styles.toolbar} aria-label="Reporting mode and period">
      <label>Report mode<select value={mode} onChange={(event) => change({ mode: event.target.value as ReportNavigation["mode"], offset: 0 })}><option value="CURRENT">Current snapshot</option><option value="HISTORICAL">Historical report</option></select></label>
      <label>Reporting period<select value={preset} onChange={(event) => change({ preset: event.target.value as ReportNavigation["preset"], offset: 0 })}><option value="today">Today</option><option value="last7">Last 7 days</option><option value="last28">Last 28 days</option><option value="custom">Custom, up to 90 days</option></select></label>
      {preset === "custom" && <><label>From<input type="date" value={start} onChange={(event) => change({ start: event.target.value, offset: 0 })} /></label><label>Through<input type="date" value={endInclusive} onChange={(event) => change({ end: event.target.value, offset: 0 })} /></label></>}
    </section></FilterBar>
    <details className={styles.filters}><summary>Filters{activeFilters ? ` · ${activeFilters} applied` : " · all authorised records"}</summary><div className={styles.filterGrid}>
      <label>Client<select value={client} onChange={(event) => updateFilter("client")(event.target.value)}><option value="">All authorised</option>{report?.filters?.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Site<select value={site} onChange={(event) => updateFilter("site")(event.target.value)}><option value="">All authorised</option>{report?.filters?.sites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Site Service<select value={service} onChange={(event) => updateFilter("service")(event.target.value)}><option value="">All authorised</option>{report?.filters?.services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Event<select value={event} onChange={(eventChange) => updateFilter("event")(eventChange.target.value)}><option value="">All authorised</option>{report?.filters?.events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Source<select value={source} onChange={(event) => updateFilter("source")(event.target.value)}><option value="">Event and Site Shift</option><option value="EVENT">Event</option><option value="SITE_SHIFT">Site Shift</option></select></label>
    </div><button type="button" className={styles.clear} onClick={clearFilters} disabled={!activeFilters}>Clear filters</button></details>
    {!valid && <StatePanel kind="error" title="Invalid report context" description="Choose valid filters and an inclusive range of up to 90 London days. No reporting read was sent for this context." />}
    {invalidUrl && <Link href={reportHref(defaultReportNavigation())}>Reset report context</Link>}
    {valid && loading && <StatePanel kind="loading" title="Loading source facts" description="Waiting for the authorised reporting read." />}
    {error && <StatePanel kind="error" title="Management report unavailable" description={error} />}
    {report && !loading && <>
      <div className={styles.context}><p><strong>{report.mode === "CURRENT" ? "Current snapshot" : "Historical report"}</strong> · Reporting period: {report.period_start} to {addCivilDays(report.period_end, -1)} (London dates)</p><p>Data as of {clock(report.data_as_of)}</p><details><summary>Measure definitions and versions</summary><p>{Object.entries(report.definitions).map(([code, version]) => `${code} v${version}`).join(" · ")}</p></details></div>
      {report.status ? <StatePanel kind="empty" title={report.status} description={report.reason ?? "Historical source facts are unavailable."} /> : <>
        <div className={styles.reportLayout}><div className={styles.periodWorkspace}>
        <section aria-labelledby="period-heading"><h2 id="period-heading">Operational demand during period</h2><p className={styles.note}>Select a measure to inspect its authorised source lines below. Totals cover every line in the selected filters; the line list is paginated.</p><FactualMetrics className={styles.metricGrid} metrics={metrics.map(([label, value, code]) => ({
          label,
          value: value?.toLocaleString("en-GB") ?? "Unavailable",
          selected: focusMeasure === code,
          action: <a href="#lines-heading" onClick={(event) => { event.preventDefault(); change({ measure: code as ReportMeasure }); document.getElementById("lines-heading")?.focus(); }}>Inspect {label.toLowerCase()} lines</a>,
        }))} />
          <p className={styles.note}>Allocated and accepted are staffing responses, not attendance or worked time. Missing declarations are unknown.</p>
          <p className={styles.note}>Unavailable conflict: {totals?.unavailable_conflicts ?? "Unavailable"} · Coverage no longer declared: {totals?.removed_coverage_conflicts ?? "Unavailable"} · Missing declaration: {totals?.missing_declarations ?? "Unavailable"} · Partial coverage: {totals?.partial_coverage ?? "Unavailable"}</p>
        </section>
        <section aria-labelledby="lines-heading">
          <h2 id="lines-heading" tabIndex={-1}>Contributing source lines</h2>
          <p>{report.total_lines ?? "Unavailable"} lines; page {Math.floor(offset / 30) + 1}. Totals include all authorised lines for these filters.{focusMeasure ? ` Inspecting ${title(focusMeasure)}; each line still shows all staffing measures.` : ""}</p>
          <ResponsiveRecordList label="Contributing source lines"
            columns={["Source / date", "Client / Site / parent", "State / definition", "Required", "Allocated", "Accepted", "Remaining", "Record"]}
            rows={report.lines?.map((line) => ({
              id: `${line.source}-${line.source_id}`,
              cells: [
                <span key="source"><strong>{line.source === "EVENT" ? "Event requirement" : "Site Shift demand"}</strong><br />{line.service_date}<br /><code>Source UUID: {line.source_id}</code></span>,
                <span key="context">{line.client_name} · {line.site_name} · {line.parent_name}<br /><code>Parent UUID: {line.parent_id}</code></span>,
                <span key="state"><FactualStatus label={line.source_state} /><br />Definition v{line.definition_version}</span>,
                line.required, line.allocated, line.accepted, line.remaining,
                destination(line) ? <Link key="record" href={destination(line)!}>Open source record</Link> : <span key="record">Source unavailable</span>,
              ],
              mobile: {
                title: `${line.source === "EVENT" ? "Event requirement" : "Site Shift demand"} · ${line.service_date}`,
                status: <FactualStatus label={line.source_state} />,
                details: [
                  `${line.client_name} · ${line.site_name} · ${line.parent_name}`,
                  `Required ${line.required} · Allocated ${line.allocated} · Accepted ${line.accepted} · Remaining ${line.remaining}`,
                  <span key="ids"><code>Source UUID: {line.source_id}</code> · <code>Parent UUID: {line.parent_id}</code> · Definition v{line.definition_version}</span>,
                ],
                action: destination(line) ? <Link href={destination(line)!}>Open source record</Link> : <span>Source unavailable</span>,
              },
            })) ?? []}
            empty={<StatePanel kind={report.lines ? "empty" : "not-connected"} title={report.lines ? "No source lines" : "Source lines unavailable"} description={report.lines ? "No source lines for this period and filter selection." : "The current read did not supply contributing source lines; this is not a confirmed zero."} />} />
          <div className={styles.pager}><button type="button" disabled={offset === 0} onClick={() => change({ offset: Math.max(0, offset - 30) })}>Previous</button><button type="button" disabled={offset + 30 >= (report.total_lines ?? 0) || offset + 30 > 10000} onClick={() => change({ offset: offset + 30 })}>Next</button></div>
        </section>
        <details className={styles.breakdown}><summary>Breakdown by Client, Site, Service/Event and date</summary>
        <section aria-labelledby="breakdown-heading"><h2 id="breakdown-heading">Breakdown by Client, Site, Service/Event and date</h2>{!report.breakdowns?.length && <p className={styles.empty}>{report.breakdowns ? "No contributing breakdowns for this period and filter selection." : "Breakdown source unavailable for this read."}</p>}<div className={styles.rows}>{report.breakdowns?.map((row, index) => <article className={styles.row} key={`${row.source}-${row.parent_id}-${row.service_date}-${index}`}><div><strong>{row.client_name} · {row.site_name}</strong><p>{row.source === "EVENT" ? "Event" : "Site Shift"} · {row.parent_name} · {row.service_date}</p></div><p>Required {row.required} · Allocated {row.allocated} · Accepted {row.accepted} · Remaining {row.remaining}</p></article>)}</div></section>
        </details></div><aside className={styles.sourceRail} aria-label="Source coverage and current estate">
        <section aria-labelledby="coverage-heading"><h2 id="coverage-heading">Source coverage</h2><SourceCard identity="Static Site Shift coverage" context="08D materialisation source" state={title(report.static_coverage?.status ?? "unavailable")}
          tone={report.static_coverage?.status === "CURRENT_HORIZON_REPORTED" ? "neutral" : "attention"}
          freshness={`Latest 08D run: ${report.static_coverage?.latest_run_state ?? "unavailable"}${report.static_coverage?.latest_run_at ? ` at ${clock(report.static_coverage.latest_run_at)}` : ""}`}>
          {report.static_coverage?.note && <p>{report.static_coverage.note}</p>}
          <p>Missing materialisation does not mean zero demand.</p>
        </SourceCard></section>
        <details className={styles.estate}><summary>Current operational estate · current read</summary>
        <section aria-labelledby="estate-heading"><h2 id="estate-heading">Current operational estate</h2><p>Current state as of {clock(report.data_as_of)}. The selected reporting period does not describe how long records held these states.</p><div className={styles.cards}>{estateGroups.map(([label, states]) => <article className={styles.card} key={label}><h3>{label}</h3><strong>{states ? Object.values(states).reduce((sum, count) => sum + count, 0) : "Unavailable"}</strong><small>{states ? Object.entries(states).map(([state, count]) => `${title(state)} ${count}`).join(" · ") || "No authorised records" : "Source unavailable"}</small></article>)}</div></section>
        </details></aside></div>
      </>}
    </>}
  </main>;
}
