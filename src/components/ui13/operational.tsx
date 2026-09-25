import type { ReactNode } from "react";
import styles from "./operational.module.css";

/** Presentation only. Callers must supply facts and actions they have already authorised. */
export function ContextHeader({ context, title, description, action }: {
  context: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return <header className={styles.header}>
    <div className={styles.headerCopy}>
      <div className={styles.context}>{context}</div>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {action && <div className={styles.headerAction}>{action}</div>}
  </header>;
}

export type StatusTone = "neutral" | "info" | "attention" | "critical";
const statusToneClass: Record<StatusTone, string> = {
  neutral: styles.neutral,
  info: styles.info,
  attention: styles.toneAttention,
  critical: styles.critical,
};

/** The label is source-specific; tone changes appearance only and never derives a state. */
export function FactualStatus({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return <span className={`${styles.status} ${statusToneClass[tone]}`}><span className={styles.statusDot} aria-hidden="true" />{label}</span>;
}

export type FactualMetric = Readonly<{ label: string; value: string | number; action?: ReactNode; selected?: boolean }>;

export function FactualMetrics({ metrics, className = "" }: { metrics: readonly FactualMetric[]; className?: string }) {
  if (!metrics.length) return null;
  return <dl className={`${styles.metrics} ${className}`}>
    {metrics.map(({ label, value, action, selected }) => <div className={`${styles.metric} ${selected ? styles.selectedMetric : ""}`} key={label}>
      <dt>{label}</dt><dd>{value}</dd>{action && <div className={styles.metricAction}>{action}</div>}
    </div>)}
  </dl>;
}

export function SourceCard({ identity, context, state, tone = "neutral", freshness, metrics, action, primary = false, children }: {
  identity: string;
  context: ReactNode;
  state: string;
  tone?: StatusTone;
  freshness?: ReactNode;
  metrics?: readonly FactualMetric[];
  action?: ReactNode;
  primary?: boolean;
  children?: ReactNode;
}) {
  return <article className={`${styles.sourceCard} ${primary ? styles.primarySource : ""}`}>
    <div className={styles.sourceTop}>
      <div className={styles.sourceIdentity}><div className={styles.context}>{context}</div><h2>{identity}</h2></div>
      <FactualStatus label={state} tone={tone} />
    </div>
    {children && <div className={styles.sourceBody}>{children}</div>}
    {metrics && <FactualMetrics metrics={metrics} />}
    {(freshness || action) && <div className={styles.sourceFoot}>
      {freshness && <div className={styles.freshness}>{freshness}</div>}
      {action && <div className={styles.sourceAction}>{action}</div>}
    </div>}
  </article>;
}

export function AttentionSurface({ title, state, children, action }: {
  title: string;
  state?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return <aside className={styles.attention}>
    <div className={styles.attentionTop}><h2>{title}</h2>{state && <FactualStatus label={state} tone="attention" />}</div>
    {children && <div className={styles.attentionBody}>{children}</div>}
    {action && <div className={styles.attentionAction}>{action}</div>}
  </aside>;
}

export function ActionHierarchy({ primary, secondary, link, destructive }: {
  primary?: ReactNode;
  secondary?: ReactNode;
  link?: ReactNode;
  destructive?: ReactNode;
}) {
  return <div className={styles.actions}>
    {primary && <div className={styles.actionPrimary}>{primary}</div>}
    {secondary && <div className={styles.actionSecondary}>{secondary}</div>}
    {link && <div className={styles.actionLink}>{link}</div>}
    {destructive && <div className={styles.actionDestructive}>{destructive}</div>}
  </div>;
}

export function FilterBar({ children, resultCount, clearAction }: {
  children: ReactNode;
  resultCount?: ReactNode;
  clearAction?: ReactNode;
}) {
  return <div className={styles.filterBar}>
    <div className={styles.filterControls}>{children}{clearAction}</div>
    {resultCount && <div className={styles.resultCount} role="status">{resultCount}</div>}
  </div>;
}

export function FormSection({ title, description, children, error, actions }: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  error?: ReactNode;
  actions?: ReactNode;
}) {
  return <section className={styles.formSection}>
    <div className={styles.formHeading}><h2>{title}</h2>{description && <p>{description}</p>}</div>
    <div className={styles.formFields}>{children}</div>
    {error && <div className={styles.formError} role="alert">{error}</div>}
    {actions && <div className={styles.formActions}>{actions}</div>}
  </section>;
}

export function StatePanel({ kind, title, description, action }: {
  kind: "loading" | "empty" | "error";
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return <div className={`${styles.statePanel} ${kind === "error" ? styles.stateError : ""}`}
    role={kind === "error" ? "alert" : "status"} aria-busy={kind === "loading" || undefined}>
    <h2>{title}</h2>
    {kind === "loading" && <div className={styles.stateSkeleton} aria-hidden="true"><span /><span /></div>}
    <div className={styles.stateDescription}>{description}</div>
    {kind !== "loading" && action && <div className={styles.stateAction}>{action}</div>}
  </div>;
}

export type ResponsiveRecord = Readonly<{
  id: string;
  cells: readonly ReactNode[];
  mobile: Readonly<{ title: ReactNode; status?: ReactNode; details: readonly ReactNode[]; action?: ReactNode }>;
}>;

/** Both views map the same caller-authorised rows; this component never fetches records. */
export function ResponsiveRecordList({ label, columns, rows, empty }: {
  label: string;
  columns: readonly string[];
  rows: readonly ResponsiveRecord[];
  empty?: ReactNode;
}) {
  if (!rows.length) return <div className={styles.empty}>{empty ?? "No records to show."}</div>;
  return <div className={styles.recordList}>
    <div className={styles.tableWrap}><table className={styles.table} aria-label={label}>
      <thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={`${row.id}-${index}`}>{cell}</td>)}</tr>)}</tbody>
    </table></div>
    <ul className={styles.mobileList} aria-label={label}>{rows.map((row) => <li key={row.id}>
      <div className={styles.mobileTop}><strong>{row.mobile.title}</strong>{row.mobile.status}</div>
      <div className={styles.mobileDetails}>{row.mobile.details.map((detail, index) => <span key={`${row.id}-detail-${index}`}>{detail}</span>)}</div>
      {row.mobile.action && <div className={styles.mobileAction}>{row.mobile.action}</div>}
    </li>)}</ul>
  </div>;
}

export function AuditTrail({ events }: { events: readonly Readonly<{ id: string; label: string; actor: string; time: string; version?: string }>[] }) {
  return <ol className={styles.timeline}>{events.map((event) => <li key={event.id}>
    <strong>{event.label}</strong><span>{event.actor} · {event.time}{event.version && ` · ${event.version}`}</span>
  </li>)}</ol>;
}
