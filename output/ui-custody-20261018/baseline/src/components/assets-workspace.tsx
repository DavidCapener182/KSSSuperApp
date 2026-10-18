"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FactualStatus, FilterBar, ResponsiveRecordList, SourceCard, StatePanel, type ResponsiveRecord } from "@/components/ui13/operational";
import styles from "./assets-workspace.module.css";

type Item = { id: string; reference: string; class: string; description: string; condition: string;
  maintenanceState: string; exceptionState: string; holderKind: string; holderId: string;
  holderLabel: string | null; locationLabel: string | null;
  expectedReturnAt: string | null; pendingAck: string | null; revision: number; overdue: boolean; availabilityReason?: string; availableToIssue?: boolean };
type Stock = { id: string; sku: string; garment: string; size: string; available: number; issued: number; revision: number };
type Data = { stores: { id: string; name: string }[]; items: Item[]; stock: Stock[]; contexts?: { kind: string; id: string; label: string }[];
  myStock: { issueId: string; garment: string; size: string; outstanding: number; acknowledgement: string }[] };
type History = { reference: string; serial: string | null; events: { id: string; revision: number; action: string;
  conditionAfter: string; maintenanceAfter: string; holderAfter: string; recordedAt: string; reason: string | null }[] };
type Admin = { operations: { id: string; name: string }[]; scopes: { kind: string; id: string; name: string }[];
  grants: { id: string; personId: string; scopeKind: string; scopeId: string; effectiveUntil: string }[];
  grantEvents: { id: string; grantId: string; kind: string; actorId: string; reason: string; occurredAt: string }[] };
type Holder = { kind: string; id: string; name: string };
type StockHistory = { id: string; sku: string; events: { id: string; revision: number; action: string;
  quantity: number; availableAfter: number; outstandingAfter: number; issueId: string | null;
  recordedAt: string; reason: string | null }[] };

const conditions = ["GOOD", "SERVICEABLE", "DAMAGED", "UNSERVICEABLE", "UNKNOWN"];
const classes = ["RADIO", "KEY_CARD", "PHONE", "LAPTOP_TABLET", "BODYCAM"];
const empty: Data = { stores: [], items: [], stock: [], myStock: [] };
const stamp = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB",
  { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)) : "Not set";
const availabilityReason = (value: Item) => value.availabilityReason ??
  (value.holderKind !== "STORE" ? "Held outside store" : value.pendingAck ? "Handover pending" :
    value.maintenanceState !== "NONE" ? `Repair: ${value.maintenanceState}` :
    value.exceptionState !== "NONE" ? `Exception: ${value.exceptionState}` :
    !["GOOD", "SERVICEABLE"].includes(value.condition) ? `Condition: ${value.condition}` : "Available from store");
const availableToIssue = (value: Item) => (value.availableToIssue ?? availabilityReason(value) === "Available from store") ? "Yes" : "No";

async function api(body?: Record<string, unknown>, query = "") {
  const response = await fetch("/api/assets" + query, body ? {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, requestKey: crypto.randomUUID() }),
  } : { cache: "no-store" });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Asset request failed");
  return body ? json : json.data;
}

export function AssetsWorkspace({ mode, office, operations, superAdmin }: {
  mode: "register" | "self"; office: boolean; operations: boolean; superAdmin: boolean;
}) {
  const [data, setData] = useState<Data>(empty);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistory | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [action, setAction] = useState("ISSUE");
  const [holderKind, setHolderKind] = useState("PERSON");
  const [holderId, setHolderId] = useState("");
  const [condition, setCondition] = useState("GOOD");
  const [reason, setReason] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [message, setMessage] = useState("");
  const [contextFilter, setContextFilter] = useState("");
  const [search, setSearch] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [holderFilter, setHolderFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [repairFilter, setRepairFilter] = useState("");
  const [exceptionFilter, setExceptionFilter] = useState("");
  const [returnFilter, setReturnFilter] = useState("");
  const [view, setView] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [review, setReview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const registerRequest = useRef(0);
  const refresh = useCallback(async () => {
    if (mode === "self") setData(await api(undefined, "?self=1") as Data);
    else {
      const request = ++registerRequest.current;
      const query = new URLSearchParams({ register: "1", page: String(page), size: "30", search,
        view, class: assetClass, holder: holderFilter, condition: conditionFilter,
        repair: repairFilter, exception: exceptionFilter, return: returnFilter });
      if (contextFilter) query.set("context", contextFilter.split(":")[1]);
      for (const [key, value] of [...query]) if (!value) query.delete(key);
      const [support, register] = await Promise.all([
        api(undefined, "?support=1") as Promise<Data>,
        api(undefined, "?" + query.toString()) as Promise<{ items: Item[]; total: number }>]);
      if (request === registerRequest.current) { setData({ ...support, items: register.items }); setTotal(register.total); }
    }
    if (superAdmin && mode === "register") setAdmin(await api(undefined, "?admin=1") as Admin);
    if (operations && mode === "register") {
      try { const choices = await api(undefined, "?holders=1") as { people: Holder[]; places: Holder[] };
        setHolders([...choices.people, ...choices.places]); } catch { setHolders([]); }
    }
  }, [mode, operations, superAdmin, page, search, view, assetClass, holderFilter, contextFilter, conditionFilter, repairFilter, exceptionFilter, returnFilter]);
  const reload = useCallback(async () => {
    setLoading(true); setLoadError("");
    try { await refresh(); }
    catch { setLoadError("Asset view unavailable. Current records could not be confirmed."); }
    finally { setLoading(false); }
  }, [refresh]);
  useEffect(() => {
    if (mode === "register") void Promise.resolve().then(reload);
    else void Promise.resolve().then(refresh).catch(() => setMessage("Asset view unavailable."));
  }, [mode, refresh, reload]);
  async function submit(body: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await api(body) as { result?: { eventId?: string; revision?: number }; receipt?: { eventId: string; revision: number }; error?: string };
      const confirmed = response.receipt && response.receipt.eventId === response.result?.eventId;
      const receiptText = confirmed
        ? `Recorded ${String(body.action).replaceAll("_", " ").toLowerCase()}. Event ${response.receipt?.eventId}; revision ${response.receipt?.revision}.`
        : response.error ?? "Request sent. Review the current source record before retrying.";
      try {
        await refresh();
        if (item) setHistory(await api(undefined, "?assetId=" + encodeURIComponent(item.id)) as History);
        setMessage(receiptText);
      } catch { setMessage(`${receiptText} Current view could not be refreshed.`); }
      setReview(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action unavailable."); }
    finally { setBusy(false); }
  }
  async function open(value: Item) {
    setItem(value); setCondition(value.condition);
    setAction(mode === "self" ? (value.pendingAck === "ISSUE" ? "ACK_ISSUE" : "REPORT_DAMAGE")
      : operations ? "ISSUE" : "RETIRE");
    setReason(""); setHolderId(""); setHistory(null); setReview(null);
    try { setHistory(await api(undefined, "?assetId=" + encodeURIComponent(value.id)) as History); }
    catch { setMessage("History unavailable for this record."); }
  }
  const current = data.items.find((value) => value.id === item?.id) ?? item;
  const actionList = mode === "self"
    ? (current?.pendingAck === "ISSUE" ? ["ACK_ISSUE", "DISPUTE_ISSUE"] : current?.holderKind === "PERSON" ? ["REPORT_DAMAGE", "REPORT_LOSS"] : [])
    : [
      ...(operations ? ["ISSUE", "TRANSFER", "RETURN", "ACK_RETURN"] : []),
      ...(operations ? ["INSPECT", "RECOVER", "REPAIR_START", "REPAIR_COMPLETE"] : []),
      ...(office || operations ? ["RETIRE"] : []),
    ];
  const store = data.stores[0];
  const contexts = data.contexts ?? [];
  const visibleItems = mode === "register" ? data.items : data.items.filter((value) =>
    !search || (value.reference + " " + value.description).toLowerCase().includes(search.toLowerCase()));
  const changeFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  const registerRows: ResponsiveRecord[] = visibleItems.map((value) => ({
    id: value.id,
    cells: [
      <span key="item"><strong>{value.reference}</strong><br />{value.description}<br />{value.class.replaceAll("_", " ")}</span>,
      <span key="custody">{value.holderKind.replaceAll("_", " ")} · {value.holderLabel ?? value.holderId}<br />Last location: {value.locationLabel ?? "Not recorded"}</span>,
      <span key="condition"><FactualStatus label={`Condition ${value.condition}`} /><br />Repair: {value.maintenanceState}<br />Exception: {value.exceptionState}</span>,
      <span key="return">{stamp(value.expectedReturnAt)}{value.overdue && <><br />Expected return has passed.</>}{value.pendingAck && <><br />Handover acknowledgement pending: {value.pendingAck}</>}</span>,
      <span key="available">{availableToIssue(value)} · {availabilityReason(value)}</span>,
      <button key="action" type="button" className={styles.rowAction} onClick={() => open(value)}>View history and actions</button>,
    ],
    mobile: {
      title: `${value.reference} · ${value.description}`,
      status: <FactualStatus label={`Condition ${value.condition}`} />,
      details: [
        `Class: ${value.class.replaceAll("_", " ")}`,
        `Custody: ${value.holderKind.replaceAll("_", " ")} · ${value.holderLabel ?? value.holderId}`,
        `Last location: ${value.locationLabel ?? "Not recorded"}`,
        `Repair: ${value.maintenanceState} · Exception: ${value.exceptionState}`,
        `Return expected: ${stamp(value.expectedReturnAt)} · Available to issue: ${availableToIssue(value)} · ${availabilityReason(value)}`,
        ...(value.overdue ? ["Expected return has passed."] : []),
        ...(value.pendingAck ? [`Handover acknowledgement pending: ${value.pendingAck}`] : []),
      ],
      action: <button type="button" className={styles.rowAction} onClick={() => open(value)}>View history and actions</button>,
    },
  }));
  return <div className={styles.workspace}>
    <p className={styles.hint}>Synthetic development only. Custody, condition and repair are recorded separately. Damage or loss is an operational fact, not an attribution of blame.</p>
    <p role="status" aria-live="polite">{busy ? "Saving…" : message}</p>
    {mode === "register" && loading && <StatePanel kind="loading" title="Loading authorised assets" description="Waiting for the current asset register read." />}
    {mode === "register" && loadError && <StatePanel kind="error" title="Asset view unavailable" description={loadError}
      action={<button type="button" className={styles.retry} onClick={() => void reload()}>Retry</button>} />}
    {(mode === "self" || (!loading && !loadError)) && <>
    {mode === "register" && office && <details className={styles.setup}><summary>Register items and opening stock</summary><p>Use these controls after confirming the exact item or stock record does not already exist.</p><div className={styles.grid}>
      <section className={styles.panel}><h2>Register an item</h2>
        <form onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget);
          submit({ action: "REGISTER", reference: String(f.get("reference")).trim().toUpperCase(),
            class: f.get("class"), description: f.get("description"), serial: f.get("serial"),
            condition: f.get("condition"), storeId: f.get("storeId") }); }}>
          <label>Reference<input name="reference" required maxLength={32} placeholder="RADIO-001" /></label>
          <label>Class<select name="class">{classes.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Description<input name="description" required maxLength={160} /></label>
          <label>Serial (optional)<input name="serial" maxLength={100} /></label>
          <label>Condition<select name="condition">{conditions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>KSS store<select name="storeId">{data.stores.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <button disabled={busy || !store}>Register</button>
        </form>
      </section>
      <section className={styles.panel}><h2>Open uniform stock</h2>
        <form onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget);
          submit({ action: "STOCK_CREATE", sku: String(f.get("sku")).trim().toUpperCase(),
            garment: f.get("garment"), size: f.get("size"), quantity: Number(f.get("quantity")),
            reason: f.get("reason"), storeId: f.get("storeId") }); }}>
          <label>Stock reference<input name="sku" required maxLength={32} placeholder="POLO-M" /></label>
          <label>Garment<input name="garment" required maxLength={100} placeholder="Polo Shirt" /></label>
          <label>Size<input name="size" required maxLength={20} placeholder="Medium" /></label>
          <label>Verified opening quantity<input name="quantity" type="number" min={1} required defaultValue={20} /></label>
          <label>Stocktake reason<input name="reason" required minLength={3} maxLength={500} /></label>
          <label>KSS store<select name="storeId">{data.stores.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <button disabled={busy || !store}>Open stock</button>
        </form>
      </section>
    </div></details>}
    {mode === "register" && superAdmin && admin && <section className={styles.panel}>
      <details className={styles.adminDetails}><summary>Scoped Operations grants</summary><p>Grant and revocation change access for one exact scope. Review current grants before making a change.</p>
      <form onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget);
        const scope = admin.scopes.find((value) => value.kind + ":" + value.id === f.get("scope"));
        if (scope) submit({ action: "GRANT", personId: f.get("person"), scopeKind: scope.kind, scopeId: scope.id,
          until: new Date(String(f.get("until"))).toISOString(), reason: f.get("reason") }); }}>
        <label>Operations person<select name="person">{admin.operations.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
        <label>Exact scope<select name="scope">{admin.scopes.map((value) => <option key={value.kind + value.id} value={value.kind + ":" + value.id}>{value.kind}: {value.name}</option>)}</select></label>
        <label>Grant ends<input name="until" type="datetime-local" required /></label>
        <label>Reason<input name="reason" required minLength={3} maxLength={300} /></label>
        <button disabled={busy || admin.operations.length === 0}>Grant</button>
      </form>
      <ul>{admin.grants.map((grant) => <li key={grant.id}>{grant.scopeKind} · {grant.personId.slice(0, 8)} · until {stamp(grant.effectiveUntil)}{" "}
        <button type="button" disabled={busy} onClick={() => { const why = window.prompt("Revocation reason");
          if (why) submit({ action: "REVOKE_GRANT", grantId: grant.id, reason: why }); }}>Revoke</button></li>)}</ul>
      <details><summary>Recent grant history</summary><ol className={styles.history}>{admin.grantEvents.map((event) =>
        <li key={event.id}>{event.kind} · {stamp(event.occurredAt)} · grant {event.grantId.slice(0, 8)}
          <span>Reason: {event.reason}</span></li>)}</ol></details>
      </details>
    </section>}
    {mode === "register" && <section className={styles.registerSection} aria-labelledby="asset-register-heading">
      <h2 id="asset-register-heading">Asset register</h2>
      <p className={styles.hint}>Search authorised items and inspect custody, location, condition, repair and exception separately. Open an item for exact history and guarded actions.</p>
      <div className={styles.views} aria-label="Asset views">{["ALL", "AVAILABLE", "ISSUED", "OVERDUE", "REPAIR", "EXCEPTIONS"].map((value) =>
        <button key={value} type="button" aria-pressed={view === value} onClick={() => changeFilter(setView, value)}>{value.replaceAll("_", " ")}</button>)}</div>
      <FilterBar resultCount={`${total} authorised ${total === 1 ? "item" : "items"}; page ${page}`}>
        <label>Search reference or description<input type="search" value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} /></label>
        <label>Class<select value={assetClass} onChange={(event) => changeFilter(setAssetClass, event.target.value)}><option value="">All classes</option>{classes.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Holder type<select value={holderFilter} onChange={(event) => { changeFilter(setHolderFilter, event.target.value); setContextFilter(""); }}><option value="">All holders</option>{["PERSON", "STORE", "SITE", "SITE_SERVICE", "EVENT"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Exact holder / context<select value={contextFilter} onChange={(event) => changeFilter(setContextFilter, event.target.value)}><option value="">All authorised contexts</option>
          {contexts.filter((value) => !holderFilter || value.kind === holderFilter).map((value) => <option key={value.kind + value.id} value={value.kind + ":" + value.id}>{value.kind.replaceAll("_", " ")} · {value.label}</option>)}
        </select></label>
        <label>Condition<select value={conditionFilter} onChange={(event) => changeFilter(setConditionFilter, event.target.value)}><option value="">All conditions</option>{conditions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Repair<select value={repairFilter} onChange={(event) => changeFilter(setRepairFilter, event.target.value)}><option value="">All repair states</option>{["NONE", "QUARANTINED", "IN_REPAIR"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Exception<select value={exceptionFilter} onChange={(event) => changeFilter(setExceptionFilter, event.target.value)}><option value="">All exceptions</option>{["NONE", "LOST", "RETIRED"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Return status<select value={returnFilter} onChange={(event) => changeFilter(setReturnFilter, event.target.value)}><option value="">All return states</option>{["OVERDUE", "DUE", "NOT_SET"].map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      </FilterBar>
      <ResponsiveRecordList label="Authorised asset register" columns={["Item", "Custody / location", "Condition / repair / exception", "Expected return", "Available to issue", "Record"]}
        rows={registerRows} empty={<StatePanel kind="empty" title="No assets in this view" description="Try a different search or context filter." />} />
      <div className={styles.pagination}><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous page</button>
        <span>Page {page} of {Math.max(1, Math.ceil(total / 30))}</span>
        <button type="button" disabled={page * 30 >= total} onClick={() => setPage(page + 1)}>Next page</button></div>
    </section>}
    {mode === "self" && <section className={styles.panel}><h2>My equipment</h2><p className={styles.hint}>Current items issued to you. Open an item to acknowledge, dispute or report an observation.</p>
      <label>Find asset by reference or description<input type="search" value={search}
        onChange={(event) => setSearch(event.target.value)} /></label>
      <p className={styles.count} role="status">{visibleItems.length} {visibleItems.length === 1 ? "item" : "items"} in this view</p>
      {visibleItems.length === 0 && <p>No assets in this view.</p>}
      <div className={styles.grid}>{visibleItems.map((value) => <article className={styles.card} key={value.id}>
        <span className={styles.reference}>{value.reference} · {value.class.replaceAll("_", " ")}</span><h3>{value.description}</h3>
        <dl><dt>Available to issue</dt><dd>{value.holderKind === "STORE" && value.pendingAck === null &&
          value.maintenanceState === "NONE" && value.exceptionState === "NONE" &&
          ["GOOD", "SERVICEABLE"].includes(value.condition) ? "Yes" : "No"}</dd>
          <dt>Custody</dt><dd>{value.holderKind.replaceAll("_", " ")} · {value.holderLabel ?? value.holderId}</dd>
          <dt>Last location</dt><dd>{value.locationLabel ?? "Not recorded"}</dd>
          <dt>Condition</dt><dd>{value.condition}</dd><dt>Repair</dt><dd>{value.maintenanceState}</dd>
          <dt>Exception</dt><dd>{value.exceptionState}</dd><dt>Return expected</dt><dd>{stamp(value.expectedReturnAt)}</dd></dl>
        {value.overdue && <p className={styles.alert}>Expected return has passed.</p>}
        {value.pendingAck && <p className={styles.alert}>Handover acknowledgement pending: {value.pendingAck}</p>}
        <button type="button" onClick={() => open(value)}>View history and actions</button>
      </article>)}</div>
    </section>}
    {current && <section className={mode === "register" ? `${styles.panel} ${styles.selectedSection}` : styles.panel}>
      {mode === "register" ? <SourceCard identity={`${current.reference} · ${current.description}`}
        context={`${current.class.replaceAll("_", " ")} · selected asset`} state={`Condition ${current.condition}`}
        freshness={`Revision ${current.revision}`} primary>
        <p>Custody: {current.holderKind.replaceAll("_", " ")} · {current.holderLabel ?? current.holderId}. Last location: {current.locationLabel ?? "Not recorded"}.</p>
        <p>Repair: {current.maintenanceState}. Exception: {current.exceptionState}. Expected return: {stamp(current.expectedReturnAt)}.</p>
      </SourceCard> : <h2>{current.reference} · history</h2>}
      {history?.serial && <p>Serial: {history.serial}</p>}
      {actionList.length > 0 && !review && <form onSubmit={(event) => { event.preventDefault();
        const payload = { action, assetId: current.id, expectedRevision: current.revision,
          holderKind: ["ISSUE", "TRANSFER", "RETURN"].includes(action) ? holderKind : null,
          holderId: ["ISSUE", "TRANSFER", "RETURN"].includes(action) ? holderId : null,
          condition: ["RETURN", "INSPECT"].includes(action) ? condition : null,
          expectedReturnAt: expectedReturn ? new Date(expectedReturn).toISOString() : null, reason: reason || null };
        if (["ISSUE", "TRANSFER", "RETURN"].includes(action)) setReview(payload);
        else void submit(payload); }}>
        <label>Action<select value={action} onChange={(event) => { const next = event.target.value; setAction(next); if (next === "RETURN") { setHolderKind("STORE"); setHolderId(store?.id ?? ""); } }}>
          {actionList.map((value) => <option key={value}>{value}</option>)}</select></label>
        {["ISSUE", "TRANSFER", "RETURN"].includes(action) && <>
          <label>New holder type<select disabled={action === "RETURN"} value={holderKind} onChange={(event) => { setHolderKind(event.target.value); setHolderId(""); }}>
            {(action === "RETURN" ? ["STORE"] : ["PERSON", "STORE", "SITE", "SITE_SERVICE", "EVENT"]).map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Exact holder<select value={holderId} onChange={(event) => setHolderId(event.target.value)} required>
            <option value="">Choose a {holderKind.toLowerCase().replaceAll("_", " ")}</option>
            {holders.filter((value) => value.kind === holderKind).map((value) =>
              <option key={value.id} value={value.id}>{value.name}</option>)}
          </select></label>
          {holderKind === "STORE" && store && <button type="button" onClick={() => setHolderId(store.id)}>Use KSS store</button>}
          <label>Expected return (optional)<input type="datetime-local" value={expectedReturn} onChange={(event) => setExpectedReturn(event.target.value)} /></label>
        </>}
        {["RETURN", "INSPECT"].includes(action) && <label>Observed condition<select value={condition} onChange={(event) => setCondition(event.target.value)}>
          {conditions.map((value) => <option key={value}>{value}</option>)}</select></label>}
        <label>Reason / observation<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500}
          required={["DISPUTE_ISSUE", "REPORT_DAMAGE", "REPORT_LOSS", "RECOVER", "RETIRE"].includes(action)} /></label>
        <button disabled={busy}>{["ISSUE", "TRANSFER", "RETURN"].includes(action) ? "Review handover" : "Record " + action.replaceAll("_", " ").toLowerCase()}</button>
      </form>}
      {review && <div className={styles.review} role="group" aria-label="Review custody change"><h3>Review {String(review.action).toLowerCase()}</h3>
        <p>{current.reference} · {current.description}</p>
        <p>Current holder: {current.holderLabel ?? current.holderId}. New holder: {String(holders.find((value) => value.id === review.holderId)?.name ?? review.holderId)} ({String(review.holderKind)}).</p>
        <p>Observed condition: {String(review.condition ?? current.condition)}. Expected return: {stamp(review.expectedReturnAt as string | null)}.</p>
        <p>This records one custody event. Recipient or receiving acknowledgement remains a separate action.</p>
        <button type="button" disabled={busy} onClick={() => void submit(review)}>Confirm {String(review.action).toLowerCase()}</button>{" "}
        <button type="button" onClick={() => setReview(null)}>Edit</button>
      </div>}
      <ol className={styles.history}>{history?.events.map((value) => <li key={value.id}>
        <strong>{value.action.replaceAll("_", " ")}</strong> · {stamp(value.recordedAt)} · revision {value.revision}
        <span>Custody {value.holderAfter}; condition {value.conditionAfter}; repair {value.maintenanceAfter}</span>
        {value.reason && <span>Observation: {value.reason}</span>}
      </li>)}</ol>
    </section>}
    {mode === "register" && <section className={styles.panel}><h2>Uniform stock by size</h2>
      <div className={styles.grid}>{data.stock.map((value) => <article className={styles.card} key={value.id}>
        <strong>{value.garment} · {value.size}</strong><p>{value.sku} · Available {value.available} · Issued {value.issued}</p>
        <button type="button" onClick={async () => { try { setStockHistory(await api(undefined, "?stockId=" + encodeURIComponent(value.id)) as StockHistory); }
          catch { setMessage("Stock history unavailable."); } }}>View movements and issue IDs</button>
        {(operations || office) && <StockMoveForm value={value} holders={holders} operations={operations} office={office} busy={busy} submit={submit} />}
      </article>)}</div>
      {stockHistory && <div className={styles.card}><h3>{stockHistory.sku} · movement history</h3>
        <ol className={styles.history}>{stockHistory.events.map((value) => <li key={value.id}>
          <strong>{value.action}</strong> · {stamp(value.recordedAt)} · quantity {value.quantity} · available after {value.availableAfter}
          {value.issueId && <span>Issue ID for return: {value.issueId}</span>}
          {value.reason && <span>Reason: {value.reason}</span>}
        </li>)}</ol></div>}
    </section>}
    {mode === "self" && <section className={styles.panel}><h2>My issued uniform</h2>
      {data.myStock.length === 0 && <p>No uniform issue is outstanding.</p>}
      {data.myStock.map((value) => <article className={styles.card} key={value.issueId}>
        <strong>{value.garment} · {value.size}</strong><p>Quantity {value.outstanding}. Acknowledgement: {value.acknowledgement}.</p>
        {value.acknowledgement === "PENDING" && <>
          <button disabled={busy} onClick={() => submit({ action: "STOCK_ACK", issueId: value.issueId, dispute: false })}>Acknowledge receipt</button>{" "}
          <button disabled={busy} onClick={() => { const why = window.prompt("Describe the discrepancy");
            if (why) submit({ action: "STOCK_ACK", issueId: value.issueId, dispute: true, reason: why }); }}>Dispute receipt</button>
        </>}
      </article>)}
    </section>}
    </>}
  </div>;
}

function StockMoveForm({ value, holders, operations, office, busy, submit }: {
  value: Stock; holders: Holder[]; operations: boolean; office: boolean; busy: boolean;
  submit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [movement, setMovement] = useState(operations ? "ISSUE" : "ADJUST");
  const [issues, setIssues] = useState<{ issueId: string; personId: string; personName: string; outstanding: number; acknowledgement: string }[]>([]);
  const [choiceError, setChoiceError] = useState("");
  async function choose(value0: string) {
    setMovement(value0); setChoiceError("");
    if (value0 === "RETURN") {
      try { setIssues(await api(undefined, "?stockChoices=" + encodeURIComponent(value.id)) as typeof issues); }
      catch { setIssues([]); setChoiceError("Outstanding issues could not be confirmed."); }
    }
  }
  return <form onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget);
    const issue = issues.find((entry) => entry.issueId === f.get("issueId"));
    if (movement === "RETURN" && !issue) { setChoiceError("Choose an outstanding issue."); return; }
    void submit({ action: "STOCK_" + movement, stockId: value.id, quantity: Number(f.get("quantity")),
      personId: movement === "RETURN" ? issue?.personId : f.get("personId") || null,
      issueId: movement === "RETURN" ? issue?.issueId : null,
      expectedRevision: value.revision, reason: f.get("reason") || null }); }}>
    <label>Movement<select value={movement} onChange={(event) => void choose(event.target.value)}>{operations && <><option>ISSUE</option><option>RETURN</option></>}{office && <option>ADJUST</option>}</select></label>
    <label>Quantity {movement === "ADJUST" ? "or signed adjustment" : ""}<input name="quantity" type="number" required min={movement === "ADJUST" ? undefined : 1} defaultValue={1} /></label>
    {movement === "ISSUE" && <label>Recipient Staff<select name="personId" required><option value="">Choose Staff</option>{holders.filter((entry) => entry.kind === "PERSON").map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
    {movement === "RETURN" && <label>Returnable issued line<select name="issueId" required><option value="">Choose acknowledged or disputed line</option>{issues.map((entry) => <option key={entry.issueId} value={entry.issueId}>{entry.personName} · {entry.outstanding} outstanding · {entry.acknowledgement.toLowerCase()}</option>)}</select></label>}
    {choiceError && <p role="alert">{choiceError}</p>}
    {movement === "ADJUST" && <label>Reason for adjustment<input name="reason" required maxLength={500} /></label>}
    <button disabled={busy || (movement === "RETURN" && issues.length === 0) || (movement === "ISSUE" && !holders.some((entry) => entry.kind === "PERSON"))}>Record {movement.toLowerCase()}</button>
  </form>;
}
