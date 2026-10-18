"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RoleCode } from "@/lib/auth/principal";
import { londonToday, londonWeekStart } from "@/lib/events/workforce-week";
import styles from "./home-attention.module.css";

type Kind = "operations" | "schedule" | "notices";
type Row = { id: string; title: string; detail: string; href: string };
type View = { total: number; rows: Row[]; sourceAt?: number; caveat?: string };
type State = { owner: string; phase: "loading" | "ready" | "unavailable" | "denied" | "stale"; view?: View; readAt?: number };
type Props = { accountId: string; roles: RoleCode[]; incidentReviewer: boolean; allowed: string[] };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid source response"); return value as Record<string, unknown>; };
const text = (value: unknown) => { if (typeof value !== "string" || !value.trim()) throw Error("Missing source text"); return value; };
const count = (value: unknown) => { if (!Number.isSafeInteger(value) || Number(value) < 0) throw Error("Invalid source count"); return Number(value); };
const stamp = (value: unknown) => { const raw = text(value); if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw) || !Number.isFinite(Date.parse(raw))) throw Error("Invalid source timestamp"); return Date.parse(raw); };
const rows = (value: unknown) => { if (!Array.isArray(value)) throw Error("Missing source rows"); return value.map(object); };
const source = (value: unknown) => { if (value !== "EVENT" && value !== "SITE_SHIFT") throw Error("Invalid source"); return value; };
const time = (value: number) => new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Read existing source contracts only. No universal priority, eligibility or readiness state.
export function parseHomeAttention(kind: Kind, payload: unknown): View {
  const body = object(payload);
  if (kind === "operations") {
    const snapshot = object(body.snapshot), sourceAt = stamp(snapshot.as_of), total = count(snapshot.attention_total);
    const items = rows(snapshot.attention);
    if (total < items.length) throw Error("Inconsistent source count");
    const result = items.slice(0, 3).map((item): Row => {
      const origin = source(item.source);
      if (!uuid(item.source_id) || !uuid(item.site_id)) throw Error("Invalid source identity");
      return { id: `${origin}:${item.source_id}:${String(item.service_date ?? "")}`, title: text(item.name),
        detail: `${text(item.site_name)} · ${text(item.source_state).replaceAll("_", " ")} · ${count(item.required)} required / ${count(item.allocated)} allocated · ${count(item.awaiting_response)} awaiting response`,
        href: origin === "EVENT" ? `/events/${item.source_id}` : `/sites/${item.site_id}/services/${item.source_id}` };
    });
    return { total, rows: result, sourceAt,
      caveat: `Showing ${result.length} of ${items.length} records on this page. ${snapshot.incidents === null ? "Incident information is unavailable." : "Open Control Room for incident details."}` };
  }
  if (kind === "notices") {
    if (body.section !== "REQUIRES_ACTION") throw Error("Unexpected Action Centre section");
    const total = count(body.total), items = rows(body.items);
    if (total < items.length) throw Error("Inconsistent source count");
    return { total, rows: items.slice(0, 3).map((item): Row => {
      if (!uuid(item.id) || !uuid(item.allocationId) || item.requiresAction !== true) throw Error("Invalid action reference");
      const origin = source(item.source ?? "EVENT");
      return { id: text(item.id), title: text(item.eventName), detail: `${text(item.siteName)} · ${text(item.currentMessage)}`,
        href: `/my-deployments?allocationId=${item.allocationId}&source=${origin}` };
    }), caveat: "First page only. Open Action Centre for all notices." };
  }
  const schedule = object(body.schedule), items = rows(schedule.work), total = count(schedule.work_total);
  if (total < items.length) throw Error("Inconsistent source count");
  return { total, rows: items.slice(0, 3).map((item): Row => {
    const origin = source(item.source);
    if (!uuid(item.id)) throw Error("Invalid allocation identity");
    return { id: `${origin}:${item.id}`, title: text(item.event_name),
      detail: `${text(item.site_name)} · ${text(item.status).replaceAll("_", " ")} · Report ${time(stamp(item.report_at))}`,
      href: `/my-duty?allocationId=${item.id}&source=${origin}` };
  }), caveat: "First page of your London-week schedule. Scheduled work does not confirm attendance or worked time." };
}

function useSource(kind: Kind, owner: string, enabled: boolean, accountId: string, roles: RoleCode[], incidentReviewer: boolean, onAuthorityChange: () => void) {
  const [state, setState] = useState<State>({ owner, phase: "loading" });
  const sequence = useRef(0), controller = useRef<AbortController | null>(null);
  const roleKey = [...roles].sort().join(",");
  const load = useCallback(async () => {
    if (!enabled) return;
    const ticket = ++sequence.current;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setState({ owner, phase: "loading" });
    const current = () => ticket === sequence.current && !abort.signal.aborted;
    const authority = async () => {
      const response = await fetch("/api/me", { cache: "no-store", signal: abort.signal });
      if (response.status === 401 || response.status === 403) { if (current()) onAuthorityChange(); return false; }
      if (!response.ok) throw Error("Authority unavailable");
      const identity = object(await response.json()), person = object(identity.person);
      if (person.id !== accountId || !Array.isArray(identity.roles) || [...identity.roles].sort().join(",") !== roleKey || identity.incidentReviewer !== incidentReviewer) {
        if (current()) onAuthorityChange(); return false;
      }
      return true;
    };
    try {
      if (!await authority() || !current()) return;
      const week = londonWeekStart(londonToday());
      const endpoint = kind === "operations" ? "/api/control-room?offset=0" : kind === "notices" ? "/api/action-centre?section=REQUIRES_ACTION&offset=0" : `/api/my-schedule?week=${week}&offset=0`;
      const response = await fetch(endpoint, { cache: "no-store", signal: abort.signal });
      if (!current()) return;
      if (response.status === 401) { onAuthorityChange(); return; }
      if (response.status === 403) { if (await authority() && current()) setState({ owner, phase: "denied" }); return; }
      if (!response.ok) throw Error("Source unavailable");
      const view = parseHomeAttention(kind, await response.json());
      if (!await authority() || !current()) return;
      const readAt = Date.now();
      if (view.sourceAt !== undefined && (readAt - view.sourceAt > 60000 || view.sourceAt > readAt + 5000)) setState({ owner, phase: "stale" });
      else setState({ owner, phase: "ready", view, readAt });
    } catch { if (current()) setState({ owner, phase: "unavailable" }); }
  }, [accountId, enabled, incidentReviewer, kind, onAuthorityChange, owner, roleKey]);
  useEffect(() => {
    const requestVersion = sequence, activeController = controller;
    const timer = setTimeout(() => { void load(); }, 0);
    const onVisible = () => { if (!document.hidden) void load(); };
    const refresh = setInterval(onVisible, 60000);
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(timer); clearInterval(refresh); document.removeEventListener("visibilitychange", onVisible); requestVersion.current++; activeController.current?.abort(); };
  }, [load]);
  useEffect(() => {
    if (state.owner !== owner || state.phase !== "ready" || !state.readAt) return;
    const expiresAt = Math.min(state.readAt + 60000, state.view?.sourceAt === undefined ? Infinity : state.view.sourceAt + 60000);
    const timer = setTimeout(() => setState((old) => old === state ? { owner, phase: "stale" } : old), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [owner, state]);
  return { state: state.owner === owner && enabled ? state : { owner, phase: "loading" as const }, load };
}

function SourcePanel({ kind, title, destination, blocked, onAuthorityChange, ...props }: Props & { kind: Kind; title: string; destination: string; blocked: boolean; onAuthorityChange: () => void }) {
  const owner = JSON.stringify([props.accountId, [...props.roles].sort(), props.incidentReviewer]);
  const { state, load } = useSource(kind, owner, !blocked, props.accountId, props.roles, props.incidentReviewer, onAuthorityChange);
  return <section className={styles.source} aria-label={title}>
    <header><h3>{title}</h3><button type="button" onClick={() => void load()} disabled={state.phase === "loading" || blocked}>Refresh {title}</button></header>
    {blocked ? <p role="alert">Workspace access changed. <Link href="/app">Reload Home</Link> to check your current access.</p> : state.phase === "loading" ? <p role="status">Checking {title.toLowerCase()}…</p> : state.phase === "denied" ? <p role="status">These details aren’t available with your current access.</p> : state.phase === "stale" ? <p role="status">These details need refreshing.</p> : state.phase === "unavailable" ? <p role="status">These details are unavailable. Try refreshing.</p> : <>
      <p className={styles.summary}>{kind === "operations" ? "Control Room attention" : kind === "notices" ? "Notices requiring action" : "Own allocations this week"}: {state.view!.total}</p>
      <p className={styles.freshness}>{state.view!.sourceAt ? `Snapshot ${time(state.view!.sourceAt)}` : `Last checked ${time(state.readAt!)} · Update time unavailable`}</p>
      {state.view!.rows.length ? <ul>{state.view!.rows.map((row) => <li key={row.id}><Link href={row.href}><strong>{row.title}</strong><span>{row.detail}</span><small>Open source →</small></Link></li>)}</ul> : <p>No records returned on this source page.</p>}
      <p className={styles.caveat}>{state.view!.caveat}</p><Link className={styles.destination} href={destination}>Open {title} →</Link>
    </>}
  </section>;
}

export function HomeAttention(props: Props) {
  const owner = JSON.stringify([props.accountId, [...props.roles].sort(), props.incidentReviewer]);
  const [barrier, setBarrier] = useState("");
  const blocked = barrier === owner;
  const onAuthorityChange = useCallback(() => setBarrier(owner), [owner]);
  const panels = [
    props.allowed.includes("/control-room") && { kind: "operations" as const, title: "Control Room", destination: "/control-room" },
    props.allowed.includes("/action-centre") && { kind: "notices" as const, title: "Action Centre", destination: "/action-centre" },
    props.allowed.includes("/my-schedule") && { kind: "schedule" as const, title: "My Schedule", destination: "/my-schedule" },
  ].filter((item) => item !== false);
  if (!panels.length) return null;
  return <section className={styles.attention} aria-labelledby="home-source-attention"><div className={styles.heading}><h2 id="home-source-attention">Operational updates</h2><p>Review your work and open a record to check its latest details.</p></div><div className={styles.sources}>{panels.map((panel) => <SourcePanel key={`${owner}:${panel.kind}`} {...props} {...panel} blocked={blocked} onAuthorityChange={onAuthorityChange} />)}</div></section>;
}
